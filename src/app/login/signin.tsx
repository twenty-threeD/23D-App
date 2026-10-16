import { useCallback, useRef, useState } from 'react'
import { Pressable, StyleSheet, View, type TextInput } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import Text from '@/components/ui/Text'
import AuthCard from '@/components/login/AuthCard'
import InputField from '@/components/login/InputField'
import SubmitButton from '@/components/login/SubmitButton'
import { toast } from '@/components/ui/Toast'
import { colors } from '@/constants/theme'
import { login } from '@/lib/auth'
import { safeRedirect } from '@/lib/navigation'
import { useAuthStore } from '@/store/authStore'
import { isNetworkError } from '@/hooks/useHandleError'

// 구글은 앱 안 웹뷰 로그인을 정책으로 막아(disallowed_useragent) 빠졌다.
// 백엔드가 앱 스킴(itda://) 리다이렉트를 허용하면 시스템 브라우저로 붙일 수 있다
const SOCIAL = [
  { provider: 'kakao', label: '카카오', icon: require('@/assets/images/login-kakao.png') },
  { provider: 'naver', label: '네이버', icon: require('@/assets/images/login-naver.png') },
] as const

export default function Page() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()
  const target = safeRedirect(redirect, '/')
  const setTokens = useAuthStore((s) => s.setTokens)
  const hydrated = useAuthStore((s) => s.hydrated)
  const hasSession = useAuthStore((s) => s.hasSession)
  const passwordRef = useRef<TextInput>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  // 이미 로그인된 사용자는 로그인 화면에 머무르지 않고 가려던 곳으로 보낸다 (웹 useRedirectIfAuthed).
  // 소셜 로그인 화면이 위에 떠 있는 동안 옮기면 순서가 꼬여, 이 화면이 다시 보일 때(포커스)만 판단한다
  useFocusEffect(
    useCallback(() => {
      if (hydrated && hasSession) router.replace(target as never)
    }, [hydrated, hasSession, target]),
  )

  const canLogin = email.trim() !== '' && password.trim() !== '' && !busy

  async function handleLogin() {
    if (!canLogin) return
    setBusy(true)
    try {
      const tokens = await login(email.trim(), password)
      setTokens(tokens)
      // 로그인 후 뒤로가기로 로그인 화면에 돌아오지 않도록 치환한다. 위 effect 가 같은 곳으로 보낸다
    } catch (e) {
      toast.error(isNetworkError(e) ? '네트워크 연결을 확인해주세요.' : e instanceof Error ? e.message : '로그인에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard>
      <View style={styles.inputs}>
        <InputField
          placeholder="이메일을 입력해주세요"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <InputField
          ref={passwordRef}
          placeholder="비밀번호를 입력해주세요"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          showIcon
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={() => void handleLogin()}
        />
      </View>

      <SubmitButton label={busy ? '로그인 중...' : '로그인'} enabled={canLogin} onPress={() => void handleLogin()} />

      <View style={styles.links}>
        <Pressable onPress={() => router.push('/login/reset-password')} hitSlop={6}>
          <Text size="xs" color={colors.zinc500} style={styles.underline}>
            비밀번호를 잊으셨나요?
          </Text>
        </Pressable>
        <View style={styles.signupLink}>
          <Text size="xs" color={colors.zinc500}>
            계정이 없으신가요?
          </Text>
          <Pressable onPress={() => router.push('/login/signup')} hitSlop={6}>
            <Text size="xs" color={colors.zinc500} style={styles.underline}>
              회원가입
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 소셜 로그인 */}
      <View style={styles.social}>
        {SOCIAL.map((social) => (
          <Pressable
            key={social.provider}
            onPress={() => router.push({ pathname: '/login/oauth', params: { provider: social.provider, redirect: target } })}
            accessibilityLabel={`${social.label}로 로그인`}
            style={({ pressed }) => [styles.socialButton, pressed && styles.socialPressed]}
          >
            <Image source={social.icon} style={styles.socialIcon} contentFit="contain" />
          </Pressable>
        ))}
      </View>
    </AuthCard>
  )
}

const styles = StyleSheet.create({
  inputs: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
    paddingTop: 40,
    paddingBottom: 12,
  },
  links: {
    width: '100%',
    maxWidth: 300,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  signupLink: {
    flexDirection: 'row',
    gap: 4,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  social: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 8,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialPressed: {
    borderColor: colors.main,
  },
  socialIcon: {
    width: 22,
    height: 22,
  },
})
