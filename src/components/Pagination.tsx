import { Pressable, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import { colors, radius } from '@/constants/theme'

// 번호 페이지 (웹 CommunityPagination). 한 페이지뿐이면 그리지 않는다
export default function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {page > 1 ? (
        <Pressable onPress={() => onChange(page - 1)} accessibilityLabel="이전 페이지" style={styles.cell}>
          <Ionicons name="chevron-back" size={16} color={colors.zinc500} />
        </Pressable>
      ) : null}
      {pages.map((p) => (
        <Pressable key={p} onPress={() => onChange(p)} style={[styles.cell, p === page && styles.active]} accessibilityState={{ selected: p === page }}>
          <Text size="sm" weight="semibold" color={p === page ? colors.white : colors.zinc500}>
            {p}
          </Text>
        </Pressable>
      ))}
      {page < totalPages ? (
        <Pressable onPress={() => onChange(page + 1)} accessibilityLabel="다음 페이지" style={styles.cell}>
          <Ionicons name="chevron-forward" size={16} color={colors.zinc500} />
        </Pressable>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: 4, paddingVertical: 16, flexGrow: 1, justifyContent: 'center' },
  cell: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: colors.main },
})
