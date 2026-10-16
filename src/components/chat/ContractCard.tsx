import { useEffect, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import { colors, radius } from '@/constants/theme'
import { calculatePaymentFee } from '@/lib/paymentFee'
import { formatDotDate, formatDotDateTime } from '@/lib/date'
import { formatNumber } from '@/lib/http'
import { cardStyles, chatCardWidth } from './cardStyles'

// 계약 카드 전용 브라운 팔레트(#452B24 계열). 전역 contract 색(계약서 본문 남색)과는 별개로 시안을 따른다.

interface ContractCardBase {
  /** 내가 보낸 메시지인지 (보낸 쪽/받은 쪽 문구가 달라진다) */
  isSent: boolean
  price?: number | null
}

interface ProposeCardProps extends ContractCardBase {
  kind: 'propose'
  startDate?: string | null
  endDate?: string | null
  serviceContent?: string | null
  /** 보낸 쪽(을) 대기 카드에 표시할 전송 시각 */
  sentAt?: string | null
  /** 이 제안 이후에 체결 완료 메시지가 있으면 true. 대기 표시·서명 버튼을 걷는다 */
  settled?: boolean
  /** 받은 쪽(갑)만 검토·서명할 수 있다 */
  onReview?: () => void
}

interface CompletedCardProps extends ContractCardBase {
  kind: 'completed'
  contractUrl?: string | null
  /** 체결 시각 */
  signedAt?: string | null
  /** 결제는 계약을 등록한 갑이 한다 */
  onPay?: () => void
  /** 이 체결 이후에 결제 완료 메시지가 있으면 true. 결제 버튼을 걷어 중복 결제 진입을 막는다 */
  paid?: boolean
  onViewContract?: () => void
}

type ContractCardProps = ProposeCardProps | CompletedCardProps

function formatPrice(price?: number | null) {
  if (price === null || price === undefined || !Number.isFinite(price)) return null
  return `${formatNumber(price)}원`
}

function getPaymentFee(price?: number | null) {
  if (price === null || price === undefined || !Number.isSafeInteger(price) || price <= 0) return null
  return calculatePaymentFee(price)
}

// 금액 라벨 + 큰 숫자. 제안 카드는 왼쪽, 체결 카드는 가운데 정렬.
function PriceBlock({ value, center }: { value: string; center?: boolean }) {
  return (
    <View style={[styles.priceBlock, center && styles.center]}>
      <Text weight="medium" color={colors.zinc400} style={cardStyles.small}>
        계약 금액
      </Text>
      <Text weight="bold" color={colors.brown} style={center ? styles.priceCenter : styles.price}>
        {value}
      </Text>
    </View>
  )
}

// 상대방 확인을 기다리는 동안 점 세 개가 차례로 뛰고, 막대가 왼쪽에서 오른쪽으로 쓸고 지나간다(웹 애니메이션)
function WaitingIndicator() {
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.25)))
  const [sweep] = useState(() => new Animated.Value(0))

  useEffect(() => {
    const dotLoops = dots.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(value, { toValue: 1, duration: 480, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.25, duration: 720 - i * 0, useNativeDriver: true }),
        ]),
      ),
    )
    const sweepLoop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1800, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false }),
    )
    dotLoops.forEach((l) => l.start())
    sweepLoop.start()
    return () => {
      dotLoops.forEach((l) => l.stop())
      sweepLoop.stop()
    }
  }, [dots, sweep])

  const left = sweep.interpolate({ inputRange: [0, 1], outputRange: ['-30%', '100%'] })

  return (
    <>
      <View style={styles.waitingRow}>
        <View style={styles.dots}>
          {dots.map((value, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: value }]} />
          ))}
        </View>
        <Text size="xs" weight="semibold" color={colors.zinc700}>
          상대방의 확인을 기다리는 중
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.sweep, { left }]} />
      </View>
    </>
  )
}

function ViewContractButton({ onPress, variant }: { onPress?: () => void; variant: 'plain' | 'brown' }) {
  if (!onPress) return null
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'plain' ? styles.viewPlain : styles.viewBrown,
        variant === 'plain' && styles.viewPlainSize,
        pressed && (variant === 'plain' ? styles.viewPlainPressed : styles.viewBrownPressed),
      ]}
    >
      {({ pressed }) => (
        <>
          {variant === 'brown' ? <Ionicons name="document-text-outline" size={15} color={pressed ? colors.white : colors.brown} /> : null}
          <Text weight="semibold" color={variant === 'plain' ? colors.zinc700 : pressed ? colors.white : colors.brown} style={styles.buttonText}>
            계약서 보기
          </Text>
        </>
      )}
    </Pressable>
  )
}

// 계약서 제안 / 체결 완료 메시지를 말풍선 대신 카드로 보여준다.
export default function ContractCard(props: ContractCardProps) {
  const { width } = useWindowDimensions()
  const cardWidth = chatCardWidth(width)
  const formattedPrice = formatPrice(props.price)
  const paymentFee = getPaymentFee(props.price)

  if (props.kind === 'completed') {
    const signedDate = formatDotDate(props.signedAt)
    return (
      <View style={[cardStyles.card, styles.completedBorder, { width: cardWidth }]}>
        <View style={[cardStyles.hero, styles.brownHero]}>
          <View style={cardStyles.heroIcon}>
            <Ionicons name="checkmark" size={20} color={colors.white} />
          </View>
          <View style={cardStyles.heroTexts}>
            <Text size="sm" weight="bold" color={colors.white}>
              계약이 체결되었어요
            </Text>
            {signedDate ? (
              <Text color="rgba(255,255,255,0.6)" style={cardStyles.small}>
                {signedDate} 체결
              </Text>
            ) : null}
          </View>
        </View>

        <View style={cardStyles.body}>
          {formattedPrice ? <PriceBlock value={formattedPrice} center /> : null}

          {/* 체결 완료 메시지는 갑이 보내므로 수신자인 을에게만 결제 전 정산액을 안내한다. */}
          {!props.isSent && !props.paid && paymentFee ? (
            <View style={styles.settlement}>
              <Text weight="semibold" color={colors.brownText} style={cardStyles.small}>
                을 정산 예정 금액
              </Text>
              <Text size="lg" weight="bold" color={colors.brown}>
                {formatNumber(paymentFee.settlement)}원
              </Text>
              <Text color={colors.brownText} style={cardStyles.small}>
                결제 완료 후 플랫폼 수수료 {paymentFee.rate}% ({formatNumber(paymentFee.fee)}원)를 차감한 금액이 정산됩니다.
              </Text>
            </View>
          ) : null}

          <View style={styles.lockNote}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.brownMuted} />
            <Text color={colors.brownText} style={[cardStyles.caption, styles.flex]}>
              양측 서명이 완료되어 계약서가 보관되었습니다
            </Text>
          </View>

          {props.paid ? (
            // 결제까지 끝난 계약: 결제 화면으로 다시 들어가지 않도록 버튼 대신 완료 표시만 둔다
            <View style={styles.buttonRow}>
              <ViewContractButton onPress={props.onViewContract} variant="plain" />
              <View style={[styles.actionButton, styles.flex, styles.paidBadge]}>
                <Ionicons name="checkmark" size={15} color={colors.emerald700} />
                <Text weight="semibold" color={colors.emerald800} style={styles.buttonText}>
                  결제 완료
                </Text>
              </View>
            </View>
          ) : props.onPay ? (
            // 갑: 계약서 확인 + 결제
            <View style={styles.buttonRow}>
              <ViewContractButton onPress={props.onViewContract} variant="plain" />
              <Pressable onPress={props.onPay} style={({ pressed }) => [styles.actionButton, styles.flex, pressed ? styles.payPressed : styles.pay]}>
                <Ionicons name="card-outline" size={15} color={colors.white} />
                <Text weight="semibold" color={colors.white} style={styles.buttonText}>
                  결제하기
                </Text>
              </Pressable>
            </View>
          ) : (
            // 을: 결제를 기다리는 쪽
            <>
              <ViewContractButton onPress={props.onViewContract} variant="brown" />
              <Text color={colors.zinc400} align="center" style={cardStyles.small}>
                결제가 완료되면 알림으로 안내드려요
              </Text>
            </>
          )}
        </View>
      </View>
    )
  }

  const period = [formatDotDate(props.startDate), formatDotDate(props.endDate)].filter(Boolean).join(' ~ ')
  const sentAt = formatDotDateTime(props.sentAt)
  const muted = props.isSent || props.settled

  return (
    <View style={[cardStyles.card, styles.proposeBorder, { width: cardWidth }]}>
      {muted ? (
        // 을(보낸 쪽), 또는 이미 체결돼서 더 할 일이 없는 카드: 톤을 낮춘 헤더
        <View style={styles.mutedHeader}>
          <View style={styles.mutedIcon}>
            <Ionicons name="document-text-outline" size={14} color={colors.brown} />
          </View>
          <View style={styles.headerTexts}>
            <Text weight="semibold" color={colors.brown} style={styles.headerTitle}>
              {props.isSent ? '계약서를 보냈어요' : '계약서가 도착했어요'}
            </Text>
            <Text color={colors.brownMuted} style={cardStyles.small}>
              {props.settled ? '이미 체결된 계약이에요' : '상대방이 서명하면 계약이 체결돼요'}
            </Text>
          </View>
        </View>
      ) : (
        // 갑(받은 쪽): 행동이 필요한 상태라 헤더를 꽉 채운다
        <View style={styles.activeHeader}>
          <View style={styles.activeIcon}>
            <Ionicons name="document-text-outline" size={14} color={colors.white} />
          </View>
          <View style={styles.headerTexts}>
            <Text weight="semibold" color={colors.white} style={styles.headerTitle}>
              계약서가 도착했어요
            </Text>
            <Text color="rgba(255,255,255,0.6)" style={cardStyles.small}>
              서명하면 계약이 체결됩니다
            </Text>
          </View>
        </View>
      )}

      <View style={cardStyles.body}>
        {formattedPrice ? <PriceBlock value={formattedPrice} /> : null}

        {period || props.serviceContent ? (
          <>
            <View style={styles.dashed} />
            <View style={styles.details}>
              {period ? (
                <View style={styles.periodRow}>
                  <Ionicons name="calendar-outline" size={14} color={colors.zinc400} />
                  <Text size="xs" weight="medium" color={colors.zinc700}>
                    {period}
                  </Text>
                </View>
              ) : null}
              {props.serviceContent ? (
                <View style={styles.serviceBox}>
                  <Ionicons name="list-outline" size={14} color={colors.zinc400} />
                  <Text size="xs" color={colors.zinc600} numberOfLines={2} style={styles.flex}>
                    {props.serviceContent}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {props.settled ? (
          <View style={styles.settled}>
            <Ionicons name="checkmark" size={14} color={colors.brownMuted} />
            <Text size="xs" weight="semibold" color={colors.brownText}>
              체결 완료
            </Text>
          </View>
        ) : props.onReview ? (
          <Pressable onPress={props.onReview} style={({ pressed }) => [styles.actionButton, pressed ? styles.payPressed : styles.pay]}>
            <Text weight="semibold" color={colors.white} style={styles.buttonText}>
              계약서 확인하고 서명하기
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.white} />
          </Pressable>
        ) : (
          <View style={styles.waiting}>
            <WaitingIndicator />
            {sentAt ? (
              <Text color={colors.zinc400} style={cardStyles.small}>
                전송 {sentAt}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  completedBorder: { borderColor: colors.brownLine },
  proposeBorder: { borderColor: colors.line },
  brownHero: { backgroundColor: colors.brown },
  priceBlock: { gap: 2 },
  price: { fontSize: 24, lineHeight: 30 },
  priceCenter: { fontSize: 26, lineHeight: 32 },
  settlement: {
    gap: 4,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brownSoftLine,
    backgroundColor: colors.brownSurface,
  },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.brownSurface,
  },
  buttonRow: { flexDirection: 'row', gap: 8 },
  actionButton: {
    height: 44,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonText: { fontSize: 13.5, lineHeight: 18 },
  viewPlain: { borderWidth: 1, borderColor: colors.line },
  viewPlainSize: { flexBasis: '40%' },
  viewPlainPressed: { backgroundColor: colors.zinc50, borderColor: colors.zinc400 },
  viewBrown: { borderWidth: 1, borderColor: colors.brown },
  viewBrownPressed: { backgroundColor: colors.brown },
  paidBadge: { borderWidth: 1, borderColor: colors.emerald200, backgroundColor: colors.emerald50 },
  pay: { backgroundColor: colors.main },
  payPressed: { backgroundColor: colors.mainPressed },
  mutedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.brownSoftLine,
    backgroundColor: colors.brownSurfaceAlt,
  },
  mutedIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brownSoftLine,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.brown,
  },
  activeIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: { gap: 1 },
  headerTitle: { fontSize: 13, lineHeight: 18 },
  dashed: {
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.zinc200,
  },
  details: { gap: 10 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.zinc50,
  },
  settled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.brownSoftLine,
    backgroundColor: colors.brownSurface,
  },
  waiting: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.zinc50,
  },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brown },
  track: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.zinc200,
  },
  sweep: {
    position: 'absolute',
    top: 0,
    width: '30%',
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.brown,
  },
})
