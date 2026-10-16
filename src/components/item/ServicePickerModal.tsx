import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Modal from '@/components/ui/Modal'
import Text from '@/components/ui/Text'
import { colors, radius } from '@/constants/theme'
import { formatNumber } from '@/lib/http'
import type { PriceCardPlan } from '@/lib/priceCard'

interface ServicePickerModalProps {
  plans: PriceCardPlan[]
  busy?: boolean
  onClose: () => void
  onSelect: (service: { planName: string; price: string }) => void
}

function PlanButton({ title, price, dashed, busy, onPress }: { title: string; price?: string; dashed?: boolean; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.option, dashed && styles.dashed, pressed && styles.pressed, busy && styles.busy]}
    >
      {({ pressed }) => (
        <>
          <View style={styles.optionText}>
            {dashed ? (
              <View style={styles.etc}>
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.zinc600} />
                <Text size="sm" weight="semibold" color={colors.zinc600}>
                  {title}
                </Text>
              </View>
            ) : (
              <Text size="sm" weight="semibold" numberOfLines={1}>
                {title}
              </Text>
            )}
            {price ? (
              <Text size="xs" color={colors.zinc500}>
                {price}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={pressed ? colors.main : colors.zinc300} />
        </>
      )}
    </Pressable>
  )
}

// 문의할 서비스(플랜)를 고른다. 고른 플랜은 채팅방 첫 안내 카드와 결제 화면에 쓰인다
export default function ServicePickerModal({ plans, busy, onClose, onSelect }: ServicePickerModalProps) {
  return (
    <Modal title="어떤 서비스가 궁금하세요?" onClose={onClose}>
      <Text size="sm" color={colors.zinc500}>
        문의하실 서비스를 선택해주세요.
      </Text>
      <View style={styles.list}>
        {plans.map((plan, i) => {
          const name = plan.planName || `플랜 ${i + 1}`
          const price = plan.price ? `${formatNumber(Number(plan.price.replace(/,/g, '')))}원~` : undefined
          return <PlanButton key={i} title={name} price={price} busy={busy} onPress={() => onSelect({ planName: name, price: plan.price })} />
        })}
        <PlanButton title="기타" dashed busy={busy} onPress={() => onSelect({ planName: '기타', price: '' })} />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dashed: {
    borderStyle: 'dashed',
  },
  pressed: {
    borderColor: colors.main,
    backgroundColor: colors.mainSoft,
  },
  busy: {
    opacity: 0.4,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  etc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})
