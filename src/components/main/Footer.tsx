import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import { colors, PAGE_X, radius } from '@/constants/theme'

const LINK_GROUPS: { title: string; links: { label: string; href: Href }[] }[] = [
  {
    title: '빠른 링크',
    links: [
      { label: '프로젝트 소개', href: '/about' },
      { label: '커뮤니티', href: '/community' },
      { label: '팀원 소개', href: '/team' },
      // 블록체인 설명 전용 페이지가 아직 없어 문서 페이지로 보낸다(웹과 같다)
      { label: '블록체인', href: '/docs' },
    ],
  },
  {
    title: '문의 • 지원',
    links: [
      { label: '문서', href: '/docs' },
      { label: '자주 묻는 질문', href: '/faq' },
      { label: '개인정보처리방침', href: '/privateinfo' },
      { label: '이용약관', href: '/eula' },
    ],
  },
]

const SOCIAL_LINKS: { label: string; href: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: '인스타그램', href: 'https://www.instagram.com/idta.blockchain/', icon: 'logo-instagram' },
  { label: '깃허브', href: 'https://github.com/twenty-threeD/', icon: 'logo-github' },
]

// 웹 Footer. 앱에는 페이지 하단이 따로 없어 메인 맨 아래에 둔다. 약관·개인정보처리방침을 로그인 없이도 열 수 있는 자리다.
// 웹에 없던 '자주 묻는 질문' 은 웹에선 문서 페이지를 거쳐 들어가지만, 앱은 한 번이라도 덜 누르게 바로 둔다
export default function Footer() {
  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        {/* 헤더와 같은 logo.png. 글자 영역(92x46)이 시안의 60x30 이 되도록 파일 전체를 63x42 로 둔다(웹과 같은 크기) */}
        <Image source={require('@/assets/images/logo.png')} style={styles.logo} contentFit="contain" accessibilityLabel="잇다" />
        <View style={styles.brandTexts}>
          <Text size="sm" color={colors.zinc400}>
            필요한 순간, 필요한 능력자를 찾을 수 있는,{'\n'}블록체인 기반 용역 중개 플랫폼, 잇다 입니다.
          </Text>
          <Text size="xs" color={colors.zinc400}>
            Copyright © 2026 ITDA. All rights reserved.
          </Text>
        </View>
      </View>

      <View style={styles.groups}>
        {LINK_GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text size="xl" weight="semibold" color={colors.inkSub}>
              {group.title}
            </Text>
            <View style={styles.links}>
              {group.links.map((link) => (
                <Pressable
                  key={link.label}
                  // 커뮤니티는 탭이라 새로 쌓지 않고 그 탭으로 넘어간다
                  onPress={() => router.navigate(link.href)}
                  hitSlop={6}
                >
                  {({ pressed }) => (
                    <Text size="xs" weight="medium" color={pressed ? colors.main : colors.zinc400}>
                      {link.label}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.socials}>
        {SOCIAL_LINKS.map((social) => (
          <Pressable
            key={social.label}
            onPress={() => void Linking.openURL(social.href).catch(() => {})}
            accessibilityLabel={social.label}
            style={({ pressed }) => [styles.social, pressed && styles.socialPressed]}
          >
            <Ionicons name={social.icon} size={22} color={colors.ink} />
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 40, paddingHorizontal: PAGE_X, paddingVertical: 32, backgroundColor: colors.zinc50 },
  brand: { gap: 16 },
  logo: { width: 63, height: 42 },
  brandTexts: { gap: 8 },
  groups: { flexDirection: 'row', gap: 64 },
  group: { gap: 16, minWidth: 92 },
  links: { gap: 12 },
  socials: { flexDirection: 'row', gap: 16 },
  social: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  socialPressed: { backgroundColor: colors.zinc200 },
})
