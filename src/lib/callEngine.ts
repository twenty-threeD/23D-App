import { PermissionsAndroid, Platform } from 'react-native'
import { AndroidAudioTypePresets, AudioSession, registerGlobals, type VideoTrackProps } from '@livekit/react-native'
import {
  createLocalAudioTrack,
  createLocalScreenTracks,
  createLocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  type LocalAudioTrack,
  type LocalVideoTrack,
  type Participant,
  type TrackPublication,
} from 'livekit-client'
import type { CallSession } from './call'

// livekit-client 는 브라우저 WebRTC API 를 전제로 만들어져, 앱에서는 react-native-webrtc 를 전역에 먼저 꽂아야 한다.
// Room 을 만들기 전 어디서든 한 번만 부르면 되므로 엔진 모듈이 처음 로드될 때 부른다
registerGlobals()

// LiveKit 미디어 계층(웹 lib/callEngine.ts 의 앱판). React 상태와 분리해 모듈 싱글턴으로 둔다.
//
// 앱 화면은 @livekit/react-native 의 VideoTrack 에 "트랙 참조"(참여자 + 트랙 출처)를 넘겨 그린다.
// 그래서 스토어에는 트랙 대신 그 참조를 둔다

export type RemoteVideoKind = 'camera' | 'screen'
export type CameraFacing = 'user' | 'environment'
// 통화 소리가 나오는 곳. 유선·USB 이어폰은 사용자에게 같은 '이어폰'이라 하나로 묶는다
export type AudioOutput = 'earpiece' | 'speaker' | 'headset' | 'bluetooth'
// VideoTrack 이 받는 트랙 참조
export type CallTrackRef = NonNullable<VideoTrackProps['trackRef']>

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

// iOS 화면공유는 방송 확장이 App Group 공유 폴더로 화면을 넘겨야 하는데, App Group 은 유료 개발자 계정이 있어야 만들 수 있다.
// iOS 는 아직 배포하지 않아 안드로이드에서만 버튼을 보여준다
export function canShareScreen() {
  return Platform.OS === 'android'
}

interface EngineHandlers {
  // 원격 영상이 붙거나(참조) 떨어질 때(null). kind 로 카메라/화면공유를 구분한다
  onRemoteVideo?: (kind: RemoteVideoKind, trackRef: CallTrackRef | null) => void
  // 시스템 알림의 '중지'나 권한 회수로 화면공유가 우리 버튼 밖에서 끝났을 때
  onScreenEnded?: () => void
  // 상대가 방에서 빠졌을 때. 종료 버튼이 아니라 앱 종료·네트워크로 빠진 경우도 여기로 온다
  onPeerLeft?: () => void
  onPeerJoined?: () => void
  // 내가 끊지 않았는데 방 접속이 끊겼을 때. SDK 가 재연결을 다 시도한 뒤이거나,
  // 같은 계정이 다른 기기에서 같은 통화에 다시 붙어 서버가 이쪽 접속을 내보낸 경우다
  onDisconnected?: () => void
  onError?: (message: string) => void
}

function sourceKind(source: Track.Source): RemoteVideoKind {
  return source === Track.Source.ScreenShare ? 'screen' : 'camera'
}

function toTrackRef(participant: Participant, publication: TrackPublication): CallTrackRef {
  return { participant, publication, source: publication.source }
}

class CallEngine {
  private room: Room | null = null
  private micTrack: LocalAudioTrack | null = null
  private camTrack: LocalVideoTrack | null = null
  private screenTrack: LocalVideoTrack | null = null
  private handlers: EngineHandlers = {}
  private facing: CameraFacing = 'user'
  private audioSessionStarted = false
  // join 이 끝나기 전에 끊으면 이미 정리된 방에 다시 publish 하지 않도록 leave 가 번호를 올린다(웹과 같은 장치)
  private generation = 0

  setHandlers(handlers: EngineHandlers) {
    this.handlers = handlers
  }

  get cameraFacing(): CameraFacing {
    return this.facing
  }

  // 내 카메라를 그릴 참조. 카메라가 꺼져 있으면 null
  get localCameraRef(): CallTrackRef | null {
    const room = this.room
    if (!room || !this.camTrack) return null
    const publication = room.localParticipant.getTrackPublication(Track.Source.Camera)
    return publication ? toTrackRef(room.localParticipant, publication) : null
  }

  // 말하는 중인지(0 또는 1). LiveKit 은 서버가 말하는 사람을 판정해 알려주므로 그 판정을 그대로 쓴다
  getVolumeLevels() {
    const room = this.room
    if (!room) return { me: 0, peer: 0 }
    let peer = 0
    for (const participant of room.remoteParticipants.values()) {
      if (participant.isSpeaking) peer = 1
    }
    return { me: room.localParticipant.isSpeaking ? 1 : 0, peer }
  }

  // 지금 방에 상대가 붙어 있는지. 이탈 이벤트가 재접속보다 늦게 올 수 있어 실제 목록으로 확인한다
  hasRemotePeer(): boolean {
    return (this.room?.remoteParticipants.size ?? 0) > 0
  }

  async join(session: CallSession, opts: { video: boolean }) {
    if (this.room) await this.leave()
    const gen = ++this.generation

    // 휴대폰 통화처럼 음성은 수화부로, 영상은 스피커로 시작한다. 이어폰·블루투스가 붙어 있으면 그쪽이 먼저다.
    // 방에 붙기 전에 설정해야 적용된다
    await AudioSession.configureAudio({
      android: {
        preferredOutputList: opts.video ? ['bluetooth', 'headset', 'speaker', 'earpiece'] : ['bluetooth', 'headset', 'earpiece', 'speaker'],
        audioTypeOptions: AndroidAudioTypePresets.communication,
      },
      ios: { defaultOutput: opts.video ? 'speaker' : 'earpiece' },
    })
    await AudioSession.startAudioSession()
    this.audioSessionStarted = true
    if (gen !== this.generation) return this.stopAudioSession()

    // adaptiveStream: 화면에 보이는 크기만큼만 받는다. dynacast: 아무도 보지 않는 화질은 보내지 않는다.
    // 서버를 직접 운영해 대역폭이 곧 비용이라 둘 다 켠다
    const room = new Room({ adaptiveStream: true, dynacast: true })
    this.room = room

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind !== Track.Kind.Video) return
      this.handlers.onRemoteVideo?.(sourceKind(publication.source), toTrackRef(participant, publication))
    })
    room.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
      if (track.kind !== Track.Kind.Video) return
      this.handlers.onRemoteVideo?.(sourceKind(publication.source), null)
    })
    room.on(RoomEvent.ParticipantConnected, () => this.handlers.onPeerJoined?.())
    room.on(RoomEvent.ParticipantDisconnected, () => this.handlers.onPeerLeft?.())
    room.on(RoomEvent.Disconnected, () => {
      // leave() 가 부른 disconnect 도 이 이벤트를 낸다. 그때는 generation 이 이미 올라가 있어 걸러진다
      if (gen !== this.generation || this.room !== room) return
      this.handlers.onDisconnected?.()
    })

    await room.connect(session.serverUrl, session.token)
    if (gen !== this.generation) return this.discard(room)

    // 마이크는 항상 먼저 잡는다. 음성으로 시작해도 나중에 카메라만 얹으면 되도록
    const mic = await createLocalAudioTrack()
    if (gen !== this.generation) {
      mic.stop()
      return this.discard(room)
    }
    this.micTrack = mic
    await room.localParticipant.publishTrack(mic)
    if (gen !== this.generation) return this.discard(room)

    if (opts.video) await this.setCamera(true)
  }

  // 접속 도중에 통화가 끝난 경우. leave() 가 이미 참조를 정리했을 수 있어 이 방이 아직 현재 것일 때만 비운다
  private async discard(room: Room) {
    if (this.room === room) {
      this.micTrack?.stop()
      this.micTrack = null
      this.room = null
    }
    await room.disconnect(true).catch(() => {})
    room.removeAllListeners()
  }

  private async stopAudioSession() {
    if (!this.audioSessionStarted) return
    this.audioSessionStarted = false
    await AudioSession.stopAudioSession().catch(() => {})
  }

  async setMic(on: boolean) {
    // 트랙을 내리지 않고 mute 만 한다. 껐다 켤 때마다 다시 publish 하면 소리가 끊긴다
    if (!this.micTrack) return
    if (on) await this.micTrack.unmute()
    else await this.micTrack.mute()
  }

  async setCamera(on: boolean) {
    const room = this.room
    if (!room) return
    if (on) {
      if (this.camTrack) return
      this.facing = 'user'
      const track = await createLocalVideoTrack({ facingMode: 'user' })
      // publish 가 실패해도 leave 에서 정리되도록 먼저 들고 있는다
      this.camTrack = track
      await room.localParticipant.publishTrack(track)
      return
    }
    if (this.camTrack) {
      // 카메라는 끌 때 트랙을 완전히 내린다. 송출만 끄면 카메라 사용 표시가 남는다
      const track = this.camTrack
      this.camTrack = null
      await room.localParticipant.unpublishTrack(track, true).catch(() => track.stop())
    }
  }

  // 휴대폰 앞·뒤 카메라 전환. 같은 트랙에서 장치만 다시 잡아 상대 화면이 끊기지 않는다
  // (VideoTrack 은 트랙이 다시 잡히면 알아서 새 영상으로 바꿔 그린다)
  async flipCamera(): Promise<CameraFacing> {
    if (!this.camTrack) return this.facing
    const next: CameraFacing = this.facing === 'user' ? 'environment' : 'user'
    await this.camTrack.restartTrack({ facingMode: next })
    this.facing = next
    return next
  }

  get screenSharing() {
    return this.screenTrack != null
  }

  // 안드로이드는 화면 캡처 권한 창(MediaProjection)과 화면공유용 포그라운드 서비스를 SDK 가 띄운다
  // (app.json 의 LiveKit 플러그인 enableScreenShareService). 서버의 화면공유 점유는 호출하는 쪽(callStore)이 먼저 잡는다
  async startScreen() {
    const room = this.room
    if (!room) throw new Error('통화에 연결된 뒤 화면을 공유할 수 있어요.')
    if (!canShareScreen()) throw new Error('이 기기에서는 화면 공유를 할 수 없어요.')
    if (this.screenTrack) await this.stopScreen()

    // 권한 창에서 거부하면 여기서 예외가 난다. publish 전이라 남는 것이 없다.
    // 화면 소리는 통화 소리와 겹쳐 울리기 쉬워 받지 않는다
    const tracks = await createLocalScreenTracks({ audio: false })
    const track = tracks.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined
    tracks.filter((t) => t !== track).forEach((t) => t.stop())
    if (!track) throw new Error('화면 공유를 시작하지 못했어요.')

    this.screenTrack = track
    track.on(TrackEvent.Ended, () => this.handlers.onScreenEnded?.())
    await room.localParticipant.publishTrack(track)
  }

  async stopScreen() {
    const track = this.screenTrack
    if (!track) return
    this.screenTrack = null
    track.removeAllListeners()
    if (this.room) await this.room.localParticipant.unpublishTrack(track, true).catch(() => track.stop())
    else track.stop()
  }

  // 지금 고를 수 있는 출력. 안드로이드는 SDK 가 실제로 붙어 있는 장치를 알려준다.
  // iOS 는 '스피커 강제'와 '시스템 기본'만 고를 수 있고, 기본이면 이어폰·블루투스가 있으면 그쪽, 없으면 수화부로 간다
  async availableOutputs(): Promise<AudioOutput[]> {
    if (Platform.OS !== 'android') return ['earpiece', 'speaker']
    const outputs = await AudioSession.getAudioOutputs().catch(() => [] as string[])
    return outputs.filter((o): o is AudioOutput => o === 'earpiece' || o === 'speaker' || o === 'headset' || o === 'bluetooth')
  }

  async setAudioOutput(output: AudioOutput) {
    if (!this.audioSessionStarted) return
    if (Platform.OS === 'android') await AudioSession.selectAudioOutput(output)
    else await AudioSession.selectAudioOutput(output === 'speaker' ? 'force_speaker' : 'default')
  }

  // 방에서 나오고 카메라·마이크를 놓는다
  async leave() {
    this.generation++
    await this.stopScreen()
    this.micTrack?.stop()
    this.camTrack?.stop()
    this.micTrack = null
    this.camTrack = null

    const room = this.room
    this.room = null
    if (room) {
      await room.disconnect(true).catch(() => {})
      room.removeAllListeners()
    }
    await this.stopAudioSession()
  }
}

export const callEngine = new CallEngine()