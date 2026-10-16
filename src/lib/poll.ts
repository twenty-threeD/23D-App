import { AppState } from 'react-native'

// 주기적으로 다시 조회하되, 앱이 화면 밖(백그라운드)에 있는 동안에는 건너뛴다.
// 아무도 보지 않는데 몇 초마다 요청을 보낼 이유가 없고, 다시 앞으로 나오는 순간 한 번 바로 받아 밀린 내용을 맞춘다.
// (웹은 탭이 숨겨졌는지 document.hidden 으로 봤다)
export function pollWhileActive(run: () => void, intervalMs: number): () => void {
  const timer = setInterval(() => {
    if (AppState.currentState === 'active') run()
  }, intervalMs)

  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') run()
  })

  return () => {
    clearInterval(timer)
    subscription.remove()
  }
}

// 응답이 늦는 요청을 제한 시간 뒤 끊는다. 한 지표가 늦어도 나머지를 먼저 보여주기 위해서다
export async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
