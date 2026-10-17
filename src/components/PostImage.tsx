import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Image, type ImageContentFit } from 'expo-image'
import { colors } from '@/constants/theme'
import { toAbsoluteUrl } from '@/lib/file'

const NO_IMAGE = require('@/assets/images/no-image.png')
const DEFAULT_PROFILE = require('@/assets/images/profile.webp')

interface PostImageProps {
  uri: string | null | undefined
  style?: StyleProp<ViewStyle>
  contentFit?: ImageContentFit
  /** 서비스 이미지가 없을 때 대체 이미지를 띄울지. 끄면 회색 칸만 남는다 */
  fallback?: boolean
}

// 서비스(post) 이미지. 이미지가 없으면 대체 이미지를 띄운다.
// 빈 회색 칸만 두면 아직 불러오는 중인지 이미지가 없는 건지 구분이 안 된다(웹과 같은 이유).
// 대체 이미지는 가운데 아이콘·문구가 있어 꽉 채우면 잘리므로 원본 비율로 가운데 둔다
export default function PostImage({ uri, style, contentFit = 'cover', fallback = true }: PostImageProps) {
  const source = uri ? { uri: toAbsoluteUrl(uri) } : fallback ? NO_IMAGE : null
  return (
    <View style={[styles.box, !uri && fallback && styles.noImageBox, style]}>
      {source ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit={uri ? contentFit : 'contain'}
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  )
}

// 프로필 사진. 없으면 기본 프로필
export function Avatar({ uri, size, style }: { uri: string | null | undefined; size: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {/* 기본 프로필(로컬 에셋)로 먼저 그려졌다가 정보가 늦게 와서 원격 주소로 바뀌면 안드로이드에서 새로 불러오지 않고
          기본 그림이 남는다(딥링크로 채팅방에 바로 들어올 때). 주소가 바뀌면 이미지를 새로 만들게 한다 */}
      <Image
        key={uri ?? 'default'}
        source={uri ? { uri: toAbsoluteUrl(uri) } : DEFAULT_PROFILE}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    backgroundColor: colors.zinc200,
  },
  // 대체 이미지 양옆이 비므로 그 이미지 바탕색(#f4f4f4)과 거의 같은 색으로 이어 붙인다
  noImageBox: {
    backgroundColor: '#F5F5F5',
  },
  avatar: {
    overflow: 'hidden',
    backgroundColor: colors.zinc100,
  },
})
