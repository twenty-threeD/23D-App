import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Skeleton from '@/components/ui/Skeleton'
import PostImage from '@/components/PostImage'
import { colors, radius } from '@/constants/theme'
import { getPostMainImage, type Post } from '@/lib/post'
import { parsePostContent } from '@/lib/priceCard'
import { formatNumber } from '@/lib/http'

// 가로 스크롤 줄에서는 시안 폭(260px)을 그대로 쓰고, 목록 그리드(inGrid)에서는 두 칸에 맞춰 늘린다(웹 cardClasses)
const ROW = { width: 260, height: 360, imageHeight: 180 }

export function formatStartPrice(price?: string | null) {
  if (!price) return null
  const n = Number(String(price).replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? `${formatNumber(n)}원 ~` : null
}

export function ServiceCardSkeleton({ inGrid = false }: { inGrid?: boolean }) {
  return (
    <View style={[styles.root, inGrid ? styles.gridRoot : styles.rowRoot]}>
      <View style={styles.top}>
        {inGrid ? (
          <View style={styles.gridImage}>
            <Skeleton height="100%" radius={radius.xl} />
          </View>
        ) : (
          <Skeleton height={ROW.imageHeight} radius={radius.xl} />
        )}
        <View style={styles.texts}>
          <Skeleton width="75%" height={inGrid ? 16 : 20} />
          <Skeleton width="100%" height={12} />
          <Skeleton width="80%" height={12} />
        </View>
      </View>
      <Skeleton height={inGrid ? 32 : 36} radius={radius.lg} />
    </View>
  )
}

interface ServiceCardProps {
  post: Post
  inGrid?: boolean
}

export default function ServiceCard({ post, inGrid = false }: ServiceCardProps) {
  const { description, plans } = parsePostContent(post.content)
  const price = formatStartPrice(plans[0]?.price)

  return (
    <View style={[styles.root, inGrid ? styles.gridRoot : styles.rowRoot]}>
      <Pressable onPress={() => router.push(`/item/${post.id}`)} style={styles.top} accessibilityRole="link">
        <PostImage
          uri={getPostMainImage(post.fileUrls)}
          style={[styles.image, inGrid ? styles.gridImage : { height: ROW.imageHeight }]}
        />
        <View style={styles.texts}>
          <Text size={inGrid ? 'base' : 'xl'} weight="semibold" color={colors.ink} numberOfLines={1}>
            {post.title}
          </Text>
          <View style={styles.meta}>
            <View style={styles.rating}>
              <Ionicons name="star" size={inGrid ? 12 : 14} color={colors.main} />
              {/* 웹과 같이 아직 평점 요약 API 가 없어 0.0 으로 둔다 */}
              <Text size={inGrid ? 'xs' : 'sm'} color={colors.inkSub}>
                {(0).toFixed(1)}
              </Text>
            </View>
            {price ? (
              <Text size={inGrid ? 'xs' : 'sm'} weight="medium" color={colors.ink} numberOfLines={1}>
                {price}
              </Text>
            ) : null}
          </View>
          <Text size={inGrid ? 'sm' : 'base'} weight="medium" color={colors.inkSub} numberOfLines={2}>
            {description || post.content}
          </Text>
        </View>
      </Pressable>
      {post.category ? (
        <Pressable
          // 웹은 메인을 이 카테고리로 걸렀다. 앱의 메인은 탭 첫 화면이라 거르면 돌아갈 홈이 사라져,
          // 같은 카테고리만 모아 보여주는 능력자 찾기로 보낸다
          onPress={() => router.navigate({ pathname: '/search', params: { categoryId: String(post.category!.id) } })}
          style={({ pressed }) => [styles.more, inGrid && styles.gridMore, pressed && styles.morePressed]}
        >
          <Text size={inGrid ? 'xs' : 'base'} weight="medium" color={colors.ink} numberOfLines={1}>
            {post.category.name} 관련 더보기
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    justifyContent: 'space-between',
  },
  rowRoot: {
    width: ROW.width,
    height: ROW.height,
  },
  // 웹 그리드는 한 줄의 카드가 같은 높이로 늘어나 '관련 더보기' 버튼이 맞춰진다. 그리드 칸을 꽉 채워 같은 효과를 낸다
  gridRoot: {
    flex: 1,
    gap: 12,
  },
  top: {
    gap: 16,
  },
  image: {
    borderRadius: radius.xl,
  },
  gridImage: {
    aspectRatio: 13 / 9,
    width: '100%',
  },
  texts: {
    gap: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  more: {
    height: 36,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  gridMore: {
    height: 32,
  },
  morePressed: {
    backgroundColor: colors.zinc50,
  },
})
