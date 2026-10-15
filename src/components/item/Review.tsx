import { StyleSheet, View } from 'react-native'
import Text from '@/components/ui/Text'
import StarRating from '@/components/StarRating'
import { Avatar } from '@/components/PostImage'
import { colors } from '@/constants/theme'
import { parseDate } from '@/lib/date'
import type { Review as ReviewData } from '@/lib/review'

function maskName(name: string) {
  if (name.length <= 1) return name
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

// 시안이 날짜 대신 "1달전" 같은 상대 시간으로 표기한다
function formatRelative(value?: string | null) {
  const time = parseDate(value)
  if (Number.isNaN(time)) return null
  const minutes = Math.floor((Date.now() - time) / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일전`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}달전`
  return `${Math.floor(months / 12)}년전`
}

export default function Review({ review }: { review: ReviewData }) {
  const authorName = review.author?.name || review.author?.username || '익명 사용자'
  const meta = [review.categoryName, formatRelative(review.createdAt)].filter(Boolean).join(' • ')

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.author}>
          <Avatar uri={review.author?.imageUrl} size={52} />
          <View style={styles.authorText}>
            <Text size="xs" weight="medium" color={colors.inkSub}>
              {maskName(authorName)}
            </Text>
            {meta ? (
              <Text weight="medium" color={colors.inkSub} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.rating}>
          <StarRating rating={review.rating} />
          <Text size="xl" weight="medium">
            {review.rating.toFixed(1)}
          </Text>
        </View>
      </View>
      <Text size="xl" style={styles.content}>
        {review.content}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  authorText: {
    gap: 4,
    flexShrink: 1,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  content: {
    lineHeight: 25,
  },
})
