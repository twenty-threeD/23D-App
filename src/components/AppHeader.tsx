import { Pressable, StyleSheet, View } from 'react-native'
import { useEffect } from 'react'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Text from '@/components/ui/Text'
import { Avatar } from '@/components/PostImage'
import { colors, PAGE_X } from '@/constants/theme'
import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
import { getMyProfile } from '@/lib/profile'
import { SIGNIN_PATH } from '@/lib/navigation'

// 탭 화면 위쪽 머리줄. 웹 모바일 헤더처럼 로고·로그인/프로필만 두고 메뉴는 하단 탭으로 옮겼다
export default function AppHeader({ right }: { right?: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  const token = useAuthStore((s) => s.accessToken)
  const profileImageUrl = useProfileStore((s) => s.imageUrl)
  const profileLoaded = useProfileStore((s) => s.loaded)
  const setProfileImageUrl = useProfileStore((s) => s.setImageUrl)

  useEffect(() => {
    if (!token || profileLoaded) return
    getMyProfile(token)
      .then((res) => setProfileImageUrl(res.data.imageUrl ?? null))
      .catch(() => {})
  }, [token, profileLoaded, setProfileImageUrl])

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        {/* logo.png 는 글자 영역이 파일의 92x46 이라 시안의 40x20 에 맞추려면 파일 전체를 42x28 로 둔다 (웹과 같은 크기) */}
        <Pressable onPress={() => router.navigate('/')} hitSlop={8} accessibilityLabel="잇다 홈">
          <Image source={require('@/assets/images/logo.png')} style={styles.logo} contentFit="contain" />
        </Pressable>

        {token ? (
          <View style={styles.right}>
            {right}
            <Pressable
              onPress={() => router.push('/profile')}
              accessibilityLabel="프로필"
              style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarPressed]}
            >
              <Avatar uri={profileImageUrl} size={34} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.authLinks}>
            <Pressable onPress={() => router.push(SIGNIN_PATH)} hitSlop={6}>
              <Text size="sm" weight="medium" color="#A3A3A3">
                로그인
              </Text>
            </Pressable>
            <Text size="sm" weight="medium" color="#A3A3A3">
              |
            </Text>
            <Pressable onPress={() => router.push('/login/signup')} hitSlop={6}>
              <Text size="sm" weight="medium" color="#A3A3A3">
                회원가입
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  bar: {
    height: 60,
    paddingHorizontal: PAGE_X,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
  },
  logo: {
    width: 42,
    height: 28,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  avatarPressed: {
    borderColor: colors.main,
  },
  authLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
})
