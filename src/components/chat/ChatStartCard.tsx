import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import PostImage from '@/components/PostImage'
import { colors, radius } from '@/constants/theme'
import { formatNumber } from '@/lib/http'

interface ChatStartCardProps {
  postId?: number | null
  postTitle?: string | null
  imageUrl?: string | null
  /** 대화 상대 이름 */
  partnerName?: string | null
  /** 문의할 때 고른 서비스 플랜 */
  planName?: string | null
  price?: string | null
}

function formatPrice(price?: string | null) {
  if (!price) return null
  const digits = price.replace(/[^0-9]/g, '')
  if (!digits) return null
  return `${formatNumber(Number(digits))}원`
}

// 문의하기로 채팅방이 만들어질 때 한 번 깔리는 안내 카드.
// 말풍선이 아니라 "잇다가 보낸 시스템 안내"로 읽히도록 상단에 발신 라벨을 둔다.
export default function ChatStartCard({ postId, postTitle, imageUrl, partnerName, planName, price }: ChatStartCardProps) {
  const formattedPrice = formatPrice(price)

  return (
    <View style={styles.card}>
      <View style={styles.label}>
        <Ionicons name="chatbubble-outline" size={14} color={colors.zinc400} />
        <Text color={colors.zinc400} weight="medium" style={styles.labelText}>
          잇다 시스템 안내
        </Text>
      </View>

      <View style={styles.body}>
        <PostImage uri={imageUrl} style={styles.image} />
        <View style={styles.texts}>
          <Text color={colors.zinc700} style={styles.intro}>
            {partnerName ? `${partnerName}님과 ` : ''}
            <Text weight="semibold" color={colors.zinc900} style={styles.intro}>
              {postTitle ?? '이 서비스'}
            </Text>
            에 대한 이야기를 시작해보세요.
          </Text>
          <View style={styles.meta}>
            {planName ? (
              <View style={styles.plan}>
                <Text weight="medium" color={colors.zinc600} numberOfLines={1} style={styles.planText}>
                  {planName}
                </Text>
              </View>
            ) : null}
            {formattedPrice ? (
              <Text size="lg" weight="bold" color={colors.zinc900}>
                {formattedPrice}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {postId ? (
        <Pressable onPress={() => router.push(`/item/${postId}`)} style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
          <Text weight="semibold" color={colors.zinc600} style={styles.linkText}>
            상품상세 보기
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.zinc600} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.zinc50,
  },
  labelText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  body: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  texts: {
    flex: 1,
    gap: 10,
  },
  intro: {
    fontSize: 14.5,
    lineHeight: 23,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  plan: {
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.zinc100,
  },
  planText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  linkPressed: {
    backgroundColor: colors.zinc50,
  },
  linkText: {
    fontSize: 13,
    lineHeight: 18,
  },
})
