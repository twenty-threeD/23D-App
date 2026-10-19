import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import Text from '@/components/ui/Text'
import CardRow from '@/components/main/CardRow'
import ServiceCard, { ServiceCardSkeleton } from '@/components/main/ServiceCard'
import { colors, PAGE_X } from '@/constants/theme'
import type { Post } from '@/lib/post'

// 메인과 서비스 상세 하단이 같은 카드 줄 시안을 써서 한 곳으로 모았다

// 웹은 모든 더보기가 '이웃들이 많이 찾아요' 목록으로 가서, 광고에서 눌러도 다른 제목이 떴다.
// 어느 줄에서 눌렀는지 넘겨 더보기 화면 제목을 그 줄과 맞춘다
export type MoreSection = 'ad' | 'popular' | 'revisit'

export function MoreLink({ section }: { section: MoreSection }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/more', params: { section } })} hitSlop={8}>
      <Text size="sm" weight="medium" color={colors.inkMuted} style={styles.underline}>
        더보기
      </Text>
    </Pressable>
  )
}

export function Empty() {
  return (
    <Text size="sm" color={colors.inkMuted} style={styles.empty}>
      등록된 항목이 없습니다
    </Text>
  )
}

// 휴대폰 시안은 카드 위에 한 줄 제목과 더보기를 나란히 둔다
export function SectionTitle({ title, section }: { title: string; section: MoreSection }) {
  return (
    <View style={styles.titleRow}>
      <Text size="2xl" weight="bold" color={colors.ink}>
        {title}
      </Text>
      <MoreLink section={section} />
    </View>
  )
}

export default function ServiceSection({
  title,
  section,
  loading,
  posts,
}: {
  title: string
  section: MoreSection
  loading: boolean
  posts: Post[]
}) {
  return (
    <View style={styles.section}>
      <SectionTitle title={title} section={section} />
      {loading ? (
        <CardRow itemWidth={260} gap={36}>
          {Array.from({ length: 3 }).map((_, i) => (
            <ServiceCardSkeleton key={i} />
          ))}
        </CardRow>
      ) : posts.length > 0 ? (
        <CardRow itemWidth={260} gap={36}>
          {posts.map((post) => (
            <ServiceCard key={post.id} post={post} />
          ))}
        </CardRow>
      ) : (
        <View style={styles.inset}>
          <Empty />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: PAGE_X,
  },
  inset: {
    paddingHorizontal: PAGE_X,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  empty: {
    paddingVertical: 40,
  },
})
