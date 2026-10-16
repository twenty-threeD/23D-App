import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import { colors, radius } from '@/constants/theme'
import { describeCallLog, type CallLog } from '@/lib/callLog'

// 통화가 끝나면 채팅에 남는 기록. 별도 카드가 아니라 말풍선 자리에 들어가므로
// 라운드·최대폭·보낸쪽 색을 일반 말풍선과 똑같이 맞춘다.
// 말풍선 위치(isSent)와 문구 기준(iAmCaller)이 다를 수 있어 따로 받는다.
// onCall 을 넘기면 카드를 눌러 같은 종류(음성·영상)로 다시 걸 수 있다. 부재중 전화에 바로 회신하는 용도다
export default function CallLogCard({ log, isSent, iAmCaller, onCall }: { log: CallLog; isSent: boolean; iAmCaller: boolean; onCall?: () => void }) {
  const { width } = useWindowDimensions()
  const { title, detail, missed } = describeCallLog(log, iAmCaller)
  const icon = missed ? 'call-end' : log.callType === 'VIDEO' ? 'videocam' : 'call'

  return (
    <Pressable
      onPress={onCall}
      disabled={!onCall}
      accessibilityLabel={onCall ? `${log.callType === 'VIDEO' ? '영상' : '음성'} 통화 다시 걸기` : undefined}
      style={({ pressed }) => [
        styles.bubble,
        { maxWidth: Math.min(320, width * 0.62) },
        isSent ? styles.sent : styles.received,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconCircle, isSent ? styles.iconSent : missed ? styles.iconMissed : styles.iconReceived]}>
        <MaterialIcons name={icon} size={16} color={isSent ? colors.white : missed ? colors.red500 : colors.zinc500} />
      </View>
      <View style={styles.texts}>
        <Text size="sm" weight="medium" color={isSent ? colors.white : missed ? colors.red500 : colors.black}>
          {title}
        </Text>
        {detail ? (
          <Text size="xs" color={isSent ? 'rgba(255,255,255,0.7)' : colors.zinc400}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius['2xl'],
  },
  sent: { backgroundColor: colors.main, borderBottomRightRadius: 0 },
  received: { backgroundColor: colors.zinc100, borderBottomLeftRadius: 0 },
  pressed: { opacity: 0.85 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSent: { backgroundColor: 'rgba(255,255,255,0.2)' },
  iconMissed: { backgroundColor: colors.red50 },
  iconReceived: { backgroundColor: colors.white },
  texts: { gap: 2, flexShrink: 1 },
})
