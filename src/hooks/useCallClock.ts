import { useEffect, useState } from 'react'

export function formatCallDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 통화 시간은 상태로 들지 않고 시작 시각과의 차이로 계산한다. 여기서는 다시 그릴 계기만 만든다
export function useCallElapsed(activeSince: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!activeSince) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [activeSince])
  return activeSince ? Math.max(0, Math.floor((now - activeSince) / 1000)) : 0
}
