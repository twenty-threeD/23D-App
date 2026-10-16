import { Pressable, StyleSheet, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import Text from '@/components/ui/Text'
import { colors } from '@/constants/theme'

type IconName = keyof typeof Ionicons.glyphMap

// 웹 BottomNav 와 같은 순서·아이콘이다. 엄지가 닿기 쉬운 가운데에 서비스 등록을 두고,
// 자주 여는 커뮤니티·능력자 찾기를 앞에 둔다. 지금 있는 메뉴는 채운 아이콘, 나머지는 선 아이콘으로 구분한다
// 서비스 등록은 탭이 아니라 작성 화면을 위에 띄운다(href). 긴 입력 폼이라 탭 바와 키보드가 겹치지 않고,
// 등록을 마치면 작성 화면을 상세로 바꿔 뒤로가기로 원래 보던 탭에 돌아온다
export const TAB_ITEMS: { name: string; label: string; on: IconName; off: IconName; href?: Href }[] = [
  { name: 'community', label: '커뮤니티', on: 'people', off: 'people-outline' },
  { name: 'search', label: '능력자 찾기', on: 'search', off: 'search-outline' },
  { name: 'upload', label: '서비스 등록', on: 'add-circle', off: 'add-circle-outline', href: '/upload' },
  { name: 'chat', label: '채팅', on: 'chatbubbles', off: 'chatbubbles-outline' },
  { name: 'blockchain', label: '블록체인 검증', on: 'shield-checkmark', off: 'shield-checkmark-outline' },
]

export default function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const activeName = state.routes[state.index]?.name

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {TAB_ITEMS.map((item) => {
        if (item.href) {
          const href = item.href
          return (
            <Pressable key={item.name} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => router.push(href)} style={styles.item}>
              <Ionicons name={item.off} size={22} color={colors.zinc400} />
              <Text weight="medium" color={colors.zinc400} style={styles.label} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          )
        }
        const route = state.routes.find((r) => r.name === item.name)
        if (!route) return null
        // 메인(index)은 탭에 없다. 메인에 있을 때는 어느 탭도 켜지 않는다 (웹 모바일과 같다)
        const active = activeName === item.name
        const color = active ? colors.main : colors.zinc400
        return (
          <Pressable
            key={item.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!active && !event.defaultPrevented) navigation.navigate(route.name, route.params)
            }}
            style={styles.item}
          >
            <Ionicons name={active ? item.on : item.off} size={22} color={color} />
            <Text weight="medium" color={color} style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  item: {
    flex: 1,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    lineHeight: 13,
  },
})
