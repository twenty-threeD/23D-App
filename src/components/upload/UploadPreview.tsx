import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import PostImage from '@/components/PostImage'
import { colors, radius } from '@/constants/theme'
import { formatNumber } from '@/lib/http'

interface UploadPreviewProps {
  imageUrl?: string
  title: string
  description: string
  price?: string
}

// 웹 write/Preview. 메인의 가로 카드 줄과 같은 폭(260)으로 그려 목록에서 어떻게 보일지 미리 보여준다
export default function UploadPreview({ imageUrl, title, description, price = '' }: UploadPreviewProps) {
  const digits = price.replace(/[^0-9]/g, '')
  const displayPrice = digits ? `${formatNumber(Number(digits))}원 ~` : '가격을 입력해주세요.'

  return (
    <View style={styles.container}>
      <Text size="xl" weight="bold">
        미리보기
      </Text>
      <View style={styles.card}>
        {imageUrl ? (
          <PostImage uri={imageUrl} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.empty]}>
            <Text size="sm" color={colors.inkMuted}>
              사진을 업로드 해주세요.
            </Text>
          </View>
        )}
        <View style={styles.texts}>
          <Text size="xl" weight="bold" numberOfLines={2}>
            {title || '제목을 입력해주세요.'}
          </Text>
          <View style={styles.meta}>
            <View style={styles.rating}>
              <Ionicons name="star" size={14} color={colors.main} />
              {/* 새 글은 아직 리뷰가 없으므로 0.0 대신 시안처럼 '-' 로 보여준다 */}
              <Text size="sm" color={colors.inkSub}>
                - (0)
              </Text>
            </View>
            <Text size="sm" weight="medium" color={colors.ink} numberOfLines={1} style={styles.shrink}>
              {displayPrice}
            </Text>
          </View>
        </View>
        <Text weight="medium" color={colors.inkSub} numberOfLines={2}>
          {description || '본문을 입력해주세요.'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 24 },
  card: { width: 260, gap: 16 },
  image: { width: '100%', height: 180, borderRadius: radius.xl },
  empty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.zinc100 },
  texts: { gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
})
