import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Text from '@/components/ui/Text'
import { colors } from '@/constants/theme'

interface FieldLabelProps {
  children: string
  essential?: boolean
  /** 오른쪽 끝에 붙는 보조 정보(글자 수 등) */
  aside?: ReactNode
}

// 서비스 등록 폼의 항목 이름(웹 write/WriteInputField 의 FieldLabel). 필수 항목은 브랜드색 별표를 붙인다
export default function FieldLabel({ children, essential, aside }: FieldLabelProps) {
  return (
    <View style={styles.row}>
      <View style={styles.label}>
        <Text size="lg" weight="semibold" color={colors.ink}>
          {children}
        </Text>
        {essential ? (
          <Text size="xl" weight="semibold" color={colors.main}>
            *
          </Text>
        ) : null}
      </View>
      {aside}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
})
