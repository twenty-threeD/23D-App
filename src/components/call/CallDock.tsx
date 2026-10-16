import { Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Text from '@/components/ui/Text'
import { colors, radius } from '@/constants/theme'
import { useAuthStore } from '@/store/authStore'
import { useCallStore } from '@/store/callStore'
import { useChatRoomsStore } from '@/store/chatRoomsStore'
import { participantsOf } from '@/lib/call'
import { toAbsoluteUrl } from '@/lib/file'
import { useSpeaking } from '@/hooks/useSpeaking'
import { useCallElapsed } from '@/hooks/useCallClock'
import CallButton from './CallButton'
import { CallPulse } from './CallOverlay'
import { callStatusText } from './callText'

const DEFAULT_PROFILE = require('@/assets/images/profile.webp')
// 하단 탭 바(64) 위로 띄운다
const TAB_BAR_HEIGHT = 64

// 웹 call/CallDock. 통화의 기본 자리로, 화면 아래쪽에 작게 떠서 벨이 울리는 동안에도 하던 일을 가리지 않는다.
// 웹은 끌어서 옮길 수 있었지만 휴대폰은 화면이 좁아 하단에 고정한다
export default function CallDock() {
  const insets = useSafeAreaInsets()
  const token = useAuthStore((s) => s.accessToken)
  const state = useCallStore()
  const { phase, call, myUsername, peerNameHint, peerImageUrl, micOn, camOn, busy, expanded, activeSince, peerReconnecting } = state
  const speaking = useSpeaking(phase === 'active')
  const elapsed = useCallElapsed(phase === 'active' ? activeSince : null)
  // 그 방을 보고 있으면 대화 흐름 안의 카드가 대신 맡는다
  const activeRoomId = useChatRoomsStore((s) => s.activeRoomId)

  if (phase === 'idle' || expanded) return null
  if (call && activeRoomId === call.roomId) return null

  const peer = call ? participantsOf(call, myUsername).peer : null
  const peerName = peer?.name ?? peerNameHint ?? '상대방'
  const avatar = peerImageUrl ? { uri: toAbsoluteUrl(peerImageUrl) } : DEFAULT_PROFILE
  const incoming = phase === 'incoming'
  const act = (fn: (t: string) => Promise<void>) => () => {
    if (token) void fn(token)
  }

  return (
    <View style={[styles.dock, { bottom: insets.bottom + TAB_BAR_HEIGHT + 12 }]}>
      <Pressable onPress={incoming ? undefined : () => state.setExpanded(true)} style={styles.head} accessibilityLabel="크게 보기">
        <View style={styles.avatarWrap}>
          {incoming ? <CallPulse size={48} color="rgba(255,255,255,0.2)" /> : null}
          <Image source={avatar} style={[styles.avatar, speaking.peer && styles.avatarSpeaking]} contentFit="cover" />
        </View>
        <View style={styles.texts}>
          <Text size="sm" weight="semibold" color={colors.white} numberOfLines={1}>
            {peerName}
          </Text>
          <Text size="xs" color="rgba(255,255,255,0.5)">
            {callStatusText(phase, call?.callType, peerReconnecting, elapsed)}
          </Text>
        </View>
        {!incoming ? <MaterialIcons name="open-in-full" size={18} color="rgba(255,255,255,0.6)" /> : null}
      </Pressable>

      <View style={styles.buttons}>
        {incoming ? (
          <>
            <CallButton icon="call-end" label="거절" tone="danger" size="sm" showLabel={false} onPress={act(state.hangUp)} />
            <CallButton icon={call?.callType === 'VIDEO' ? 'videocam' : 'call'} label="받기" tone="accept" size="sm" showLabel={false} onPress={act(state.accept)} />
          </>
        ) : (
          <>
            <CallButton
              icon={micOn ? 'mic' : 'mic-off'}
              label={micOn ? '마이크' : '음소거'}
              tone={micOn ? 'normal' : 'off'}
              size="sm"
              showLabel={false}
              highlight={micOn && speaking.me}
              disabled={!call}
              onPress={act(state.toggleMic)}
            />
            <CallButton icon={camOn ? 'videocam' : 'videocam-off'} label="카메라" tone={camOn ? 'normal' : 'off'} size="sm" showLabel={false} disabled={!call || busy} onPress={act(state.toggleCam)} />
            <CallButton icon="call-end" label="종료" tone="danger" size="sm" showLabel={false} onPress={act(state.hangUp)} />
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 90,
    elevation: 12,
    gap: 16,
    padding: 20,
    borderRadius: radius['2xl'],
    backgroundColor: colors.callDock,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  avatarSpeaking: { borderWidth: 3, borderColor: colors.main },
  texts: { flex: 1, gap: 2 },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
})
