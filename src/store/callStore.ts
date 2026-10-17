import { create } from 'zustand'
import { callEngine, ensureMediaPermission, MediaPermissionError, type AudioOutput, type CameraFacing, type RemoteVideoKind } from '@/lib/agoraEngine'
import {
  acceptCall,
  endCall,
  getActiveCall,
  getCall,
  getRoomCalls,
  isCallOver,
  participantsOf,
  renewCallToken,
  startCall,
  startScreenShare,
  stopScreenShare,
  updateCallMedia,
  type Call,
  type CallSession,
  type CallSignalEvent,
  type CallType,
} from '@/lib/call'
import { ApiError } from '@/lib/apiError'

// 웹 store/callStore.ts 의 앱판. 상태 흐름은 웹과 같고, 미디어는 트랙 대신 원격 uid 로 들고 있다.
// 웹의 출력 장치 선택 대신 휴대폰의 수화부·스피커·이어폰·블루투스 중 소리가 나올 곳을 고른다

async function joinChannel(session: CallSession, video: boolean, stillConnecting: () => boolean) {
  callEngine.setScreenUids([session.call.caller.screenUid, session.call.callee.screenUid])
  await callEngine.join(session, { video })
  if (stillConnecting()) return true
  await callEngine.leave()
  return false
}

// outgoing = 내가 걸고 기다리는 중, incoming = 벨이 울리는 중, connecting = 채널에 붙는 중, active = 통화 중
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active'

interface CallStore {
  phase: CallPhase
  call: Call | null
  session: CallSession | null
  myUsername: string | null
  // 통화 응답이 오기 전에도 상대를 보여주려고 채팅방에서 미리 넘겨받는다
  peerNameHint: string | null
  peerImageUrl: string | null

  micOn: boolean
  camOn: boolean
  // 지금 소리가 나오는 곳. 고른 값이 아니라 SDK 가 알려준 실제 경로를 따른다
  audioOutput: AudioOutput
  // 이 통화 중에 붙은 이어폰·블루투스. 그쪽으로 듣다가 스피커로 바꿔도 다시 고를 수 있게 기억해 둔다
  externalOutput: Extract<AudioOutput, 'headset' | 'bluetooth'> | null
  screenOn: boolean
  busy: boolean

  remoteCamUid: number | null
  remoteScreenUid: number | null

  activeSince: number | null
  error: string | null
  notice: string | null
  // 통화는 작은 도크에서 시작하고, 영상이 붙거나 사용자가 키우면 전체화면으로 넘어간다
  expanded: boolean
  peerReconnecting: boolean
  cameraFacing: CameraFacing

  setMyUsername: (username: string | null) => void
  applySignal: (event: CallSignalEvent) => void
  setRemoteVideo: (kind: RemoteVideoKind, uid: number | null) => void
  setError: (message: string | null) => void
  setNotice: (message: string | null) => void
  setExpanded: (expanded: boolean) => void

  start: (token: string, roomId: number, callType: CallType, peer?: { name?: string | null; imageUrl?: string | null }) => Promise<void>
  accept: (token: string) => Promise<void>
  resume: (token: string) => Promise<void>
  handlePeerLeft: (getToken: () => string | null) => void
  handlePeerJoined: () => void
  hangUp: (token: string) => Promise<void>
  toggleMic: (token: string) => Promise<void>
  toggleCam: (token: string) => Promise<void>
  flipCamera: () => Promise<void>
  setAudioOutput: (output: AudioOutput) => void
  selectAudioOutput: (output: AudioOutput) => void
  toggleScreen: (token: string) => Promise<void>
  renew: (token: string) => Promise<void>
  reset: () => Promise<void>
}

const initial = {
  phase: 'idle' as CallPhase,
  call: null,
  session: null,
  peerNameHint: null,
  peerImageUrl: null,
  micOn: true,
  camOn: false,
  audioOutput: 'earpiece' as AudioOutput,
  externalOutput: null,
  screenOn: false,
  busy: false,
  remoteCamUid: null,
  remoteScreenUid: null,
  activeSince: null,
  error: null,
  notice: null,
  expanded: false,
  peerReconnecting: false,
  cameraFacing: 'user' as CameraFacing,
}

// 종료 신호 없이 채널에서만 빠졌다면 일시적인 끊김일 수 있어, 다시 들어올 시간을 준다(웹과 같다)
const PEER_RECONNECT_TIMEOUT_MS = 15_000
const TOKEN_RENEW_ATTEMPTS = 3
const TOKEN_RENEW_RETRY_MS = 5_000
let peerLeftTimer: ReturnType<typeof setTimeout> | null = null
// 이어폰·블루투스로 바꿨을 때 실제로 그쪽으로 갔는지 확인하는 시간
const OUTPUT_CHECK_MS = 2_000
let outputCheckTimer: ReturnType<typeof setTimeout> | null = null

function clearOutputCheck() {
  if (outputCheckTimer) clearTimeout(outputCheckTimer)
  outputCheckTimer = null
}

// 휴대폰 통화처럼 음성은 수화부, 영상은 스피커로 시작한다(엔진의 기본 경로와 같다). 이어폰이 꽂혀 있으면 곧 SDK 가 고쳐 준다
function defaultOutput(video: boolean): AudioOutput {
  return video ? 'speaker' : 'earpiece'
}

function clearPeerLeftTimer() {
  if (peerLeftTimer) clearTimeout(peerLeftTimer)
  peerLeftTimer = null
}

// 통화가 끝났을 때 띄울 안내. 내가 한 행동에는 아무것도 띄우지 않는다
function noticeFor(call: Call, iAmCaller: boolean, byMe: boolean): string | null {
  if (byMe) return null
  switch (call.status) {
    case 'REJECTED':
      return '상대방이 통화를 거절했어요.'
    case 'CANCELED':
      return '상대방이 통화를 취소했어요.'
    case 'MISSED':
      return iAmCaller ? '상대방이 받지 않았어요.' : '부재중 전화가 있어요.'
    case 'ENDED':
      return '통화가 종료되었어요.'
    default:
      return null
  }
}

function messageOf(e: unknown): string {
  if (e instanceof MediaPermissionError) return e.message
  if (e instanceof ApiError) {
    if (e.code === 'CALL_ALREADY_IN_PROGRESS') return '이미 진행 중인 통화가 있어요.'
    if (e.code === 'SCREEN_SHARE_OCCUPIED') return '상대방이 화면을 공유하고 있어요.'
    if (e.status >= 500) return `서버 오류로 통화를 시작하지 못했어요. (${e.status}${e.code ? ` ${e.code}` : ''})`
    return e.message
  }
  return e instanceof Error && e.message ? e.message : '통화를 연결하지 못했어요.'
}

// 연결 도중 실패했을 때 서버에 만들어진 통화를 반드시 접는다. 빼먹으면 상대 전화가 계속 울린다
async function abandonCall(token: string, callId: number | undefined) {
  if (callId == null) return
  await endCall(token, callId).catch(() => {})
}

async function clearStaleCalls(token: string, roomId: number): Promise<boolean> {
  try {
    const calls = await getRoomCalls(token, roomId)
    const alive = calls.filter((c) => !isCallOver(c.status))
    if (alive.length === 0) return false
    await Promise.all(alive.map((c) => endCall(token, c.callId).catch(() => {})))
    return true
  } catch {
    return false
  }
}

export const useCallStore = create<CallStore>()((set, get) => ({
  ...initial,
  myUsername: null,

  setMyUsername: (myUsername) => set({ myUsername }),
  setError: (error) => set({ error }),
  setNotice: (notice) => set({ notice }),
  setExpanded: (expanded) => set({ expanded }),

  setRemoteVideo: (kind, uid) =>
    set(
      kind === 'screen'
        ? { remoteScreenUid: uid, expanded: uid != null ? true : get().expanded }
        : { remoteCamUid: uid, expanded: uid != null ? true : get().expanded },
    ),

  // 서버가 주는 call 은 항상 최신 전체 스냅샷이라 그대로 덮어쓴다
  applySignal: ({ signal, call, fromUsername }) => {
    const state = get()
    callEngine.setScreenUids([call.caller.screenUid, call.callee.screenUid])

    if (isCallOver(call.status)) {
      if (state.phase === 'idle') return
      // 다른 통화가 끝났다는 신호가 늦게 와서 지금 통화를 닫지 않게 한다
      if (state.call && state.call.callId !== call.callId) return
      const iAmCaller = call.caller.username === state.myUsername
      set({ notice: noticeFor(call, iAmCaller, fromUsername === state.myUsername) })
      void get().reset()
      return
    }

    if (signal === 'INVITED') {
      if (state.phase !== 'idle') return
      // 받는 쪽은 하던 일이 있어 도크·채팅방 카드로만 알리고 화면은 덮지 않는다
      set({
        phase: 'incoming',
        call,
        peerImageUrl: call.caller.imageUrl ?? null,
        micOn: true,
        camOn: call.callType === 'VIDEO',
        expanded: false,
      })
      return
    }

    if (state.phase === 'idle') return
    set({ call })
    if (signal === 'ACCEPTED' && state.phase === 'outgoing') {
      set({ phase: 'active', activeSince: Date.now(), expanded: true })
    }
  },

  start: async (token, roomId, callType, peer) => {
    if (get().phase !== 'idle') return
    const video = callType === 'VIDEO'
    set({
      ...initial,
      phase: 'connecting',
      peerNameHint: peer?.name ?? null,
      peerImageUrl: peer?.imageUrl ?? null,
      camOn: video,
      audioOutput: defaultOutput(video),
      // 건 사람은 지금 하려는 일이 통화뿐이라 전체화면에서 기다린다
      expanded: true,
    })
    try {
      // 서버에 통화를 만들기 전에 권한부터 확인한다
      await ensureMediaPermission(video)
      const session = await startCall(token, roomId, callType)
      if (get().phase !== 'connecting') {
        await abandonCall(token, session.call.callId)
        return
      }
      // 접속하는 몇 초 사이에 끊어도 서버에 종료를 알릴 수 있게 callId 를 먼저 들고 있는다
      set({ call: session.call, session, peerImageUrl: session.call.callee.imageUrl ?? get().peerImageUrl })
      const joined = await joinChannel(session, video, () => get().phase === 'connecting')
      if (!joined) {
        await abandonCall(token, session.call.callId)
        return
      }
      // 상대가 아주 빨리 받으면 ACCEPTED 가 join 보다 먼저 온다
      const arrived = get().call
      const accepted = arrived?.status === 'ACCEPTED'
      set({
        phase: accepted ? 'active' : 'outgoing',
        call: arrived ?? session.call,
        session,
        activeSince: accepted ? Date.now() : null,
      })
    } catch (e) {
      await callEngine.leave()
      await abandonCall(token, get().call?.callId)
      let message = messageOf(e)
      // 예전에 끊기지 못하고 서버에 남은 통화가 있으면 계속 막히므로 한 번 치워준다
      if (e instanceof ApiError && e.code === 'CALL_ALREADY_IN_PROGRESS') {
        if (await clearStaleCalls(token, roomId)) message = '이전 통화가 정리되었어요. 다시 걸어주세요.'
      }
      set({ ...initial, error: message })
    }
  },

  accept: async (token) => {
    const { call, phase } = get()
    if (!call || phase !== 'incoming') return
    const video = call.callType === 'VIDEO'
    set({ phase: 'connecting', audioOutput: defaultOutput(video) })
    try {
      await ensureMediaPermission(video)
      const session = await acceptCall(token, call.callId)
      const joined = await joinChannel(session, video, () => get().phase === 'connecting')
      if (!joined) return
      set({ phase: 'active', call: get().call ?? session.call, session, activeSince: Date.now(), expanded: true })
    } catch (e) {
      await callEngine.leave()
      // 수락과 상대의 취소가 겹치면 409 가 온다. 이미 끝난 통화면 서버 상태대로 화면을 맞춘다
      if (e instanceof ApiError && e.status === 409) {
        const latest = await getCall(token, call.callId).catch(() => null)
        if (latest && isCallOver(latest.status)) {
          set({ ...initial, notice: noticeFor(latest, false, false) })
          return
        }
      }
      await abandonCall(token, call.callId)
      set({ ...initial, error: messageOf(e) })
    }
  },

  resume: async (token) => {
    if (get().phase !== 'idle') return
    const active = await getActiveCall(token).catch(() => null)
    if (!active) return
    const call = active.call
    if (
      !call ||
      (call.status !== 'RINGING' && call.status !== 'ACCEPTED') ||
      !call.caller?.username ||
      !call.callee?.username ||
      get().phase !== 'idle'
    )
      return

    const { connection } = active
    const { me, peer } = participantsOf(call, get().myUsername)
    const base = { ...initial, call, peerNameHint: peer.name, peerImageUrl: peer.imageUrl ?? null }

    // 받는 쪽이 아직 수락하지 않았으면 접속 정보가 없다. 벨 화면으로 되돌린다
    if (!connection) {
      set({ ...base, phase: 'incoming', camOn: call.callType === 'VIDEO' })
      return
    }

    const video = me.videoEnabled
    set({ ...base, phase: 'connecting', micOn: me.audioEnabled, camOn: video, audioOutput: defaultOutput(video), expanded: true })
    try {
      await ensureMediaPermission(video)
      const session = { ...connection, call }
      set({ session })
      const joined = await joinChannel(session, video, () => get().phase === 'connecting')
      if (!joined) return
      if (!me.audioEnabled) await callEngine.setMic(false)
      // 다른 기기(웹)에서 공유하던 상태가 서버에 남아 있으면 상대가 공유를 못 해서 푼다
      if (me.screenSharing) {
        const updated = await stopScreenShare(token, call.callId).catch(() => null)
        if (updated) set({ call: updated })
      }
      const latest = get().call ?? call
      const accepted = latest.status === 'ACCEPTED'
      set({
        phase: accepted ? 'active' : 'outgoing',
        call: latest,
        // 통화 시간이 다시 0 부터 세지지 않도록 서버의 시작 시각을 쓴다
        activeSince: accepted ? (latest.startedAt ? Date.parse(latest.startedAt) : Date.now()) : null,
      })
    } catch {
      await callEngine.leave()
      await abandonCall(token, call.callId)
      set({ ...initial, error: '진행 중이던 통화에 다시 연결하지 못했어요.' })
    }
  },

  handlePeerLeft: (getToken) => {
    const { phase } = get()
    if (phase === 'idle' || phase === 'incoming' || peerLeftTimer) return
    set({ peerReconnecting: true })
    peerLeftTimer = setTimeout(() => {
      peerLeftTimer = null
      if (callEngine.hasRemotePeer()) {
        set({ peerReconnecting: false })
        return
      }
      const state = get()
      if (state.phase === 'idle' || state.phase === 'incoming') return
      state.setNotice('상대방과의 연결이 끊어졌어요.')
      const token = getToken()
      if (token) void state.hangUp(token)
      else void state.reset()
    }, PEER_RECONNECT_TIMEOUT_MS)
  },

  handlePeerJoined: () => {
    clearPeerLeftTimer()
    if (get().peerReconnecting) set({ peerReconnecting: false })
  },

  // 끊기는 /end 하나로 통일한다. RINGING 이면 서버가 발신자는 취소, 수신자는 거절로 처리한다
  hangUp: async (token) => {
    const { call, screenOn } = get()
    await get().reset()
    if (!call) return
    // 공유 중에 끊으면 서버에 점유 상태가 남아 상대가 다음 통화에서 화면공유를 못 할 수 있어 먼저 푼다(웹과 같다)
    if (screenOn) await stopScreenShare(token, call.callId).catch(() => {})
    await endCall(token, call.callId).catch(() => {})
  },

  toggleMic: async (token) => {
    const { micOn, camOn, call } = get()
    const next = !micOn
    set({ micOn: next })
    await callEngine.setMic(next)
    // 상대 화면의 마이크 표시를 바꾸려면 서버에도 알려야 한다
    if (call) await updateCallMedia(token, call.callId, { audioEnabled: next, videoEnabled: camOn }).catch(() => {})
  },

  toggleCam: async (token) => {
    const { camOn, micOn, call, busy } = get()
    if (busy) return
    const next = !camOn
    set({ busy: true })
    try {
      if (next) await ensureMediaPermission(true)
      await callEngine.setCamera(next)
      set({ camOn: next, expanded: next ? true : get().expanded, cameraFacing: callEngine.cameraFacing })
      if (call) await updateCallMedia(token, call.callId, { audioEnabled: micOn, videoEnabled: next }).catch(() => {})
    } catch (e) {
      set({ error: messageOf(e) })
    } finally {
      set({ busy: false })
    }
  },

  flipCamera: async () => {
    const { camOn, busy } = get()
    if (!camOn || busy) return
    set({ cameraFacing: await callEngine.flipCamera() })
  },

  setAudioOutput: (output) => {
    clearOutputCheck()
    set(output === 'headset' || output === 'bluetooth' ? { audioOutput: output, externalOutput: output } : { audioOutput: output })
  },

  selectAudioOutput: (output) => {
    callEngine.setAudioOutput(output)
    // 수화부·스피커는 바로 바뀌어 먼저 보여준다. 이어폰·블루투스는 그새 빠졌을 수 있어 SDK 가 확인해 줄 때까지 기다린다
    if (output === 'earpiece' || output === 'speaker') {
      set({ audioOutput: output })
      return
    }
    clearOutputCheck()
    outputCheckTimer = setTimeout(() => {
      outputCheckTimer = null
      if (get().audioOutput === output) return
      // 기억해 둔 기기가 그 사이 꺼졌거나 연결이 끊긴 경우. 목록에서 빼서 다시 못 고르게 한다
      set({ externalOutput: null, error: output === 'bluetooth' ? '블루투스 기기를 찾지 못했어요.' : '이어폰을 찾지 못했어요.' })
    }, OUTPUT_CHECK_MS)
  },

  toggleScreen: async (token) => {
    const { screenOn, call, busy } = get()
    if (!call || busy) return
    set({ busy: true })
    try {
      if (screenOn) {
        await callEngine.stopScreen()
        set({ screenOn: false })
        // 빼먹으면 서버에 점유 상태가 남아 상대가 화면공유를 못 한다
        await stopScreenShare(token, call.callId).catch(() => {})
      } else {
        const session = await startScreenShare(token, call.callId)
        try {
          await callEngine.startScreen(session)
          set({ screenOn: true, call: session.call })
        } catch (e) {
          // 권한 창에서 거부한 경우 등. 서버 점유는 풀어야 다음에 다시 시도할 수 있다
          await stopScreenShare(token, call.callId).catch(() => {})
          throw e
        }
      }
    } catch (e) {
      set({ error: messageOf(e) })
    } finally {
      set({ busy: false })
    }
  },

  renew: async (token) => {
    const { call, phase } = get()
    if (!call || phase === 'incoming') return
    // RTC 토큰 유효 시간이 짧아, 갱신이 한 번 실패하고 끝나면 통화가 끊긴다. 만료 30초 전 알림 안에서 몇 번 더 시도한다
    for (let attempt = 0; attempt < TOKEN_RENEW_ATTEMPTS; attempt++) {
      if (get().call?.callId !== call.callId) return
      try {
        const session = await renewCallToken(token, call.callId)
        await callEngine.renewToken(session.rtcToken)
        set({ session })
        return
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 409)) return
        await new Promise((r) => setTimeout(r, TOKEN_RENEW_RETRY_MS))
      }
    }
  },

  reset: async () => {
    clearPeerLeftTimer()
    clearOutputCheck()
    await callEngine.leave()
    // notice("왜 끝났는지")는 통화가 끝난 뒤에 쓰이므로 남겨 둔다
    set({ ...initial, notice: get().notice })
  },
}))
