import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { clearCache } from '@/lib/cache'
import { clearAllChatCache } from '@/lib/chatDb'

// JWT 는 base64url('-','_', 패딩 없음)이라 atob 에 바로 넣으면 그 문자가 섞인 토큰에서 실패한다.
// 또 atob 는 바이트를 latin1 로 돌려줘서 한글 같은 값이 깨지므로 UTF-8 로 다시 읽는다
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

export function decodeJwtUsername(token: string): string | null {
  const payload = decodeJwtPayload(token)
  if (!payload) return null
  return (payload.username as string) ?? (payload.sub as string) ?? null
}

function decodeJwtRole(token: string): string | null {
  const role = decodeJwtPayload(token)?.role
  return typeof role === 'string' ? role.replace(/^ROLE_/, '') : null
}

// 토큰 만료 여부 (exp 가 없으면 만료되지 않은 것으로 간주)
export function isTokenExpired(token: string): boolean {
  const exp = decodeJwtPayload(token)?.exp
  if (typeof exp !== 'number') return false
  return exp * 1000 <= Date.now()
}

// 토큰 만료까지 남은 시간(ms). 만료되었거나 알 수 없으면 null
export function getTokenRemainingTime(token: string): number | null {
  const exp = decodeJwtPayload(token)?.exp
  if (typeof exp !== 'number') return null
  const remaining = exp * 1000 - Date.now()
  return remaining > 0 ? remaining : null
}

// 웹은 액세스 토큰을 localStorage, 리프레시 토큰을 httpOnly 쿠키에 뒀다.
// 앱에는 쿠키 세션이 없어 둘 다 기기 암호화 저장소(SecureStore)에 둔다
const ACCESS_KEY = 'auth.accessToken'
const REFRESH_KEY = 'auth.refreshToken'

function persist(key: string, value: string | null) {
  const job = value ? SecureStore.setItemAsync(key, value) : SecureStore.deleteItemAsync(key)
  // 저장에 실패해도 이번 실행 동안의 로그인은 메모리 상태로 유지된다
  void job.catch(() => {})
}

interface AuthStore {
  accessToken: string | null
  refreshToken: string | null
  username: string | null
  role: string | null
  // 재발급을 시도해볼 만한 상태인지(리프레시 토큰을 들고 있는지)
  hasSession: boolean
  hydrated: boolean
  hydrate: () => Promise<void>
  // 로그인·소셜 로그인 교환 직후. 두 토큰을 함께 받는다
  setTokens: (tokens: { accessToken: string; refreshToken: string | null }) => void
  // 재발급. 액세스 토큰만 바뀐다
  setToken: (token: string) => void
  clear: () => void
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  accessToken: null,
  refreshToken: null,
  username: null,
  role: null,
  hasSession: false,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY).catch(() => null),
      SecureStore.getItemAsync(REFRESH_KEY).catch(() => null),
    ])
    // 만료된 액세스 토큰이라도 지우지 않는다. 리프레시 토큰으로 살릴 수 있으므로 판단은 useAuthBootstrap 에 맡긴다
    set({
      accessToken,
      refreshToken,
      username: accessToken ? decodeJwtUsername(accessToken) : null,
      role: accessToken ? decodeJwtRole(accessToken) : null,
      hasSession: !!refreshToken || !!accessToken,
      hydrated: true,
    })
  },

  setTokens: ({ accessToken, refreshToken }) => {
    persist(REFRESH_KEY, refreshToken)
    set({ refreshToken })
    get().setToken(accessToken)
  },

  setToken: (token) => {
    persist(ACCESS_KEY, token)
    const username = decodeJwtUsername(token)
    // 토큰 재발급은 같은 사람이라 캐시를 살리고, 다른 계정으로 들어왔을 때만 이전 사람의 데이터를 비운다
    if (username !== get().username) {
      clearCache()
      // 이전 계정이 남긴 채팅 캐시도 지운다. 실패해도 로그인은 막지 않는다
      void clearAllChatCache().catch(() => {})
    }
    set({ accessToken: token, username, role: decodeJwtRole(token), hasSession: true })
  },

  clear: () => {
    persist(ACCESS_KEY, null)
    persist(REFRESH_KEY, null)
    clearCache()
    void clearAllChatCache().catch(() => {})
    set({ accessToken: null, refreshToken: null, username: null, role: null, hasSession: false })
  },
}))
