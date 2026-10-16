import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import { colors, radius } from '@/constants/theme'
import { formatDotDate } from '@/lib/date'
import { formatNumber } from '@/lib/http'
import { cardStyles, chatCardWidth } from './cardStyles'

type DealCardProps =
  | {
      // 결제 후 갑이 직접 완료를 누르던 예전 방식의 카드. 이제 완료는 결제로 바로 정해지므로
      // 지난 대화에 남은 카드를 그릴 때만 쓰고, 누를 버튼 없이 그 방의 결과만 보여준다
      kind: 'request'
      orderName?: string
      amount?: number
      ended: 'completed' | 'canceled'
    }
  | {
      kind: 'completed' | 'canceled'
      /** 내가 끝낸 쪽인지. 문구가 달라진다 */
      isSent: boolean
      endedAt?: string | null
    }

// 결제 카드와 같은 골격을 쓰고 상태별로 색만 바꾼다.
// 완료는 결제와 같은 초록 계열, 취소는 되돌릴 수 없는 종료라 무채색으로 구분한다.
export default function DealCard(props: DealCardProps) {
  const { width } = useWindowDimensions()
  const cardWidth = chatCardWidth(width)

  if (props.kind === 'request') {
    const amount = props.amount != null ? `${formatNumber(Number(props.amount))}원` : null
    return (
      <View style={[cardStyles.card, styles.requestBorder, { width: cardWidth }]}>
        <View style={[cardStyles.hero, styles.requestHero]}>
          <View style={cardStyles.heroIcon}>
            <Ionicons name="bag-check-outline" size={20} color={colors.white} />
          </View>
          <Text size="sm" weight="bold" color={colors.white}>
            작업을 받으셨나요?
          </Text>
        </View>
        <View style={cardStyles.body}>
          {amount ? (
            <View style={styles.center}>
              <Text weight="medium" color={colors.zinc400} style={cardStyles.small}>
                거래 금액
              </Text>
              <Text weight="bold" color={colors.zinc800} style={styles.amount}>
                {amount}
              </Text>
            </View>
          ) : null}
          {props.orderName ? (
            <View style={styles.orderName}>
              <Ionicons name="bag-check-outline" size={14} color={colors.main} />
              <Text color={colors.zinc700} numberOfLines={2} style={[cardStyles.caption, styles.flex]}>
                {props.orderName}
              </Text>
            </View>
          ) : null}
          <View style={styles.ended}>
            <Text size="xs" weight="semibold" color={colors.zinc500}>
              {props.ended === 'completed' ? '완료된 거래예요' : '취소된 거래예요'}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  const completed = props.kind === 'completed'
  const date = formatDotDate(props.endedAt)
  const title = completed
    ? props.isSent
      ? '거래를 완료했어요'
      : '거래가 완료됐어요'
    : props.isSent
      ? '거래를 취소했어요'
      : '상대방이 거래를 취소했어요'

  return (
    <View style={[cardStyles.card, completed ? styles.completedBorder : styles.canceledBorder, { width: cardWidth }]}>
      <View style={[cardStyles.hero, completed ? styles.completedHero : styles.canceledHero]}>
        <View style={cardStyles.heroIcon}>
          <Ionicons name={completed ? 'checkmark' : 'close'} size={20} color={colors.white} />
        </View>
        <View style={cardStyles.heroTexts}>
          <Text size="sm" weight="bold" color={colors.white}>
            {title}
          </Text>
          {date ? (
            <Text color="rgba(255,255,255,0.6)" style={cardStyles.small}>
              {date} {completed ? '완료' : '취소'}
            </Text>
          ) : null}
        </View>
      </View>
      {/* 거래가 끝나도 채팅은 막지 않는다. 같은 글로 다시 문의하면 이 방에서 새 거래를 이어간다 */}
      <View style={styles.footer}>
        <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.zinc400} />
        <Text color={colors.zinc500} style={cardStyles.caption}>
          대화는 이어서 할 수 있어요
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  requestBorder: { borderColor: colors.orange200 },
  requestHero: { backgroundColor: colors.main },
  completedBorder: { borderColor: colors.emerald200 },
  canceledBorder: { borderColor: colors.line },
  completedHero: { backgroundColor: colors.emerald700 },
  canceledHero: { backgroundColor: colors.zinc700 },
  center: { alignItems: 'center', gap: 2 },
  amount: { fontSize: 26, lineHeight: 32 },
  orderName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: colors.orange50,
    padding: 10,
  },
  ended: {
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.zinc50,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
  },
  flex: { flex: 1 },
})
