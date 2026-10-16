import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import Text from '@/components/ui/Text'
import Skeleton from '@/components/ui/Skeleton'
import PostImage from '@/components/PostImage'
import { colors, radius } from '@/constants/theme'
import { toRelativeUrl } from '@/lib/file'

function extractFirstImage(text: string): string | undefined {
  const match = text.match(/!\[.*?\]\((.*?)\)/)
  return match ? match[1] : undefined
}

// 목록 미리보기에는 마크다운 기호를 걷어낸 본문만 보여준다
export function stripMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .trim()
}

interface PostItemProps {
  id: number
  title: string
  content: string
  imageUrl?: string | null
  createdAt: string
}

export function PostItemSkeleton() {
  return (
    <View style={styles.item}>
      <View style={styles.top}>
        <View style={styles.texts}>
          <Skeleton width="60%" height={20} />
          <Skeleton height={14} />
          <Skeleton width="75%" height={14} />
        </View>
        <Skeleton width={80} height={80} radius={radius.lg} />
      </View>
      <View style={styles.dateRow}>
        <Skeleton width={80} height={14} />
      </View>
    </View>
  )
}

// 휴대폰은 폭이 좁아 사진이 없는 글까지 자리를 비워두면 제목이 잘게 꺾인다. 사진이 있을 때만 작게 둔다(웹과 같다)
export default function PostItem({ id, title, content = '', imageUrl, createdAt }: PostItemProps) {
  const thumbnail = toRelativeUrl(imageUrl) || extractFirstImage(content)

  return (
    <Pressable onPress={() => router.push(`/posts/${id}`)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <View style={styles.top}>
        <View style={styles.texts}>
          <Text size="lg" weight="bold" numberOfLines={2}>
            {title}
          </Text>
          <Text color={colors.zinc500} numberOfLines={2}>
            {stripMarkdown(content)}
          </Text>
        </View>
        {thumbnail ? <PostImage uri={thumbnail} style={styles.thumbnail} fallback={false} /> : null}
      </View>
      <View style={styles.dateRow}>
        <Text size="sm" weight="semibold" color={colors.zinc500}>
          {createdAt}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  item: {
    gap: 8,
    paddingVertical: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  texts: {
    flex: 1,
    gap: 8,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
  },
  dateRow: {
    alignItems: 'flex-end',
  },
})
