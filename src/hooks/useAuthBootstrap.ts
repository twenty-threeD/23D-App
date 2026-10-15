import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useAuthStore, getTokenRemainingTime } from '@/store/authStore'
import { ensureAccessToken } from '@/lib/session'

// 만료 직전에 미리 갱신해 요청 도중 만료되는 것을 막는다
const REFRESH_MARGIN = 60 * 1000
const MAX_TIMEOUT = 2 ** 31 - 1

// 웹 AuthProvider 를 옮겼다. 앱을 켤 때 저장된 토큰을 꺼내고, 만료가 임박하면 재발급한다
export function useAuthBootstrap() {
  const token = useAuthStore((s) => s.accessToken)
  const hasSession = useAuthStore((s) => s.hasSession)
  const hydrated = useAuthStore((s) => s.hydrated)

  useEffect(() => {
    void useAuthStore.getState().hydrate()
  }, [])

  useEffect(() => {
    if (!hydrated || !hasSession) return

    const remaining = token ? getTokenRemainingTime(token) : null

    // 이미 만료됐거나 만료가 임박하면 즉시 재발급
    if (remaining === null || remaining <= REFRESH_MARGIN) {
      void ensureAccessToken()
      return
    }

    // setTimeout 상한(약 24.8일)을 넘으면 예약하지 않는다
    const delay = remaining - REFRESH_MARGIN
    if (delay > MAX_TIMEOUT) return

    const timer = setTimeout(() => void ensureAccessToken(), delay)
    return () => clearTimeout(timer)
  }, [hydrated, token, hasSession])

  // 백그라운드에 오래 둔 앱은 타이머가 멈춰 있으므로 다시 앞으로 나올 때 확인한다 (웹의 탭 focus 와 같은 역할)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useAuthStore.getState().hasSession) void ensureAccessToken()
    })
    return () => subscription.remove()
  }, [])

  return hydrated
}
