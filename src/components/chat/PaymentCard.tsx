import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import { colors } from '@/constants/theme'
import { formatDotDate } from '@/lib/date'
import { formatNumber } from '@/lib/http'
import { cardStyles, chatCardWidth } from './cardStyles'

export interface ChatPayment {
  orderId: string
  orderName: string
  amount: number
  paymentHash?: string | null
  // 블록체인 트랜잭션 해시. 백엔드가 blockchainTxHash 로 주다가 txHash 로 바뀔 예정이라 둘 다 받아둔다
  blockchainTxHash?: string | null
  txHash?: string | null
}

// 백엔드가 결제 승인 시 만들어주는 PAYMENT 메시지를 카드로 보여준다.
// (계약 카드와 같은 톤을 쓰되, 결제는 되돌릴 수 없는 완료 상태라 초록 계열로 구분한다)
export default function PaymentCard({ payment, isSent, paidAt }: { payment: ChatPayment; isSent: boolean; paidAt?: string | null }) {
  const { width } = useWindowDimensions()
  const amount = payment.amount != null ? `${formatNumber(Number(payment.amount))}원` : null
  const paidDate = formatDotDate(paidAt)
  const txHash = payment.txHash ?? payment.blockchainTxHash

  return (
    <View style={[cardStyles.card, styles.border, { width: chatCardWidth(width) }]}>
      <View style={[cardStyles.hero, styles.hero]}>
        <View style={cardStyles.heroIcon}>
          <Ionicons name="checkmark" size={20} color={colors.white} />
        </View>
        <View style={cardStyles.heroTexts}>
          <Text size="sm" weight="bold" color={colors.white}>
            {isSent ? '결제를 완료했어요' : '결제가 완료됐어요'}
          </Text>
          {paidDate ? (
            <Text color="rgba(255,255,255,0.6)" style={cardStyles.small}>
              {paidDate} 결제
            </Text>
          ) : null}
        </View>
      </View>

      <View style={cardStyles.body}>
        <View style={styles.amountBlock}>
          <Text weight="medium" color={colors.zinc400} style={cardStyles.small}>
            결제 금액
          </Text>
          <Text weight="bold" color={colors.emerald800} style={styles.amount}>
            {amount ?? '-'}
          </Text>
        </View>

        {payment.orderName ? (
          <View style={styles.orderName}>
            <Ionicons name="card-outline" size={14} color={colors.emerald600} />
            <Text color={colors.emerald900} numberOfLines={2} style={[cardStyles.caption, styles.flex]}>
              {payment.orderName}
            </Text>
          </View>
        ) : null}

        {/* 블록체인에 기록된 결제는 그 사실을 함께 보여준다 */}
        {txHash ? (
          <View style={styles.chain}>
            <Ionicons name="cube-outline" size={12} color={colors.zinc400} />
            <Text color={colors.zinc400} style={cardStyles.small}>
              블록체인 기록 완료
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  border: { borderColor: colors.emerald200 },
  hero: { backgroundColor: colors.emerald700 },
  amountBlock: { alignItems: 'center', gap: 2 },
  amount: { fontSize: 26, lineHeight: 32 },
  orderName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: colors.emerald50,
    padding: 10,
  },
  chain: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
})
