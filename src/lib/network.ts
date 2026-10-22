import { create } from 'zustand'
import { API_URL, CHAIN_REST_URL } from './config'

// 인터넷이 끊긴 상태를 앱 전체에서 한 곳으로 판단한다.
//
// 화면마다 fetch 를 직접 부르고 실패 처리도 제각각이라(빈 목록·'존재하지 않는 글'·토스트), 끊긴 채로 앱을 열면
// 화면이 빈 상태나 엉뚱한 오류로 바뀐다. 그래서 전역 fetch 를 한 번 감싸서
// - 우리 서버로 가는 GET 은 네트워크 오류가 나도 실패로 돌려주지 않고 붙들고 있다가 연결되면 다시 보낸다.
//   화면은 계속 '불러오는 중'이라 스켈레톤(구조)이 남고, 연결되면 그대로 내용이 채워진다
// - 요청이 5초 안에 응답을 못 받으면 오프라인으로 보고 '인터넷에 연결되어 있지 않아요' 화면을 띄운다

const OFFLINE_AFTER_MS = 5000
const RETRY_INTERVAL_MS = 3000
// RN 안드로이드 fetch(OkHttp)는 제한 시간이 없다. 와이파이가 붙는 도중에 나간 요청은 응답 없이 몇 분씩 멈춰,
// 연결이 돌아와도 화면이 스켈레톤에 갇혔다. 붙드는 요청은 회차마다 제한 시간을 두고 넘으면 다시 보낸다
const ATTEMPT_TIMEOUT_MS = 15000
const PROBE_TIMEOUT_MS = 5000
const HOSTS = [API_URL, CHAIN_REST_URL]

interface NetworkState {
  offline: boolean
}

export const useNetworkStore = create<NetworkState>(() => ({ offline: false }))

const setOffline = (offline: boolean) => {
  if (useNetworkStore.getState().offline !== offline) useNetworkStore.setState({ offline })
}

// 마지막으로 서버 응답을 받은 시각. 늦은 요청 하나 때문에, 다른 요청은 잘 오는데 오프라인으로 보지 않게 한다
let lastResponseAt = 0
// 연결을 기다리며 붙들고 있는 요청들을 다시 보내게 깨우는 함수들
let waiters: (() => void)[] = []
let retryTimer: ReturnType<typeof setInterval> | null = null
// 붙든 요청의 진행 중인 회차. 연결이 돌아온 순간 끊긴 동안 나간 회차를 끊고 바로 다시 보내려고 들고 있는다
const attempts = new Map<AbortController, { reconnected: boolean }>()

function markResponse() {
  lastResponseAt = Date.now()
  if (useNetworkStore.getState().offline) {
    attempts.forEach((state, controller) => {
      state.reconnected = true
      controller.abort()
    })
  }
  setOffline(false)
}

function wakeWaiters() {
  const list = waiters
  waiters = []
  list.forEach((wake) => wake())
  stopRetryLoopIfIdle()
}

function stopRetryLoopIfIdle() {
  if (retryTimer && waiters.length === 0 && !useNetworkStore.getState().offline) {
    clearInterval(retryTimer)
    retryTimer = null
  }
}

let originalFetch: typeof fetch = (...args) => fetch(...args)

// 붙든 요청이 없어도(POST 실패만 있었던 경우 등) 오프라인 화면이 저절로 걷히도록 서버에 직접 닿는지 확인한다.
// 상태 코드는 상관없다. 응답이 오기만 하면 연결된 것이다
async function probe() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    await originalFetch(API_URL, { method: 'HEAD', signal: controller.signal })
    markResponse()
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

// 붙드는 요청의 한 회차. 제한 시간을 넘기거나 연결이 돌아와 끊기면 { retryNow } 로 알린다
async function attempt(input: RequestInfo | URL, init: RequestInit | undefined) {
  const controller = new AbortController()
  const state = { reconnected: false }
  attempts.set(controller, state)
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS)
  try {
    return { res: await originalFetch(input, { ...init, signal: controller.signal }) }
  } catch {
    return { res: null, retryNow: state.reconnected }
  } finally {
    clearTimeout(timer)
    attempts.delete(controller)
  }
}

function ensureRetryLoop() {
  if (retryTimer) return
  retryTimer = setInterval(() => {
    if (useNetworkStore.getState().offline) void probe().then(wakeWaiters)
    else wakeWaiters()
  }, RETRY_INTERVAL_MS)
}

function waitForRetry() {
  ensureRetryLoop()
  return new Promise<void>((resolve) => waiters.push(resolve))
}

// 오프라인 화면의 '다시 시도'. 연결됐으면 붙든 요청을 바로 다시 보낸다
export async function retryNow() {
  const ok = await probe()
  wakeWaiters()
  return ok
}

function requestInfo(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
  return { url, method }
}

// RN fetch 폴리필의 DOMException 은 Error 를 상속하지 않을 수 있어 이름으로만 본다
const isAbort = (error: unknown) => (error as { name?: string } | null)?.name === 'AbortError'

// 앱을 켤 때 한 번 부른다(루트 레이아웃)
export function installNetworkGuard() {
  if ((globalThis.fetch as { guarded?: boolean }).guarded) return
  originalFetch = globalThis.fetch.bind(globalThis)

  const guarded = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const { url, method } = requestInfo(input, init)
    if (!HOSTS.some((host) => url.startsWith(host))) return originalFetch(input, init)

    const startedAt = Date.now()
    // 5초 동안 이 요청도, 다른 어떤 요청도 응답을 못 받았으면 끊긴 것으로 본다.
    // 붙들지 않고 실패를 돌려준 요청도 타이머는 남겨, 그 화면만 쓰는 요청이 실패해도 오프라인 화면이 뜨게 한다
    const timer = setTimeout(() => {
      if (lastResponseAt < startedAt) {
        setOffline(true)
        ensureRetryLoop()
      }
    }, OFFLINE_AFTER_MS)

    // 호출부가 직접 끊는 요청(알림 SSE 스트림·제한 시간 있는 블록체인 지표)은 그 처리를 따르도록 붙들지 않는다.
    // GET 이 아닌 요청은 다시 보내면 두 번 처리될 수 있어(결제·작성) 실패를 그대로 돌려준다
    const holdOnFailure = method === 'GET' && !init?.signal

    if (!holdOnFailure) {
      try {
        const res = await originalFetch(input, init)
        clearTimeout(timer)
        markResponse()
        return res
      } catch (error) {
        // 호출부가 끊은 건 연결 문제가 아니다(제한 시간·화면 이탈)
        if (isAbort(error)) clearTimeout(timer)
        throw error
      }
    }

    for (;;) {
      const result = await attempt(input, init)
      if (result.res) {
        clearTimeout(timer)
        markResponse()
        return result.res
      }
      if (!result.retryNow) await waitForRetry()
    }
  }

  globalThis.fetch = Object.assign(guarded, { guarded: true }) as typeof fetch
}
