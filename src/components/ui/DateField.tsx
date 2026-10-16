import { useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '@/constants/theme'
import { formatContractDate } from '@/lib/contractDocument'
import Button from './Button'
import Text from './Text'

// 'YYYY-MM-DD' 문자열 ↔ Date. 시간대 때문에 하루가 밀리지 않게 기기 시간 자정으로 만든다
function parseYmd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface DateFieldProps {
  /** 'YYYY-MM-DD'. 웹 <input type="date"> 의 값과 같은 형식이라 계약 데이터에 그대로 실린다 */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

// 웹의 <input type="date">. 안드로이드는 시스템 날짜 선택 창을, iOS 는 아래에서 올라오는 달력을 띄운다
export default function DateField({ value, onChange, placeholder = '날짜를 선택해주세요', disabled = false }: DateFieldProps) {
  const insets = useSafeAreaInsets()
  const [iosDraft, setIosDraft] = useState<Date | null>(null)
  const date = parseYmd(value)

  function open() {
    if (disabled) return
    const initial = date ?? new Date()
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: initial, mode: 'date', onValueChange: (_event, picked) => onChange(toYmd(picked)) })
      return
    }
    setIosDraft(initial)
  }

  return (
    <>
      <Pressable
        onPress={open}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        style={[styles.field, disabled && styles.disabled]}
      >
        <Text size="sm" color={disabled ? colors.zinc500 : date ? colors.black : colors.zinc400} style={styles.label}>
          {date ? formatContractDate(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={16} color={colors.inkSub} />
      </Pressable>

      {iosDraft ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setIosDraft(null)}>
          <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIosDraft(null)} accessible={false} />
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
              <DateTimePicker value={iosDraft} mode="date" display="inline" locale="ko-KR" onValueChange={(_event, picked) => setIosDraft(picked)} />
              <Button
                onPress={() => {
                  onChange(toYmd(iosDraft))
                  setIosDraft(null)
                }}
              >
                확인
              </Button>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  // TextField 와 같은 테두리·높이
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
  disabled: { backgroundColor: colors.zinc100 },
  label: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sheet: {
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
  },
})
