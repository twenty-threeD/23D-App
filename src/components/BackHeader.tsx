import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Text from '@/components/ui/Text'
import { colors } from '@/constants/theme'

interface BackHeaderProps {
  title?: string
  right?: ReactNode
  /** 뒤로 갈 곳이 없을 때(알림·딥링크로 바로 들어온 경우) 대신 갈 곳 */
  fallbackHref?: string
  onBack?: () => void
}

// 탭 밖 화면(상세·작성·결제 등)의 머리줄. 웹의 '뒤로가기' 버튼을 상단 고정 줄로 옮겼다
export default function BackHeader({ title, right, fallbackHref = '/', onBack }: BackHeaderProps) {
  const insets = useSafeAreaInsets()

  function goBack() {
    if (onBack) return onBack()
    if (router.canGoBack()) router.back()
    else router.replace(fallbackHref as never)
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable onPress={goBack} hitSlop={8} accessibilityLabel="뒤로가기" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text size="base" weight="semibold" color={colors.ink} numberOfLines={1} style={styles.title}>
          {title ?? ''}
        </Text>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  right: {
    minWidth: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingRight: 8,
  },
})
