import { useEffect, useState } from 'react'
import { Animated, BackHandler, Easing, Platform, Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RenderModeType, RtcSurfaceView, VideoMirrorModeType } from 'react-native-agora'
import Text from '@/components/ui/Text'
import { colors } from '@/constants/theme'
import { useAuthStore } from '@/store/authStore'
import { useCallStore } from '@/store/callStore'
import { participantsOf } from '@/lib/call'
import { toAbsoluteUrl } from '@/lib/file'
import { useSpeaking } from '@/hooks/useSpeaking'
import { useCallElapsed } from '@/hooks/useCallClock'
import CallButton from './CallButton'
import { callStatusText } from './callText'

const DEFAULT_PROFILE = require('@/assets/images/profile.webp')

// 벨이 울리는 동안 프로필 뒤로 퍼지는 고리(웹 animate-call-pulse)
export function CallPulse({ size, delay = 0, color = 'rgba(255,255,255,0.25)' }: { size: number; delay?: number; color?: string }) {
  const [progress] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [delay, progress])
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
      }}
    />
  )
}

type Tile = { key: 'screen' | 'peer' | 'me'; uid: number; label: string }

// 웹 call/CallOverlay. 통화 전체화면. 벨만 울릴 때는 화면을 덮지 않고(도크가 맡는다), 건 쪽·통화 중·영상이 붙었을 때 뜬다
export default function CallOverlay() {
  const insets = useSafeAreaInsets()
  const token = useAuthStore((s) => s.accessToken)
  const state = useCallStore()
  const { phase, call, myUsername, peerNameHint, peerImageUrl, micOn, camOn, speakerOn, screenOn, busy, remoteCamUid, remoteScreenUid, activeSince, peerReconnecting, expanded } =
    state
  const elapsed = useCallElapsed(phase === 'active' ? activeSince : null)
  const speaking = useSpeaking(phase === 'active')
  // 작은 창을 눌러 크게 본 영상. 없으면 기본 순서(화면공유 → 상대 카메라 → 내 카메라)
  const [focusKey, setFocusKey] = useState<Tile['key'] | null>(null)
  const visible = phase !== 'idle' && expanded

  // 전체화면에서 뒤로가기는 통화를 끊지 않고 작은 도크로 내린다
  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      useCallStore.getState().setExpanded(false)
      return true
    })
    return () => sub.remove()
  }, [visible])

  if (!visible) return null

  const peer = call ? participantsOf(call, myUsername).peer : null
  const peerName = peer?.name ?? peerNameHint ?? '상대방'
  const avatar = peerImageUrl ? { uri: toAbsoluteUrl(peerImageUrl) } : DEFAULT_PROFILE
  const ringing = phase === 'incoming' || phase === 'outgoing' || phase === 'connecting'
  const statusText = callStatusText(phase, call?.callType, peerReconnecting, elapsed)

  const tiles: Tile[] = []
  if (remoteScreenUid != null) tiles.push({ key: 'screen', uid: remoteScreenUid, label: '화면 공유' })
  if (remoteCamUid != null) tiles.push({ key: 'peer', uid: remoteCamUid, label: peerName })
  // 내 카메라는 uid 0 으로 그린다
  if (camOn) tiles.push({ key: 'me', uid: 0, label: '나' })
  const mainTile = tiles.find((tile) => tile.key === focusKey) ?? tiles[0] ?? null
  const pips = tiles.filter((tile) => tile !== mainTile)
  const isSpeaking = (key: Tile['key']) => (key === 'peer' && speaking.peer) || (key === 'me' && speaking.me)

  const act = (fn: (t: string) => Promise<void>) => () => {
    if (token) void fn(token)
  }

  return (
    <View style={styles.root}>
      {/* 어두운 통화 화면 위에서는 상태 표시줄 글자를 밝게 바꾼다(닫히면 앱 기본값으로 돌아간다) */}
      <StatusBar style="light" />
      {/* 배경: 상대 프로필을 크게 흐려 깔고 어둡게 덮는다 */}
      <View style={styles.background} pointerEvents="none">
        <Image source={avatar} style={[StyleSheet.absoluteFill, styles.backdropImage]} contentFit="cover" blurRadius={40} />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.flex}>
          {mainTile ? (
            <>
              <Text size="lg" weight="semibold" color={colors.white} numberOfLines={1}>
                {peerName}
              </Text>
              <Text size="xs" color="rgba(255,255,255,0.5)">
                {statusText}
              </Text>
            </>
          ) : null}
        </View>
        {phase === 'active' && peer && !peer.audioEnabled ? (
          <View style={styles.chip}>
            <MaterialIcons name="mic-off" size={14} color="rgba(255,255,255,0.7)" />
            <Text size="xs" color="rgba(255,255,255,0.7)">
              음소거됨
            </Text>
          </View>
        ) : null}
        {screenOn ? (
          <View style={[styles.chip, styles.chipOn]}>
            <MaterialIcons name="screen-share" size={14} color={colors.white} />
            <Text size="xs" color={colors.white}>
              내 화면 공유 중
            </Text>
          </View>
        ) : peer?.screenSharing ? (
          <View style={[styles.chip, styles.chipOn]}>
            <MaterialIcons name="screen-share" size={14} color={colors.white} />
            <Text size="xs" color={colors.white}>
              화면 공유 중
            </Text>
          </View>
        ) : null}
        {/* 영상을 보면서도 다른 화면을 봐야 할 때가 있다. 통화는 끊지 않고 도크로 내린다 */}
        <Pressable onPress={() => state.setExpanded(false)} accessibilityLabel="작게 보기" hitSlop={8} style={styles.minimize}>
          <MaterialIcons name="close-fullscreen" size={20} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      <View style={styles.stage}>
        {mainTile ? (
          <View style={[styles.mainVideo, isSpeaking(mainTile.key) && styles.speakingRing]}>
            {/* 가로·세로 영상이 섞여 오므로 큰 화면은 자르지 않고 전부 보여준다 */}
            <RtcSurfaceView
              key={`main-${mainTile.key}`}
              style={StyleSheet.absoluteFill}
              canvas={{
                uid: mainTile.uid,
                renderMode: RenderModeType.RenderModeFit,
                mirrorMode: mainTile.key === 'me' ? VideoMirrorModeType.VideoMirrorModeAuto : VideoMirrorModeType.VideoMirrorModeDisabled,
              }}
            />
            {pips.length > 0 ? (
              <View style={styles.pips}>
                {pips.map((pip) => (
                  <Pressable
                    key={pip.key}
                    onPress={() => setFocusKey(pip.key)}
                    accessibilityLabel={`${pip.label} 크게 보기`}
                    style={[styles.pip, isSpeaking(pip.key) && styles.speakingRingSmall]}
                  >
                    {/* 겹친 작은 영상이 큰 영상 아래로 숨지 않도록 위층에 그린다(안드로이드 SurfaceView) */}
                    <RtcSurfaceView
                      key={`pip-${pip.key}`}
                      zOrderMediaOverlay
                      style={StyleSheet.absoluteFill}
                      canvas={{
                        uid: pip.uid,
                        renderMode: pip.key === 'screen' ? RenderModeType.RenderModeFit : RenderModeType.RenderModeHidden,
                        mirrorMode: pip.key === 'me' ? VideoMirrorModeType.VideoMirrorModeAuto : VideoMirrorModeType.VideoMirrorModeDisabled,
                      }}
                    />
                    <View style={styles.pipLabel}>
                      <Text color={colors.white} style={styles.pipLabelText}>
                        {pip.label}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.profile}>
            <View style={styles.avatarWrap}>
              {ringing ? (
                <>
                  <CallPulse size={128} />
                  <CallPulse size={128} delay={800} />
                </>
              ) : null}
              <Image source={avatar} style={[styles.avatar, speaking.peer && styles.avatarSpeaking]} contentFit="cover" />
            </View>
            <View style={styles.profileTexts}>
              <Text size="2xl" weight="semibold" color={colors.white} align="center">
                {peerName}
              </Text>
              <Text size="sm" color="rgba(255,255,255,0.55)" align="center">
                {statusText}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 28 }]}>
        {phase === 'incoming' ? (
          <>
            <CallButton icon="call-end" label="거절" tone="danger" onPress={act(state.hangUp)} />
            <CallButton icon={call?.callType === 'VIDEO' ? 'videocam' : 'call'} label="수락" tone="accept" onPress={act(state.accept)} />
          </>
        ) : (
          <>
            <CallButton
              icon={micOn ? 'mic' : 'mic-off'}
              label={micOn ? '마이크' : '음소거'}
              tone={micOn ? 'normal' : 'off'}
              highlight={micOn && speaking.me}
              disabled={!call}
              onPress={act(state.toggleMic)}
            />
            {/* 음성으로 걸었어도 그냥 켜진다. 토큰에 영상 권한이 이미 들어 있다 */}
            <CallButton icon={camOn ? 'videocam' : 'videocam-off'} label="카메라" tone={camOn ? 'normal' : 'off'} disabled={!call || busy} onPress={act(state.toggleCam)} />
            {camOn ? <CallButton icon="cameraswitch" label="전환" disabled={busy} onPress={() => void state.flipCamera()} /> : null}
            {/* 안드로이드는 SDK 가 화면 캡처 권한·서비스를 맡아 바로 공유할 수 있다. iOS 는 방송 확장(ReplayKit)이 있어야 해서 아직 숨긴다.
                내 화면은 그리지 않는다 — 공유 중인 화면 안에 다시 그 화면이 비쳐 끝없이 겹친다 */}
            {Platform.OS === 'android' ? (
              <CallButton
                icon={screenOn ? 'stop-screen-share' : 'screen-share'}
                label="화면 공유"
                tone={screenOn ? 'on' : 'normal'}
                disabled={!call || busy || phase !== 'active' || (!!peer?.screenSharing && !screenOn)}
                onPress={act(state.toggleScreen)}
              />
            ) : null}
            {/* 웹 브라우저와 달리 휴대폰은 수화부·스피커를 고를 수 있다 */}
            <CallButton icon={speakerOn ? 'volume-up' : 'phone-in-talk'} label={speakerOn ? '스피커' : '수화부'} tone={speakerOn ? 'on' : 'normal'} onPress={state.toggleSpeaker} />
            <CallButton icon="call-end" label="종료" tone="danger" onPress={act(state.hangUp)} />
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 },
  flex: { flex: 1 },
  background: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: colors.callBackground },
  backdropImage: { opacity: 0.4 },
  dim: { backgroundColor: 'rgba(13,12,17,0.7)' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.4)' },
  chipOn: { backgroundColor: 'rgba(254,106,76,0.9)' },
  minimize: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
  mainVideo: { width: '100%', height: '100%', borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.5)' },
  speakingRing: { borderWidth: 4, borderColor: colors.main },
  pips: { position: 'absolute', top: 16, right: 16, gap: 12, alignItems: 'flex-end' },
  pip: { width: 108, height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.6)' },
  speakingRingSmall: { borderWidth: 3, borderColor: colors.main },
  pipLabel: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.5)' },
  pipLabelText: { fontSize: 11, lineHeight: 14 },
  profile: { alignItems: 'center', gap: 28 },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 128, height: 128, borderRadius: 64, borderWidth: 4, borderColor: 'rgba(255,255,255,0.15)' },
  avatarSpeaking: { borderColor: colors.main },
  profileTexts: { gap: 8 },
  // 영상·화면공유 버튼까지 여섯 개가 되면 좁은 휴대폰에서 넘쳐서 두 줄로 내린다
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', columnGap: 14, rowGap: 16, paddingHorizontal: 16 },
})
