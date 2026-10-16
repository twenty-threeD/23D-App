import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '@/constants/theme'
import Text from './Text'

export interface SelectOption<T extends string | number> {
  label: string
  value: T
}

interface SelectProps<T extends string | number> {
  value: T | null | undefined
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  /** 목록 시트 위에 띄울 제목 */
  title?: string
  disabled?: boolean
  /** 웹의 브랜드색 테두리 드롭다운(가격 카드 플랜 선택 등) */
  tone?: 'default' | 'main'
  align?: 'left' | 'center'
  style?: StyleProp<ViewStyle>
}

// 웹의 <select> 를 대신한다. 앱에는 기본 드롭다운이 없어 아래에서 올라오는 목록으로 고르게 한다
export default function Select<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = '선택',
  title,
  disabled = false,
  tone = 'default',
  align = 'left',
  style,
}: SelectProps<T>) {
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  const isMain = tone === 'main'

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={title ?? placeholder}
        style={[styles.field, isMain && styles.fieldMain, disabled && styles.disabled, style]}
      >
        <Text
          size="sm"
          weight={isMain ? 'medium' : 'regular'}
          color={isMain ? colors.main : selected ? colors.black : colors.zinc400}
          numberOfLines={1}
          style={[styles.label, align === 'center' && styles.centerLabel]}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={isMain ? colors.main : colors.inkSub} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessible={false} />
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
                      setOpen(false)
                      onChange(option.value)
                    }}
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  >
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
    </>
  )
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  fieldMain: {
    borderColor: colors.main,
    minHeight: 38,
  },
  disabled: {
    backgroundColor: colors.zinc100,
    opacity: 0.6,
  },
  label: {
    flex: 1,
  },
  centerLabel: {
    textAlign: 'center',
  },
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
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionPressed: {
    backgroundColor: colors.zinc50,
  },
})
