import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Text from '@/components/ui/Text'
import { Avatar } from '@/components/PostImage'
import { colors, PAGE_X } from '@/constants/theme'
import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
import { useNotificationStore } from '@/store/notificationStore'
import { getMyProfile } from '@/lib/profile'
import { SIGNIN_PATH } from '@/lib/navigation'

// 알림 벨. 새 알림이 오면 웹처럼 잠깐 흔들고, 안 읽은 알림이 있으면 점을 띄운다
function NotificationBell() {
  const count = useNotificationStore((s) => s.notifications.length)
  const [shake] = useState(() => new Animated.Value(0))
  const prevCount = useRef(count)

  useEffect(() => {
    // 늘었을 때만 흔든다. 읽어서 줄어든 건 새 알림이 아니다
    if (count > prevCount.current) {
      shake.setValue(0)
      Animated.timing(shake, { toValue: 1, duration: 600, useNativeDriver: true }).start()
    }
    prevCount.current = count
  }, [count, shake])

  const rotate = shake.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1],
    outputRange: ['0deg', '14deg', '-12deg', '10deg', '-8deg', '4deg', '0deg'],
  })

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityLabel={count > 0 ? `알림 ${count}개` : '알림'}
      style={({ pressed }) => [styles.bell, pressed && styles.bellPressed]}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons name="notifications-outline" size={21} color={colors.zinc600} />
      </Animated.View>
      {count > 0 ? <View style={styles.dot} /> : null}
    </Pressable>
  )
}

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
            <NotificationBell />
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
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellPressed: {
    backgroundColor: colors.zinc100,
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.main,
  },
  authLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
})
