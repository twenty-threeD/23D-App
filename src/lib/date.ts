// 서버는 2026-10-15T10:59:22.304486Z 처럼 소수 초를 6자리 이상 준다.
// 브라우저(V8)는 그대로 읽지만 앱의 JS 엔진(Hermes)은 3자리를 넘으면 NaN 을 돌려줄 수 있어, 날짜는 전부 여기서 읽는다
export function parseDate(value: string | null | undefined): number {
  if (!value) return NaN
  return Date.parse(value.replace(/(\.\d{3})\d+/, '$1'))
}

export function toDate(value: string | null | undefined): Date | null {
  const time = parseDate(value)
  return Number.isNaN(time) ? null : new Date(time)
}

const pad = (n: number) => String(n).padStart(2, '0')

// 2026.10.15
export function formatDotDate(value: string | null | undefined) {
  const d = toDate(value)
  return d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : null
}

// 2026.10.15 13:05
export function formatDotDateTime(value: string | null | undefined) {
  const d = toDate(value)
  return d ? `${formatDotDate(value)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : null
}

// 2026년 10월 15일
export function formatKoreanDate(value: string | null | undefined) {
  const d = toDate(value)
  return d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` : ''
}

// 웹의 toLocaleDateString('ko-KR') 표기(2026. 10. 15.)를 기기 언어와 상관없이 같게 만든다
export function formatLocaleDate(value: string | null | undefined) {
  const d = toDate(value)
  return d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.` : ''
}

// 웹의 toLocaleString('ko-KR', { year, month: '2-digit', day: '2-digit', hour, minute }) 표기
export function formatLocaleDateTime(value: string | null | undefined) {
  const d = toDate(value)
  if (!d) return ''
  const hours = d.getHours()
  const meridiem = hours < 12 ? '오전' : '오후'
  const h12 = hours % 12 === 0 ? 12 : hours % 12
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${meridiem} ${pad(h12)}:${pad(d.getMinutes())}`
}

// 오후 01:05 (채팅 말풍선 시각)
export function formatTime(value: string | null | undefined) {
  const d = toDate(value)
  if (!d) return ''
  const hours = d.getHours()
  const meridiem = hours < 12 ? '오전' : '오후'
  const h12 = hours % 12 === 0 ? 12 : hours % 12
  return `${meridiem} ${pad(h12)}:${pad(d.getMinutes())}`
}

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

// 2026년 10월 15일 목요일 (채팅 날짜 구분선)
export function formatDateWithWeekday(value: string | null | undefined) {
  const d = toDate(value)
  return d ? `${formatKoreanDate(value)} ${WEEKDAYS[d.getDay()]}` : ''
}

// 같은 날인지 비교할 때 쓰는 키
export function dateKey(value: string | null | undefined) {
  const d = toDate(value)
  return d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : ''
}

// 10/15 13:05 (알림 시각)
export function formatMonthDayTime(value: string | null | undefined) {
  const d = toDate(value)
  if (!d) return ''
  const hours = d.getHours()
  const meridiem = hours < 12 ? '오전' : '오후'
  const h12 = hours % 12 === 0 ? 12 : hours % 12
  return `${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${meridiem} ${pad(h12)}:${pad(d.getMinutes())}`
}
