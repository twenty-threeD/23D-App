import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Text from '@/components/ui/Text'
import Select from '@/components/ui/Select'
import InquiryButton from '@/components/item/InquiryButton'
import { colors, radius } from '@/constants/theme'
import { formatNumber } from '@/lib/http'
import { FALLBACK_PLAN, type PriceCardPlan } from '@/lib/priceCard'

interface PriceCardProps {
  username?: string
  plans?: PriceCardPlan[]
  postId?: number
  /** 문의하기 버튼 노출 여부. 결제 화면처럼 이미 문의를 마친 화면이나 하단 고정 바가 있는 화면에서는 끈다 */
  showInquiry?: boolean
  /** 지정하면 이 플랜만 보여준다. 결제 화면처럼 선택이 이미 끝난 경우에 쓴다 */
  selectedPlanName?: string | null
}

export default function PriceCard({ username, plans, postId, showInquiry = true, selectedPlanName }: PriceCardProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const allPlans = plans && plans.length > 0 ? plans : [FALLBACK_PLAN]
  // 선택이 끝난 화면에서는 고른 플랜만 남긴다. 이름이 안 맞으면 전체를 그대로 둔다.
  const picked = selectedPlanName ? allPlans.filter((p) => p.planName === selectedPlanName) : []
  const safePlans = picked.length > 0 ? picked : allPlans
  const showTabs = safePlans.length > 1
  const active = Math.min(activeIndex, safePlans.length - 1)
  const plan = safePlans[active]

  const displayPrice = plan.price ? `${formatNumber(Number(plan.price.replace(/,/g, '')))}원` : '가격 미정'

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {/* 시안은 탭 대신 드롭다운으로 플랜을 고른다. 플랜이 하나면 이름만 보여준다 */}
        {showTabs ? (
          <Select
            tone="main"
            align="center"
            title="플랜 선택"
            value={active}
            options={safePlans.map((p, i) => ({ label: p.planName || `플랜 ${i + 1}`, value: i }))}
            onChange={setActiveIndex}
          />
        ) : (
          <View style={styles.singlePlan}>
            <Text weight="medium" color={colors.main} numberOfLines={1}>
              {plan.planName || '기본 플랜'}
            </Text>
          </View>
        )}

        <View style={styles.priceBlock}>
          <Text size="xl" weight="semibold" style={styles.price}>
            {displayPrice}
          </Text>
          {plan.description || plan.items.length > 0 ? (
            <View style={styles.details}>
              {plan.description ? <Text weight="medium">{plan.description}</Text> : null}
              {plan.items.length > 0 ? (
                <View style={styles.items}>
                  {plan.items.map((item, i) => (
                    <View key={i} style={styles.itemRow}>
                      <Text weight="medium" color={colors.inkHint}>
                        •
                      </Text>
                      <Text weight="medium" color={colors.inkHint} style={styles.flex}>
                        {item.name}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {showInquiry ? <InquiryButton username={username} postId={postId} plans={safePlans} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
  },
  top: {
    gap: 26,
  },
  singlePlan: {
    height: 38,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.main,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  priceBlock: {
    gap: 20,
  },
  price: {
    paddingHorizontal: 10,
  },
  details: {
    gap: 8,
    paddingVertical: 4,
  },
  items: {
    gap: 2,
    paddingLeft: 8,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
})
