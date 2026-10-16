import { useEffect, useState } from 'react'
import { formatLocaleDate, formatLocaleDateTime, parseDate } from './date'

/** 이 시간 안쪽이면 숫자를 붙이지 않는다. */
const JUST_NOW_SEC = 10

/** [초 임계값, 단위 문구, 나눗셈 값]. 위에서부터 처음 걸리는 구간을 쓴다. */
const LADDER: [number, string, number][] = [
  [60, '초', 1],
  [3600, '분', 60],
  [86400, '시간', 3600],
  [604800, '일', 86400],
]

/** 표시 단위가 바뀌는 주기에 맞춰 [초 임계값, 갱신 간격(ms)]. */
const TICK: [number, number][] = [
  [60, 1000],
  [3600, 30000],
]

const SLOW_TICK = 60000

/**
 * 경과 시간을 "방금 전", "32초 전", "5분 전", "3시간 전", "1일 전"으로 표기한다.
 * 일주일이 넘으면 상대 표기가 오히려 읽기 어려워 절대 날짜로 바꾼다.
 * 웹은 Intl.RelativeTimeFormat 을 썼는데 앱의 JS 엔진은 이를 보장하지 않아 같은 문구를 직접 만든다.
 */
export function formatRelativeTime(iso: string, now: number): string | null {
  const timestamp = parseDate(iso)
  if (Number.isNaN(timestamp)) return null

  // 서버와 기기의 시계가 조금 어긋나도 "-3초 전"이 보이지 않게 한다
  const elapsed = Math.max(0, (now - timestamp) / 1000)

  if (elapsed < JUST_NOW_SEC) return '방금 전'

  for (const [limit, unit, divisor] of LADDER) {
    if (elapsed < limit) return `${Math.floor(elapsed / divisor)}${unit} 전`
  }

  return formatLocaleDate(iso)
}

/** 절대 시각. 상대 시간을 길게 눌렀을 때 보여준다. */
export function formatAbsoluteTime(iso: string): string | undefined {
  return formatLocaleDateTime(iso) || undefined
}

function tickInterval(times: string[], now: number): number {
  // 가장 최근 항목이 가장 빨리 바뀌므로 그 기준으로 간격을 정한다
  const newest = times
    .map(parseDate)
    .filter((timestamp) => !Number.isNaN(timestamp))
    .reduce((latest, timestamp) => Math.max(latest, timestamp), 0)

  if (newest === 0) return SLOW_TICK

  const elapsed = (now - newest) / 1000

  return TICK.find(([limit]) => elapsed < limit)?.[1] ?? SLOW_TICK
}

/**
 * 상대 시간이 흘러가도록 현재 시각을 주기적으로 갱신한다.
 * 표시 단위가 초에서 분, 시간으로 넘어가면 갱신 간격도 함께 느려진다.
 */
export function useNow(times: string[]): number {
  const [now, setNow] = useState(() => Date.now())

  // 배열은 렌더마다 새로 만들어지므로 값으로 비교해야 타이머가 매번 재설정되지 않는다
  const key = times.join(',')

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // 간격이 고정되면 초 단위를 벗어난 뒤에도 1초마다 깨어난다.
    // 매번 다음 간격을 다시 계산해 표시 단위가 느려지면 타이머도 느려지게 한다.
    const tick = () => {
      const current = Date.now()
      setNow(current)
      timeoutId = setTimeout(tick, tickInterval(key ? key.split(',') : [], current))
    }

    timeoutId = setTimeout(tick, tickInterval(key ? key.split(',') : [], Date.now()))

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }, [key])

  return now
}
