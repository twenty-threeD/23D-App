import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import TextField from '@/components/ui/TextField'
import { colors, radius } from '@/constants/theme'
import { confirm } from '@/lib/dialog'
import { DEFAULT_PLAN, MAX_PLANS, type PriceCardItem, type PriceCardPlan } from '@/lib/priceCard'
import { formatPriceInput, toPriceDigits } from '@/lib/amount'

function PlanField({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.planField}>
      <View style={styles.planFieldHead}>
        <Text size="sm" weight="semibold" color={colors.ink}>
          {label}
        </Text>
        {aside}
      </View>
      {children}
    </View>
  )
}

function SinglePlanEditor({ plan, onChange }: { plan: PriceCardPlan; onChange: (plan: PriceCardPlan) => void }) {
  function update(partial: Partial<PriceCardPlan>) {
    onChange({ ...plan, ...partial })
  }

  function updateItem(index: number, partial: Partial<PriceCardItem>) {
    update({ items: plan.items.map((item, i) => (i === index ? { ...item, ...partial } : item)) })
  }

  return (
    <View style={styles.planBody}>
      <PlanField label="플랜 이름">
        <TextField value={plan.planName} onChangeText={(v) => update({ planName: v })} placeholder="예) 에어컨 청소(1회 기준)" />
      </PlanField>

      <PlanField label="최소 가격">
        <TextField
          value={formatPriceInput(plan.price)}
          // 상태에는 콤마 없는 숫자 문자열만 저장한다 (직렬화 형식 유지)
          onChangeText={(v) => {
            const digits = toPriceDigits(v)
            if (digits !== null) update({ price: digits })
          }}
          placeholder="최소 가격을 입력해주세요."
          keyboardType="number-pad"
          right={
            <Text size="sm" color={colors.inkHint}>
              원
            </Text>
          }
        />
      </PlanField>

      <PlanField label="플랜 설명">
        <TextField
          value={plan.description}
          onChangeText={(v) => update({ description: v })}
          placeholder="예 ) 실외기, 실내기 고압 세척 & 필터 교체 & 세척"
          multiline
        />
      </PlanField>

      <PlanField
        label="포함 항목"
        aside={
          <Pressable onPress={() => update({ items: [...plan.items, { name: '', included: true }] })} hitSlop={8}>
            <Text size="xs" weight="medium" color={colors.main}>
              + 항목 추가
            </Text>
          </Pressable>
        }
      >
        {plan.items.length > 0 ? (
          <View style={styles.items}>
            {plan.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <TextField value={item.name} onChangeText={(v) => updateItem(i, { name: v })} placeholder="항목명" containerStyle={styles.flex} />
                <Pressable
                  onPress={() => update({ items: plan.items.filter((_, index) => index !== i) })}
                  hitSlop={8}
                  accessibilityLabel={`항목 ${i + 1} 삭제`}
                  style={styles.iconButton}
                >
                  <Ionicons name="close" size={16} color={colors.inkMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </PlanField>
    </View>
  )
}

function hasContent(plan: PriceCardPlan) {
  return !!(plan.planName.trim() || plan.price || plan.description.trim() || plan.items.length > 0)
}

interface PriceCardEditorProps {
  plans: PriceCardPlan[]
  onChange: (plans: PriceCardPlan[]) => void
}

// 웹 write/PriceCardEditor. 서비스 플랜을 최대 3개까지 탭으로 나눠 편집한다
export default function PriceCardEditor({ plans, onChange }: PriceCardEditorProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const safePlans = plans.length > 0 ? plans : [DEFAULT_PLAN]
  const active = Math.min(activeIndex, safePlans.length - 1)

  function addPlan() {
    if (safePlans.length >= MAX_PLANS) return
    onChange([...safePlans, { ...DEFAULT_PLAN }])
    setActiveIndex(safePlans.length)
  }

  async function removePlan(index: number) {
    if (safePlans.length <= 1) return
    // 웹은 마우스를 올려야 삭제 버튼이 보였지만 앱은 늘 보여서, 잘못 눌러 입력한 내용을 잃지 않게 한 번 묻는다
    if (hasContent(safePlans[index]) && !(await confirm(`플랜 ${index + 1}을 삭제할까요?`, { confirmText: '삭제', destructive: true }))) return
    const next = safePlans.filter((_, i) => i !== index)
    onChange(next)
    setActiveIndex((prev) => Math.max(0, Math.min(prev, next.length - 1)))
  }

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <Text size="lg" weight="semibold" color={colors.ink}>
          서비스 플랜
        </Text>
        <Pressable onPress={addPlan} disabled={safePlans.length >= MAX_PLANS} hitSlop={8}>
          <Text size="xs" weight="medium" color={safePlans.length >= MAX_PLANS ? colors.inkMuted : colors.main}>
            + 플랜 추가 ({safePlans.length}/{MAX_PLANS})
          </Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {safePlans.map((_, i) => {
          const selected = i === active
          return (
            <View key={i} style={[styles.tab, selected && styles.tabActive]}>
              <Pressable onPress={() => setActiveIndex(i)} hitSlop={{ top: 8, bottom: 4 }} style={styles.tabButton}>
                {/* 탭 폭이 시안상 고정이라, 긴 플랜 이름 대신 번호로 표시한다 */}
                <Text weight="semibold" color={selected ? colors.main : colors.inkMuted}>
                  플랜 {i + 1}
                </Text>
              </Pressable>
              {safePlans.length > 1 && selected ? (
                <Pressable onPress={() => void removePlan(i)} hitSlop={8} accessibilityLabel={`플랜 ${i + 1} 삭제`}>
                  <Ionicons name="close" size={14} color={colors.inkMuted} />
                </Pressable>
              ) : null}
            </View>
          )
        })}
      </View>

      {/* 플랜을 바꾸면 입력칸을 새로 그린다. 같은 칸을 재사용하면 앞 플랜에서 잡은 포커스·커서가 다음 플랜으로 따라온다 */}
      <SinglePlanEditor
        key={active}
        plan={safePlans[active]}
        onChange={(nextPlan) => onChange(safePlans.map((p, i) => (i === active ? nextPlan : p)))}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // 활성 탭의 밑줄이 전체 구분선 위에 겹쳐 보이도록 탭 줄 전체에 구분선을 깔고 활성 탭만 굵게 덮는다
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    // 구분선(1px) 위에 활성 밑줄(2px)이 겹치도록 1px 내린다
    bottom: -1,
  },
  tabActive: { borderBottomColor: colors.main },
  tabButton: { paddingTop: 2 },
  planBody: { gap: 16 },
  planField: { gap: 8 },
  planFieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  items: { gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  iconButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
})
