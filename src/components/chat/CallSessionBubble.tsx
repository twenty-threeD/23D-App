import { Pressable, StyleSheet, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import { Avatar } from '@/components/PostImage'
import { CallPulse } from '@/components/call/CallOverlay'
import { colors, radius } from '@/constants/theme'
import { useAuthStore } from '@/store/authStore'
import { useCallStore } from '@/store/callStore'
import { useCallElapsed, formatCallDuration } from '@/hooks/useCallClock'

// 웹 chat/CallSessionBubble. 이 방에서 진행 중인 통화를 대화 흐름 안에 띄운다.
// 아직 통화 화면에 들어가지 않은 쪽이 이걸 눌러 들어간다(받는 쪽은 수락, 건 쪽은 전체화면).
// 실제 메시지가 아니라 살아 있는 통화라, 끊기면 사라지고 그 자리에 통화 기록 말풍선이 남는다
export default function CallSessionBubble({ peerName, peerImageUrl, isSent }: { peerName: string; peerImageUrl?: string | null; isSent: boolean }) {
  const token = useAuthStore((s) => s.accessToken)
  const phase = useCallStore((s) => s.phase)
  const call = useCallStore((s) => s.call)
  const micOn = useCallStore((s) => s.micOn)
  const activeSince = useCallStore((s) => s.activeSince)
  const elapsed = useCallElapsed(phase === 'active' ? activeSince : null)

  const isVideo = call?.callType === 'VIDEO'
  const incoming = phase === 'incoming'
  const kind = isVideo ? '영상 통화' : '음성 통화'
  const title = incoming ? `${kind} 요청` : phase === 'active' ? `${kind} 중` : `${kind} 연결 중`
  const subtitle = incoming ? `${peerName}님이 전화를 걸었어요` : phase === 'active' ? formatCallDuration(elapsed) : '상대방을 기다리는 중'

  const store = useCallStore.getState
  const enter = () => {
    if (incoming) {
      if (token) void store().accept(token)
      return
    }
    store().setExpanded(true)
  }

  const card = (
    <View style={[styles.card, isSent ? styles.sent : styles.received]}>
      {/* 전화가 왔을 때 제일 자연스러운 동작은 그 알림을 누르는 것이라 카드 본문을 눌러도 들어간다 */}
      <Pressable onPress={enter} style={styles.head}>
        <View style={styles.icon}>
          <MaterialIcons name={isVideo ? 'videocam' : 'call'} size={16} color={colors.white} />
        </View>
        <View style={styles.texts}>
          <Text size="sm" weight="medium">
            {title}
          </Text>
          <Text size="xs" color={colors.zinc400} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {!incoming ? <MaterialIcons name="open-in-full" size={14} color={colors.zinc400} /> : null}
      </Pressable>
      <View style={styles.actions}>
        {incoming ? (
          <>
            <Pressable onPress={enter} style={[styles.action, styles.accept]}>
              <MaterialIcons name="call" size={16} color={colors.white} />
              <Text size="sm" weight="semibold" color={colors.white}>
                받기
              </Text>
            </Pressable>
            <Pressable onPress={() => token && void store().hangUp(token)} style={[styles.action, styles.decline]}>
              <MaterialIcons name="call-end" size={16} color={colors.zinc600} />
              <Text size="sm" weight="semibold" color={colors.zinc600}>
                거절
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            {phase === 'active' ? (
              <Pressable
                onPress={() => token && void store().toggleMic(token)}
                accessibilityLabel={micOn ? '마이크 끄기' : '마이크 켜기'}
                style={[styles.mic, micOn ? styles.micOn : styles.micOff]}
              >
                <MaterialIcons name={micOn ? 'mic' : 'mic-off'} size={16} color={micOn ? colors.zinc600 : colors.white} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => token && void store().hangUp(token)} style={[styles.action, styles.end]}>
              <MaterialIcons name="call-end" size={16} color={colors.white} />
              <Text size="sm" weight="semibold" color={colors.white}>
                {phase === 'active' ? '종료' : '취소'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  )

  if (isSent) return <View style={styles.rowSent}>{card}</View>
  return (
    <View style={styles.rowReceived}>
      <View style={styles.avatarWrap}>
        {incoming ? <CallPulse size={36} color="rgba(254,106,76,0.3)" /> : null}
        <Avatar uri={peerImageUrl} size={36} />
      </View>
      {card}
    </View>
  )
}

const styles = StyleSheet.create({
  rowSent: { flexDirection: 'row', justifyContent: 'flex-end' },
  rowReceived: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  card: { gap: 12, maxWidth: 300, flexShrink: 1, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius['2xl'] },
  sent: { backgroundColor: colors.mainSoft, borderBottomRightRadius: 0 },
  received: { backgroundColor: colors.zinc100, borderBottomLeftRadius: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.main },
  texts: { flexShrink: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.xl },
  accept: { backgroundColor: colors.emerald500 },
  decline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  end: { backgroundColor: colors.red500 },
  mic: { width: 36, height: 36, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  micOn: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  micOff: { backgroundColor: colors.zinc800 },
})
