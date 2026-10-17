import type { ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '@/constants/theme'
import Text from './Text'

export interface SheetOption<T extends string | number> {
  label: string
  value: T
  icon?: ReactNode
}

interface OptionSheetProps<T extends string | number> {
  visible: boolean
  options: SheetOption<T>[]
  value: T | null | undefined
  onSelect: (value: T) => void
  onClose: () => void
  title?: string
}

// 아래에서 올라오는 선택 목록. Select 의 펼친 목록이고, 버튼이 따로 있는 곳(통화 소리 출력 등)에서도 같은 모양으로 쓴다
export default function OptionSheet<T extends string | number>({ visible, options, value, onSelect, onClose, title }: OptionSheetProps<T>) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          {title ? (
            <Text size="base" weight="bold" style={styles.sheetTitle}>
              {title}
            </Text>
          ) : null}
          <ScrollView style={styles.list}>
            {options.map((option) => {
              const active = option.value === value
              return (
                <Pressable
                  key={String(option.value)}
                  onPress={() => {
                    onClose()
                    onSelect(option.value)
                  }}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                >
                  {option.icon}
                  <Text size="base" weight={active ? 'semibold' : 'regular'} color={active ? colors.main : colors.ink} style={styles.label}>
                    {option.label}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.main} /> : null}
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backdrop,
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: 16,
  },
  sheetTitle: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionPressed: {
    backgroundColor: colors.zinc50,
  },
  label: {
    flex: 1,
  },
})
