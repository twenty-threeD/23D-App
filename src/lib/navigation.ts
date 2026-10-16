// 로그인 화면으로 보낼 때 "원래 있던 곳"을 함께 넘긴다.
// 로그인 후 그 자리로 돌려보낸다. (예전 웹은 어디서 튕겼든 로그인 후 무조건 메인으로 떨어졌다.)
export const SIGNIN_PATH = '/login/signin'

export function signinHref(from?: string | null) {
  // 로그인/가입 화면 자체를 돌아갈 곳으로 기억하면 제자리를 맴돈다
  if (!from || from === '/' || from.startsWith('/login') || from.startsWith('/oauth')) return SIGNIN_PATH
  return `${SIGNIN_PATH}?redirect=${encodeURIComponent(from)}`
}

// 앱 안 경로만 돌아갈 곳으로 받는다 (외부 주소·이상한 값으로 튀지 않게)
export function safeRedirect(target: string | null | undefined, fallback = '/') {
  return target && target.startsWith('/') && !target.startsWith('//') && !target.includes('\\') ? target : fallback
}
