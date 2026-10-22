import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Skeleton from '@/components/ui/Skeleton'
import PostImage from '@/components/PostImage'
import { colors } from '@/constants/theme'
import { getPostMainImage, type Post } from '@/lib/post'
import { parsePostContent } from '@/lib/priceCard'
import { usePostAverageRating } from '@/hooks/usePostAverageRating'

export function AdCardSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.card, { width }]}>
      <Skeleton height={160} radius={0} />
      <View style={styles.body}>
        <Skeleton width={160} height={16} />
        <Skeleton height={12} />
        <Skeleton width="75%" height={12} />
      </View>
    </View>
  )
}

// 광고 줄 카드. 휴대폰에서는 한 장이 화면 폭의 85% 를 차지한다(웹 w-[min(360px,85vw)])
export default function AdCard({ post, width }: { post: Post; width: number }) {
  const description = parsePostContent(post.content).description || post.content
  const average = usePostAverageRating(post.id)

  return (
    <Pressable
      onPress={() => router.push(`/item/${post.id}`)}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
      accessibilityRole="link"
    >
      <PostImage uri={getPostMainImage(post.fileUrls)} style={styles.image} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text size="base" weight="semibold" color={colors.ink} numberOfLines={1} style={styles.title}>
            {post.title}
          </Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={14} color={colors.main} />
            <Text size="sm" color={colors.inkSub}>
              {average.toFixed(1)}
            </Text>
          </View>
        </View>
        <Text size="sm" weight="medium" color={colors.inkSub} numberOfLines={4}>
          {description}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    height: 300,
    borderRadius: 10,
    backgroundColor: '#F7F7F7',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
  },
  image: {
    height: 160,
  },
  body: {
    gap: 8,
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
})
