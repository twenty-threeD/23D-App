import { CHAIN_RPC_WS } from './config'

const RECONNECT_DELAY = 3000

type Listener = {
  /** 구독 쿼리에 해당하는 이벤트의 result.data.value 와 result.events. */
  onEvent: (value: unknown, events: Record<string, string[]>) => void
  /** (재)연결되어 구독이 걸린 직후 호출된다. 끊긴 동안 놓친 이벤트를 REST 로 다시 맞추는 데 쓴다. */
  onConnect?: () => void
}

/*
 * CometBFT(Tendermint) RPC 웹소켓. EXPO_PUBLIC_CHAIN_RPC_WS 가 비어 있으면 쓰지 않고 각 모듈이 REST 폴링으로 동작한다.
 * 프록시(nginx)가 IP 당 웹소켓 연결 수를 제한하므로 앱 전체에서 연결을 하나만 연다.
 * 같은 쿼리를 여러 곳에서 구독해도 노드에는 한 번만 subscribe 한다(웹과 같다).
 */
const listeners = new Map<string, Set<Listener>>()
const queryIds = new Map<string, number>()
let nextId = 1

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export function isChainSocketEnabled(): boolean {
  return Boolean(CHAIN_RPC_WS)
}

/** 구독이 실제로 살아 있는지. 연결 실패나 끊김 동안에는 false 이고 각 모듈은 이 동안 REST 폴링으로 대신한다. */
export function isChainSocketOpen(): boolean {
  return socket?.readyState === WebSocket.OPEN
}

function send(method: string, query: string) {
  if (socket?.readyState !== WebSocket.OPEN) return
  let id = queryIds.get(query)
  if (id === undefined) {
    id = nextId++
    queryIds.set(query, id)
  }
  socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params: { query } }))
}

function dispatch(raw: string) {
  let payload: { result?: { query?: string; data?: { value?: unknown }; events?: Record<string, string[]> } }
  try {
    payload = JSON.parse(raw)
  } catch {
    return
  }
  // subscribe 응답(result: {})에는 query 가 없다.
  const query = payload.result?.query
  if (!query) return
  for (const listener of listeners.get(query) ?? []) {
    listener.onEvent(payload.result?.data?.value, payload.result?.events ?? {})
  }
}

function connect() {
  if (!CHAIN_RPC_WS || socket || listeners.size === 0) return
  const current = new WebSocket(CHAIN_RPC_WS)
  socket = current

  current.onopen = () => {
    for (const [query, set] of listeners) {
      send('subscribe', query)
      for (const listener of set) listener.onConnect?.()
    }
  }
  current.onmessage = (event) => dispatch(String(event.data))
  current.onclose = () => {
    if (socket !== current) return
    socket = null
    if (listeners.size === 0) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, RECONNECT_DELAY)
  }
}

function disconnect() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  const current = socket
  socket = null
  current?.close()
}

/** 쿼리(예: "tm.event='NewBlock'")를 구독한다. 연결은 첫 구독 때 열리고 마지막 구독이 해제되면 닫힌다. */
export function subscribeChainEvent(query: string, listener: Listener): () => void {
  let set = listeners.get(query)
  const isNewQuery = !set
  if (!set) {
    set = new Set()
    listeners.set(query, set)
  }
  set.add(listener)

  if (!socket) {
    connect()
  } else if (socket.readyState === WebSocket.OPEN) {
    if (isNewQuery) send('subscribe', query)
    listener.onConnect?.()
  }

  return () => {
    const current = listeners.get(query)
    if (!current?.delete(listener) || current.size > 0) return
    listeners.delete(query)
    send('unsubscribe', query)
    queryIds.delete(query)
    if (listeners.size === 0) disconnect()
  }
}
