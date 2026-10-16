import { PermissionsAndroid, Platform } from 'react-native'
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  LocalVideoStreamState,
  RemoteVideoState,
  VideoSourceType,
  type IRtcEngineEventHandler,
  type IRtcEngineEx,
  type RtcConnection,
} from 'react-native-agora'
import type { CallSession, ScreenShareSession } from './call'

// 아고라 미디어 계층(웹 lib/agoraEngine.ts 의 앱판). React 상태와 분리해 모듈 싱글턴으로 둔다.
//
// 웹은 트랙 객체를 들고 화면 요소에 붙였지만, 앱 SDK 는 엔진 하나가 장치를 잡고 화면은 uid 로 그린다
// (RtcSurfaceView 에 uid 만 넘기면 된다). 그래서 스토어에는 트랙 대신 원격 uid 를 둔다

export type RemoteVideoKind = 'camera' | 'screen'
export type CameraFacing = 'user' | 'environment'

// 권한 거부는 사용자가 정하는 것이라 코드로 허용시킬 수 없다.
// 대신 "서버에 통화를 만들기 전에" 먼저 물어봐서, 거부당하면 아예 걸지 않는다
// (통화를 만든 뒤에 실패하면 서버에 RINGING 통화가 남아 상대 전화가 계속 울린다 — 웹과 같은 이유)
export class MediaPermissionError extends Error {
  constructor(
    message: string,
    readonly kind: 'denied' | 'unsupported',
  ) {
    super(message)
    this.name = 'MediaPermissionError'
  }
}

export async function ensureMediaPermission(video: boolean): Promise<void> {
  // iOS 는 SDK 가 장치를 처음 열 때 시스템이 묻는다(Info.plist 문구). 거부하면 소리·영상만 비고 통화는 이어진다
  if (Platform.OS !== 'android') return
  const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, ...(video ? [PermissionsAndroid.PERMISSIONS.CAMERA] : [])]
  const result = await PermissionsAndroid.requestMultiple(wanted)
  const denied = wanted.filter((p) => result[p] !== PermissionsAndroid.RESULTS.GRANTED)
  if (denied.length === 0) return
  const device = denied.length > 1 ? '마이크·카메라' : denied[0] === PermissionsAndroid.PERMISSIONS.CAMERA ? '카메라' : '마이크'
  throw new MediaPermissionError(`${device} 권한이 필요해요. 설정 > 애플리케이션 > 잇다 > 권한에서 허용한 뒤 다시 걸어주세요.`, 'denied')
}

interface EngineHandlers {
  // 원격 영상이 붙거나(uid) 떨어질 때(null). kind 로 카메라/화면공유를 구분한다
  onRemoteVideo?: (kind: RemoteVideoKind, uid: number | null) => void
  // 토큰 만료 30초 전. 무시하면 긴 통화가 뚝 끊긴다
  onTokenExpiring?: () => void
  // 시스템 알림의 '중지'나 권한 회수로 화면공유가 우리 버튼 밖에서 끝났을 때
  onScreenEnded?: () => void
  // 상대 카메라 uid 가 채널에서 빠졌을 때. 종료 버튼이 아니라 앱 종료·네트워크로 빠진 경우도 여기로 온다
  onPeerLeft?: () => void
  onPeerJoined?: () => void
  onError?: (message: string) => void
}

class CallEngine {
  private engine: IRtcEngineEx | null = null
  private appId: string | null = null
  private handlers: EngineHandlers = {}
  private eventHandler: IRtcEngineEventHandler | null = null
  // 원격 스트림이 카메라인지 화면인지는 uid 로만 판별할 수 있다(아고라는 종류를 알려주지 않는다)
  private screenUids = new Set<number>()
  private remoteUids = new Set<number>()
  private joined = false
  // 본 연결(카메라·마이크)의 내 uid. 화면공유 연결의 이벤트도 같은 처리기로 오므로 이것으로 가른다
  private mainUid: number | null = null
  // 화면공유는 같은 채널에 화면용 uid 로 한 번 더 접속해 보낸다(웹과 같은 방식). 그 연결 정보
  private screenConnection: RtcConnection | null = null
  // 화면 캡처가 시작되거나 실패하길 기다리는 중인 공유 요청
  private pendingScreen: { resolve: () => void; reject: (e: Error) => void } | null = null
  private cameraOn = false
  private facing: CameraFacing = 'user'
  // 말하는 중인지 보려고 받은 마지막 음량(0~1). 화면이 짧은 주기로 읽는다
  private levels = { me: 0, peer: 0 }
  // join 이 끝나기 전에 끊으면 이미 정리된 채널에 다시 붙지 않도록 leave 가 번호를 올린다(웹과 같은 장치)
  private generation = 0

  setHandlers(handlers: EngineHandlers) {
    this.handlers = handlers
  }

  // call 스냅샷이 바뀔 때마다 갱신해준다. 양쪽의 screenUid 를 모두 담는다
  setScreenUids(uids: number[]) {
    this.screenUids = new Set(uids.filter((u) => typeof u === 'number'))
  }

  get cameraFacing(): CameraFacing {
    return this.facing
  }

  getVolumeLevels() {
    return this.levels
  }

  // 지금 채널에 상대 카메라 uid 가 붙어 있는지. 이탈 이벤트가 재접속보다 늦게 올 수 있어 실제 목록으로 확인한다
  hasRemotePeer(): boolean {
    return [...this.remoteUids].some((uid) => this.kindOf(uid) === 'camera')
  }

  private kindOf(uid: number): RemoteVideoKind {
    return this.screenUids.has(uid) ? 'screen' : 'camera'
  }

  // 앱 엔진은 앱 ID 로 한 번 만든다. 서버가 다른 앱 ID 를 주면(환경이 바뀐 경우) 새로 만든다
  // 화면공유 연결에서 온 이벤트인지. 그 연결은 상대를 볼 필요가 없어 본 연결 이벤트만 다룬다
  private isMain(connection: RtcConnection) {
    return this.mainUid == null || connection.localUid == null || connection.localUid === this.mainUid
  }

  private isMyScreen(uid: number) {
    return this.screenConnection?.localUid === uid
  }

  private ensureEngine(appId: string): IRtcEngineEx {
    if (this.engine && this.appId === appId) return this.engine
    if (this.engine) {
      if (this.eventHandler) this.engine.unregisterEventHandler(this.eventHandler)
      this.engine.release()
    }
    // 화면공유를 두 번째 연결로 보내려면 확장 엔진(joinChannelEx)이 필요하다. 만들어지는 객체는 확장 엔진이다
    const engine = createAgoraRtcEngine() as IRtcEngineEx
    engine.initialize({ appId, channelProfile: ChannelProfileType.ChannelProfileCommunication })
    this.eventHandler = {
      onUserJoined: (connection, remoteUid) => {
        // 내 화면공유 연결도 같은 채널에 들어와 있어 되돌아온다. 상대가 아니다
        if (!this.isMain(connection) || this.isMyScreen(remoteUid)) return
        this.remoteUids.add(remoteUid)
        if (this.kindOf(remoteUid) === 'camera') this.handlers.onPeerJoined?.()
      },
      onUserOffline: (connection, remoteUid) => {
        if (!this.isMain(connection) || this.isMyScreen(remoteUid)) return
        this.remoteUids.delete(remoteUid)
        this.handlers.onRemoteVideo?.(this.kindOf(remoteUid), null)
        // 화면공유는 별도 uid 로 들어와 있어서, 공유를 끄면 그 uid 가 채널을 떠난다. 사람이 나간 것으로 보지 않는다
        if (this.kindOf(remoteUid) === 'camera') this.handlers.onPeerLeft?.()
      },
      onRemoteVideoStateChanged: (connection, remoteUid, state) => {
        if (!this.isMain(connection) || this.isMyScreen(remoteUid)) return
        if (state === RemoteVideoState.RemoteVideoStateDecoding) this.handlers.onRemoteVideo?.(this.kindOf(remoteUid), remoteUid)
        else if (state === RemoteVideoState.RemoteVideoStateStopped || state === RemoteVideoState.RemoteVideoStateFailed) {
          this.handlers.onRemoteVideo?.(this.kindOf(remoteUid), null)
        }
      },
      onTokenPrivilegeWillExpire: (connection) => {
        if (this.isMain(connection)) this.handlers.onTokenExpiring?.()
      },
      onLocalVideoStateChanged: (source, state) => {
        if (source !== VideoSourceType.VideoSourceScreen) return
        const capturing = state === LocalVideoStreamState.LocalVideoStreamStateCapturing || state === LocalVideoStreamState.LocalVideoStreamStateEncoding
        if (this.pendingScreen) {
          // 권한 창에서 허용하면 캡처가 시작되고, 거부하면 실패로 온다
          if (capturing) this.pendingScreen.resolve()
          else if (state === LocalVideoStreamState.LocalVideoStreamStateFailed) this.pendingScreen.reject(new Error('화면 공유를 시작하지 못했어요.'))
          return
        }
        // 공유 중에 시스템 쪽에서 멈춘 경우(알림의 중지 등). 우리 버튼과 똑같이 정리해야 서버 점유도 풀린다
        if (this.screenConnection && !capturing) this.handlers.onScreenEnded?.()
      },
      onAudioVolumeIndication: (connection, speakers) => {
        if (!this.isMain(connection)) return
        // 내 음량은 uid 0 으로, 상대는 그 uid 로 온다. 0~255 를 웹과 같은 0~1 로 맞춘다
        let me = this.levels.me
        let peer = 0
        let sawPeer = false
        for (const speaker of speakers) {
          const level = (speaker.volume ?? 0) / 255
          if (!speaker.uid) me = level
          else if (this.kindOf(speaker.uid) === 'camera') {
            peer = Math.max(peer, level)
            sawPeer = true
          }
        }
        this.levels = { me, peer: sawPeer ? peer : this.levels.peer }
      },
    }
    engine.registerEventHandler(this.eventHandler)
    // 말하는 사람 표시용. 150ms 마다 음량을 받는다(웹이 직접 읽던 주기와 같다)
    engine.enableAudioVolumeIndication(150, 3, false)
    this.engine = engine
    this.appId = appId
    return engine
  }

  async join(session: CallSession, opts: { video: boolean }) {
    if (this.joined) await this.leave()
    const gen = ++this.generation
    const engine = this.ensureEngine(session.appId)

    engine.enableAudio()
    // 음성으로 시작해도 상대가 카메라를 켜면 받아야 해서 영상 모듈은 늘 켜 두고, 내 카메라만 따로 켠다
    engine.enableVideo()
    engine.enableLocalVideo(opts.video)
    if (opts.video) engine.startPreview()
    this.cameraOn = opts.video
    this.facing = 'user'
    // 휴대폰 통화처럼 음성은 수화부로, 영상은 스피커로 시작한다
    engine.setDefaultAudioRouteToSpeakerphone(opts.video)

    const code = engine.joinChannel(session.rtcToken, session.channelName, session.uid, {
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: true,
      publishCameraTrack: opts.video,
      autoSubscribeAudio: true,
      autoSubscribeVideo: true,
    })
    if (code < 0) {
      this.cameraOn = false
      throw new Error(`통화 채널에 접속하지 못했어요. (${code})`)
    }
    this.joined = true
    this.mainUid = session.uid
    // 그 사이 끊었으면 바로 나온다
    if (gen !== this.generation) await this.leave()
  }

  async renewToken(rtcToken: string) {
    this.engine?.renewToken(rtcToken)
  }

  async setMic(on: boolean) {
    // 캡처까지 멈춰야 상단 마이크 사용 표시도 꺼진다(웹의 setEnabled(false) 와 같은 효과)
    this.engine?.enableLocalAudio(on)
  }

  async setCamera(on: boolean) {
    const engine = this.engine
    if (!engine || !this.joined) return
    if (on) {
      if (!this.cameraOn) this.facing = 'user'
      engine.enableLocalVideo(true)
      engine.startPreview()
      engine.updateChannelMediaOptions({ publishCameraTrack: true })
    } else {
      // 카메라는 끌 때 캡처를 완전히 멈춘다. 송출만 끄면 카메라 사용 표시가 남는다
      engine.updateChannelMediaOptions({ publishCameraTrack: false })
      engine.stopPreview()
      engine.enableLocalVideo(false)
    }
    this.cameraOn = on
  }

  // 휴대폰 앞·뒤 카메라 전환. 송출을 끊지 않고 장치만 바꾼다
  async flipCamera(): Promise<CameraFacing> {
    if (!this.engine || !this.cameraOn) return this.facing
    this.engine.switchCamera()
    this.facing = this.facing === 'user' ? 'environment' : 'user'
    return this.facing
  }

  get screenSharing() {
    return this.screenConnection != null
  }

  // 안드로이드는 화면 캡처 권한 창(MediaProjection)과 화면공유용 포그라운드 서비스를 SDK 가 띄운다.
  // 캡처를 먼저 시작해 권한을 받은 뒤 채널에 붙는다 — 거부했는데 붙어 있으면 빈 공유 참가자가 남는다(웹과 같은 순서)
  async startScreen(session: ScreenShareSession) {
    const engine = this.engine
    if (!engine || !this.joined) throw new Error('통화에 연결된 뒤 화면을 공유할 수 있어요.')
    if (this.screenConnection) await this.stopScreen()

    await new Promise<void>((resolve, reject) => {
      // 권한 창을 오래 띄워 둘 수 있어 넉넉히 기다린다
      const timer = setTimeout(() => {
        this.pendingScreen = null
        engine.stopScreenCapture()
        reject(new Error('화면 공유 권한을 받지 못했어요.'))
      }, 60_000)
      this.pendingScreen = {
        resolve: () => {
          clearTimeout(timer)
          this.pendingScreen = null
          resolve()
        },
        reject: (e) => {
          clearTimeout(timer)
          this.pendingScreen = null
          engine.stopScreenCapture()
          reject(e)
        },
      }
      const code = engine.startScreenCapture({
        captureVideo: true,
        captureAudio: false,
        // 글자가 많은 화면(문서·사진)이 대부분이라 부드러움보다 선명도를 택한다
        videoParams: { dimensions: { width: 720, height: 1280 }, frameRate: 10, bitrate: 0 },
      })
      if (code < 0) this.pendingScreen.reject(new Error(`화면 공유를 시작하지 못했어요. (${code})`))
    })

    const connection: RtcConnection = { channelId: session.channelName, localUid: session.screenUid }
    // 내 화면이 본 연결로 되돌아와 다시 받으면 데이터만 낭비하므로 받지 않는다
    engine.muteRemoteVideoStream(session.screenUid, true)
    engine.muteRemoteAudioStream(session.screenUid, true)
    const code = engine.joinChannelEx(session.rtcToken, connection, {
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      publishScreenCaptureVideo: true,
      publishMicrophoneTrack: false,
      publishCameraTrack: false,
      autoSubscribeAudio: false,
      autoSubscribeVideo: false,
    })
    if (code < 0) {
      engine.stopScreenCapture()
      throw new Error(`화면 공유 채널에 접속하지 못했어요. (${code})`)
    }
    this.screenConnection = connection
  }

  async stopScreen() {
    const engine = this.engine
    const connection = this.screenConnection
    this.screenConnection = null
    this.pendingScreen = null
    if (!engine) return
    engine.stopScreenCapture()
    if (connection) engine.leaveChannelEx(connection)
  }

  setSpeakerphone(on: boolean) {
    this.engine?.setEnableSpeakerphone(on)
  }

  isSpeakerphoneOn(): boolean {
    return this.engine?.isSpeakerphoneEnabled() ?? false
  }

  // 채널에서 나오고 카메라를 놓는다. 엔진은 다음 통화에 다시 쓰려고 살려 둔다
  async leave() {
    this.generation++
    await this.stopScreen()
    const engine = this.engine
    if (engine) {
      if (this.cameraOn) engine.stopPreview()
      engine.leaveChannel()
    }
    this.joined = false
    this.mainUid = null
    this.cameraOn = false
    this.remoteUids.clear()
    this.screenUids.clear()
    this.levels = { me: 0, peer: 0 }
  }
}

export const callEngine = new CallEngine()
