import { Pressable, ScrollView, StyleSheet } from 'react-native'
import Text from '@/components/ui/Text'
import { colors, radius } from '@/constants/theme'
import { COMMUNITY_CATEGORIES, type CommunityCategory } from '@/lib/community'

const CATEGORIES: { label: string; value: CommunityCategory | null }[] = [{ label: '전체', value: null }, ...COMMUNITY_CATEGORIES]

// 휴대폰에서는 웹 사이드바가 본문 위로 올라와 카테고리를 한 줄 가로 스크롤 탭으로 편다
export default function CategoryTabs({ value, onChange }: { value: CommunityCategory | null; onChange: (value: CommunityCategory | null) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {CATEGORIES.map((cat) => {
        const active = value === cat.value
        return (
          <Pressable key={cat.label} onPress={() => onChange(cat.value)} style={[styles.tab, active && styles.active]}>
            <Text weight="semibold" color={active ? colors.black : colors.zinc500}>
              {cat.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: 4 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.lg,
  },
  active: {
    backgroundColor: colors.zinc100,
  },
})
