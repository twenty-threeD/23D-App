import { API_URL } from './config'

// 웹은 같은 오리진의 /api 를 Next rewrites 로 백엔드에 넘겼다. 앱에는 그 프록시가 없어 백엔드 주소를 직접 붙인다
export function apiUrl(path: string) {
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`
}

export function jsonHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export function bearer(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// 응답이 { data: ... } 로 감싸져 오는 경우와 아닌 경우를 모두 받아준다
export function unwrap<T>(json: unknown): T {
  const body = json as { data?: T }
  return (body && typeof body === 'object' && 'data' in body ? body.data : json) as T
}

// 금액·건수는 기기 언어와 상관없이 한국식 자리 구분으로 보여준다(웹은 브라우저 기본 로캘이 대부분 ko 였다)
export function formatNumber(value: number) {
  return value.toLocaleString('ko-KR')
}
