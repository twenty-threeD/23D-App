import { ApiError, throwApiError } from './apiError'
import { apiUrl, jsonHeaders } from './http'
import { invalidateMe } from './profile'

export interface AuthTokens {
  accessToken: string
  // 웹은 httpOnly 쿠키로만 다뤘지만 서버가 본문에도 같이 준다. 앱은 이 값을 SecureStore 에 두고 재발급에 쓴다
  refreshToken: string | null
}

function toTokens(json: unknown): AuthTokens {
  const data = (json as { data?: { accessToken?: string; refreshToken?: string } })?.data
  if (!data?.accessToken) throw new Error('로그인 응답을 확인할 수 없습니다.')
  return { accessToken: data.accessToken, refreshToken: data.refreshToken ?? null }
}

// 인증코드 전송
export async function sendVerifyCode(email: string) {
  const res = await fetch(apiUrl('/api/email/code/send'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email }),
  })
  // 발송 한도 초과·메일 서버 장애를 구분해 안내해야 해서 서버 에러 코드를 살려 던진다
  if (!res.ok) await throwApiError(res)
  return res.json()
}

// 인증코드 확인
export async function checkVerifyCode(email: string, verifyCode: string) {
  const res = await fetch(apiUrl('/api/email/code/verify'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email, verifyCode }),
  })
  if (!res.ok) throw new Error('인증코드 불일치')
  return res.json()
}

// 이메일 변경용 인증코드 전송 (새 이메일로 발송)
export async function sendEmailChangeCode(email: string) {
  const res = await fetch(apiUrl('/api/email/change/code/send'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email }),
  })
  if (!res.ok) await throwApiError(res)
  return res.json()
}

// 전화번호 인증코드 전송
export async function sendPhoneVerifyCode(phone: string) {
  const res = await fetch(apiUrl('/phone/send'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(phone),
  })
  if (!res.ok) throw new Error('인증코드 전송 실패')
  return res.json()
}

// 전화번호 인증코드 확인
export async function checkPhoneVerifyCode(phone: string, code: string) {
  const res = await fetch(apiUrl('/phone/verify'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ recipientNumber: phone, code }),
  })
  if (!res.ok) throw new Error('인증코드 불일치')
  // 내 정보가 바뀌었으니 들고 있던 프로필을 버린다
  invalidateMe()
  return res.json()
}

// 회원가입
export async function signup(name: string, username: string, email: string, password: string, phone?: string) {
  const res = await fetch(apiUrl('/api/auth/signup'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ name, username, email, password, ...(phone ? { phone } : {}) }),
  })
  // 이메일 미인증(EMAIL_NOT_VERIFIED)을 화면에서 구분해 인증 단계로 돌려보내야 해서 코드를 살려 던진다
  if (!res.ok) await throwApiError(res)
  return res.json()
}

// 로그인
export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await fetch(apiUrl('/api/auth/signin'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password }),
  })
  // 게이트웨이 오류처럼 본문이 JSON 이 아니면 파싱 에러 문구가 그대로 토스트에 떴다
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error?.message ?? '로그인에 실패했습니다.')
  }
  return toTokens(await res.json())
}

// 액세스 토큰 재발급.
// 서버는 쿠키를 먼저 보고 없으면 본문을 본다. 기기 쿠키 저장소에 예전 계정의 쿠키가 남아 있으면
// 그 사람으로 재발급될 수 있어, 쿠키는 싣지 않고 SecureStore 의 토큰만 본문으로 보낸다
export async function reissueToken(refreshToken: string) {
  const res = await fetch(apiUrl('/api/token/reissue'), {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'omit',
    body: JSON.stringify({ refreshToken }),
  })
  // 서버가 거절했는지(ApiError)와 네트워크가 끊겼는지(TypeError)를 호출부가 구분해야 한다.
  // 휴대폰은 지하철·엘리베이터에서 잠깐 끊기는 일이 잦아, 그때마다 로그아웃시키면 안 된다
  if (!res.ok) throw new ApiError('토큰 재발급에 실패했습니다.', res.status)
  const json = await res.json()
  const accessToken = json?.data?.accessToken
  if (!accessToken) throw new ApiError('토큰 재발급에 실패했습니다.', res.status)
  return accessToken as string
}

// 소셜 로그인은 앱 안 웹뷰에서 백엔드가 허용한 localhost 오리진으로 시작한다.
// 그러면 백엔드가 토큰 쿠키 대신 60초짜리 1회용 코드를 주고, 그 코드를 여기서 토큰으로 바꾼다
export async function exchangeOAuthCode(code: string): Promise<AuthTokens> {
  const res = await fetch(apiUrl('/api/auth/oauth/exchange'), {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'omit',
    body: JSON.stringify({ code }),
  })
  if (!res.ok) await throwApiError(res)
  return toTokens(await res.json())
}

// 로그아웃
export async function logout(token?: string | null) {
  await fetch(apiUrl('/api/auth/signout'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

// 현재 비밀번호 확인 (일치 여부를 boolean 으로 돌려준다)
export async function verifyPassword(token: string, password: string) {
  const res = await fetch(apiUrl('/api/auth/verify/password'), {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ password }),
  })
  if (!res.ok) throw new Error('비밀번호 확인에 실패했습니다.')
  const json = await res.json()
  // 응답이 boolean 그대로 오거나 공통 래퍼에 담겨 올 수 있다
  return (typeof json === 'boolean' ? json : json?.data) === true
}
