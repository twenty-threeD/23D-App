import { useAuthStore, isTokenExpired } from '@/store/authStore'
import { reissueToken } from './auth'
import { ApiError } from './apiError'

// 동시에 여러 곳에서 재발급을 요청해도 실제 호출은 한 번만 나가도록 공유한다
let inflight: Promise<string | null> | null = null

// 유효한 액세스 토큰을 반환한다.
// 만료되었으면 리프레시 토큰으로 재발급하고, 서버가 재발급을 거절하면 로그아웃 후 null 을 반환한다.
export async function ensureAccessToken(): Promise<string | null> {
  const { accessToken, refreshToken, clear, setToken } = useAuthStore.getState()

  if (accessToken && !isTokenExpired(accessToken)) return accessToken
  if (!refreshToken) return null

  if (!inflight) {
    inflight = reissueToken(refreshToken)
      .then((token) => {
        setToken(token)
        return token
      })
      .catch((e) => {
        // 리프레시 토큰도 만료/폐기된 상태이므로 재로그인이 필요하다.
        // 네트워크가 잠깐 끊긴 것(서버 응답 없음)이면 세션은 그대로 두고 다음 기회에 다시 시도한다
        if (e instanceof ApiError) clear()
        return null
      })
      .finally(() => {
        inflight = null
      })
  }

  return inflight
}
