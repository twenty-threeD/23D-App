import { useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { WebView } from 'react-native-webview'
import BackHeader from '@/components/BackHeader'
import { colors } from '@/constants/theme'
import { API_URL } from '@/lib/config'
import { exchangeOAuthCode } from '@/lib/auth'
import { ApiError } from '@/lib/apiError'
import { safeRedirect } from '@/lib/navigation'
import { useAuthStore } from '@/store/authStore'

// 백엔드는 로그인을 시작한 오리진으로 돌려보내되, 허용 목록(배포 웹·localhost:3000)에 있는 http(s) 오리진만 받는다.
// 앱은 그중 localhost 를 빌려 쓴다. 이 오리진은 토큰 쿠키를 받을 수 없어 백엔드가 60초짜리 1회용 코드를 붙여 보내므로,
// 웹뷰가 그 주소로 넘어가려는 순간 가로채 코드를 토큰으로 바꾼다(실제로 localhost 를 열지는 않는다)
const APP_ORIGIN = 'http://localhost:3000'
const SUCCESS_URL = `${APP_ORIGIN}/oauth/success`
const FAIL_URL = `${APP_ORIGIN}/oauth/fail`

const TITLES: Record<string, string> = { kakao: '카카오 로그인', naver: '네이버 로그인' }

export default function Page() {
  const { provider = 'kakao', redirect } = useLocalSearchParams<{ provider?: string; redirect?: string }>()
  const setTokens = useAuthStore((s) => s.setTokens)
  const [exchanging, setExchanging] = useState(false)
  // 같은 성공 주소로 두 번 넘어오는 경우가 있어(리다이렉트 재시도) 교환은 한 번만 한다
  const handledRef = useRef(false)

  const startUrl = `${API_URL}/oauth2/authorization/${encodeURIComponent(provider)}?redirect_uri=${encodeURIComponent(SUCCESS_URL)}`

  function fail(code?: string | null) {
    router.replace({ pathname: '/oauth/fail', params: code ? { code } : {} })
  }

  async function handleSuccess(url: string) {
    if (handledRef.current) return
    handledRef.current = true
    const code = new URL(url).searchParams.get('code')
    if (!code) return fail()
    setExchanging(true)
    try {
      setTokens(await exchangeOAuthCode(code))
      // 로그인 화면에서 들어왔으면 그 화면이 다시 보이면서 가려던 곳으로 넘겨준다
      if (router.canGoBack()) router.back()
      else router.replace(safeRedirect(redirect, '/') as never)
    } catch (e) {
      fail(e instanceof ApiError ? e.code : null)
    }
  }

  return (
    <View style={styles.container}>
      <BackHeader title={TITLES[provider] ?? '소셜 로그인'} />
      <WebView
        source={{ uri: startUrl }}
        style={styles.flex}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.main} />
          </View>
        )}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith(SUCCESS_URL)) {
            void handleSuccess(request.url)
            return false
          }
          if (request.url.startsWith(FAIL_URL)) {
            fail(new URL(request.url).searchParams.get('code'))
            return false
          }
          // 카카오톡 앱으로 넘기는 intent:// 같은 주소는 돌아올 길이 없어 막는다. 아이디·비밀번호 로그인은 웹 화면에서 그대로 된다
          return /^https?:\/\//.test(request.url) || request.url.startsWith('about:')
        }}
      />
      {exchanging ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.main} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
})
