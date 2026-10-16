import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Text from '@/components/ui/Text'
import { colors } from '@/constants/theme'

interface PageIntroProps {
  /** 제목 위 영문 머리말(ITDA POLICY 등) */
  kicker: string
  title: string
  intro?: string
  /** 소개 아래에 붙는 시행일 등 */
  children?: ReactNode
}

// 약관·자주 묻는 질문·문서·팀원 소개 화면 맨 위의 머리말. 웹 이 페이지들의 <header> 와 같은 모양이다
export default function PageIntro({ kicker, title, intro, children }: PageIntroProps) {
  return (
    <View style={styles.header}>
      <Text size="sm" weight="bold" color={colors.main} style={styles.kicker}>
        {kicker}
      </Text>
      <Text size="3xl" weight="bold" color={colors.zinc900} style={styles.title}>
        {title}
      </Text>
      {intro ? (
        <Text size="sm" color={colors.zinc500} style={styles.intro}>
          {intro}
        </Text>
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { gap: 12, paddingBottom: 32, borderBottomWidth: 1, borderBottomColor: colors.line },
  // 웹 tracking-wide / tracking-tight
  kicker: { letterSpacing: 0.4 },
  title: { letterSpacing: -0.75 },
  intro: { lineHeight: 24 },
})
