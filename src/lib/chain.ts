import { CHAIN_REST_URL, CHAIN_RPC_URL } from './config'
import { isChainSocketEnabled, isChainSocketOpen, subscribeChainEvent } from './chainSocket'
import { fetchWithTimeout, pollWhileActive } from './poll'
import { apiUrl } from './http'
import { parseDate } from './date'

// 웹은 블록체인 노드 REST 가 CORS 를 막아 Next 라우트 핸들러(/api/blockchain/*)로 대신 불렀다.
// 앱 요청에는 CORS 가 없어 그 핸들러가 하던 일을 여기서 노드에 직접 한다

/** 업스트림 한 건당 대기 한도. 늦는 지표는 null('-')로 포기하고 나머지를 먼저 보여준다(웹 라우트 핸들러와 같다) */
const UPSTREAM_TIMEOUT_MS = 3000
/** 평균 블록 생성 시간을 계산할 구간(블록 수) */
const BLOCK_WINDOW = 100
/** 최근 트랜잭션 조회 수. 자세히 보기 화면이 이 결과를 나눠 페이지로 보여준다(노드 상한 100) */
const FETCH_LIMIT = 100

type BlockResponse = { block?: { header?: { height?: string; time?: string } } }

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchWithTimeout(url, UPSTREAM_TIMEOUT_MS)
  if (!res.ok) throw new Error(`${url} responded ${res.status}`)
  return (await res.json()) as T
}

// ── 블록 높이 ──────────────────────────────

const HEIGHT_ERROR = '블록 높이를 조회할 수 없습니다.'

export async function getLatestBlockHeight(): Promise<number> {
  const payload = await fetchJson<BlockResponse>(`${CHAIN_REST_URL}/cosmos/base/tendermint/v1beta1/blocks/latest`).catch(() => {
    throw new Error(HEIGHT_ERROR)
  })
  const height = Number(payload.block?.header?.height)
  if (!Number.isFinite(height)) throw new Error(HEIGHT_ERROR)
  return height
}

type HeightHandlers = { onHeight: (height: number) => void; onError?: (message: string) => void }

/** 블록 높이를 주기적으로 전달한다. 체인 웹소켓이 설정되어 있으면 NewBlock 구독을, 아니면 REST 폴링을 쓴다 */
export function subscribeBlockHeight({ onHeight, onError }: HeightHandlers): () => void {
  let stopped = false
  let latest = 0

  // 높이는 단조 증가한다. REST 응답과 이벤트가 엇갈려 와도 되돌아가지 않게 한다
  const emit = (height: number) => {
    if (stopped || !Number.isFinite(height) || height <= latest) return
    latest = height
    onHeight(height)
  }
  const fetchLatest = () => {
    getLatestBlockHeight()
      .then(emit)
      .catch(() => {
        if (!stopped) onError?.(HEIGHT_ERROR)
      })
  }

  fetchLatest()
  const stopPolling = pollWhileActive(() => {
    // 구독이 살아 있으면 폴링은 건너뛴다
    if (!isChainSocketOpen()) fetchLatest()
  }, 5000)

  const unsubscribe = isChainSocketEnabled()
    ? subscribeChainEvent("tm.event='NewBlock'", {
        onEvent: (value) => {
          const height = (value as { block?: { header?: { height?: string } } } | null)?.block?.header?.height
          if (height) emit(Number(height))
        },
        // 끊긴 동안 지나간 블록을 맞춘다
        onConnect: fetchLatest,
      })
    : null

  return () => {
    stopped = true
    stopPolling()
    unsubscribe?.()
  }
}

// ── 네트워크 정보 ──────────────────────────────

export interface NetworkInfo {
  /** 이 노드가 인지하는 노드 수(피어 + 자기 자신). RPC 미설정 시 null */
  nodes: number | null
  /** 현재 활성 검증자 수 */
  validators: number | null
  /** 최근 blockWindow 개 블록의 평균 생성 간격(초) */
  avgBlockTimeSec: number | null
  blockWindow: number
}

/** 최신 블록과 BLOCK_WINDOW 만큼 이전 블록의 헤더 시각 차이로 평균 블록 간격을 구한다. 체인이 짧으면 가능한 만큼만 뒤로 간다 */
async function fetchAvgBlockTime(): Promise<number | null> {
  const latest = await fetchJson<BlockResponse>(`${CHAIN_REST_URL}/cosmos/base/tendermint/v1beta1/blocks/latest`)
  const height = Number(latest.block?.header?.height)
  const latestTime = parseDate(latest.block?.header?.time)
  if (!Number.isFinite(height) || Number.isNaN(latestTime)) throw new Error('invalid latest block')

  const window = Math.min(BLOCK_WINDOW, height - 1)
  if (window < 1) return null
  const past = await fetchJson<BlockResponse>(`${CHAIN_REST_URL}/cosmos/base/tendermint/v1beta1/blocks/${height - window}`)
  const pastTime = parseDate(past.block?.header?.time)
  if (Number.isNaN(pastTime) || pastTime >= latestTime) return null
  return Math.round(((latestTime - pastTime) / 1000 / window) * 100) / 100
}

async function fetchValidatorCount(): Promise<number> {
  const payload = await fetchJson<{ pagination?: { total?: string } }>(`${CHAIN_REST_URL}/cosmos/base/tendermint/v1beta1/validatorsets/latest`)
  const total = Number(payload.pagination?.total)
  if (!Number.isFinite(total)) throw new Error('invalid validator set')
  return total
}

/** 조회 대상 노드가 연결 중인 피어 수에 자기 자신을 더한다(네트워크 전체가 아니라 "이 노드가 인지하는 노드 수") */
async function fetchNodeCount(): Promise<number | null> {
  if (!CHAIN_RPC_URL) return null
  const payload = await fetchJson<{ result?: { n_peers?: string } }>(`${CHAIN_RPC_URL}/net_info`)
  const peers = Number(payload.result?.n_peers)
  if (!Number.isFinite(peers)) throw new Error('invalid net_info')
  return peers + 1
}

const NETWORK_ERROR = '정보를 조회할 수 없습니다.'

export async function getNetworkInfo(): Promise<NetworkInfo> {
  // 일부 지표만 실패해도 나머지는 그대로 보여준다. 실패한 값은 null 이고 화면에서는 '-' 로 표시된다
  const [blockTime, validators, nodes] = await Promise.allSettled([fetchAvgBlockTime(), fetchValidatorCount(), fetchNodeCount()])
  if (blockTime.status === 'rejected' && validators.status === 'rejected') throw new Error(NETWORK_ERROR)
  return {
    nodes: nodes.status === 'fulfilled' ? nodes.value : null,
    validators: validators.status === 'fulfilled' ? validators.value : null,
    avgBlockTimeSec: blockTime.status === 'fulfilled' ? blockTime.value : null,
    blockWindow: BLOCK_WINDOW,
  }
}

type InfoHandlers = { onInfo: (info: NetworkInfo) => void; onError?: (message: string) => void }

/** 네트워크 지표를 주기적으로 전달한다. 체인 웹소켓이 있으면 검증자 집합 변경 시 즉시 다시 조회하고 나머지는 느리게 갱신한다 */
export function subscribeNetworkInfo({ onInfo, onError }: InfoHandlers): () => void {
  const useSocket = isChainSocketEnabled()
  let stopped = false
  let requestSeq = 0

  const tick = async () => {
    const seq = ++requestSeq
    try {
      const info = await getNetworkInfo()
      if (!stopped && seq === requestSeq) onInfo(info)
    } catch {
      if (!stopped && seq === requestSeq) onError?.(NETWORK_ERROR)
    }
  }

  void tick()
  // 지표는 초 단위로만 변하므로 블록 높이보다 느리게 갱신한다
  const stopPolling = pollWhileActive(() => void tick(), useSocket ? 60000 : 15000)
  const unsubscribe = useSocket ? subscribeChainEvent("tm.event='ValidatorSetUpdates'", { onEvent: () => void tick() }) : null

  return () => {
    stopped = true
    stopPolling()
    unsubscribe?.()
  }
}

export function formatBlockTime(seconds: number | null): string | null {
  return seconds === null ? null : `${seconds.toFixed(2)}초`
}

// ── 최근 활동 ──────────────────────────────

export interface RecentBlock {
  height: number
  /** 블록 헤더 시각(ISO 8601) */
  time: string
  /** 그 블록에 담긴 트랜잭션 수 */
  txCount: number
}

export interface RecentTransaction {
  hash: string
  /** 메시지 서명자 주소. 메시지에 없으면 null */
  signer: string | null
  /** 결제 ID(order_id). 결제 메시지가 아니면 null */
  paymentId: string | null
  time: string
  height: number
}

export interface RecentActivity {
  blocks: RecentBlock[]
  transactions: RecentTransaction[]
}

type TxResponse = {
  height?: string
  txhash?: string
  timestamp?: string
  tx?: { body?: { messages?: { authority?: string; order_id?: string }[] } }
}

const ACTIVITY_ERROR = '최근 기록을 조회할 수 없습니다.'

/**
 * 최신 높이부터 블록을 역순으로 훑으면 빈 블록만 수천 개를 헛돌게 된다.
 * 트랜잭션 인덱스에서 거꾸로 올라가 트랜잭션이 담긴 블록만 추리고, 같은 높이끼리 묶어 블록을 만든다
 */
export async function getRecentActivity(): Promise<RecentActivity> {
  const params = new URLSearchParams({ query: 'tx.height>0', order_by: 'ORDER_BY_DESC', limit: String(FETCH_LIMIT) })
  let payload: { tx_responses?: TxResponse[] }
  try {
    const res = await fetchWithTimeout(`${CHAIN_REST_URL}/cosmos/tx/v1beta1/txs?${params}`, 10000)
    if (!res.ok) throw new Error()
    payload = await res.json()
  } catch {
    throw new Error(ACTIVITY_ERROR)
  }

  const transactions: RecentTransaction[] = []
  for (const response of payload.tx_responses ?? []) {
    const height = Number(response.height)
    if (!Number.isFinite(height) || !response.txhash || !response.timestamp) continue
    const message = response.tx?.body?.messages?.[0]
    transactions.push({
      hash: response.txhash,
      signer: message?.authority ?? null,
      paymentId: message?.order_id ?? null,
      time: response.timestamp,
      height,
    })
  }

  const blocks = new Map<number, RecentBlock>()
  for (const tx of transactions) {
    const block = blocks.get(tx.height)
    if (block) block.txCount += 1
    else blocks.set(tx.height, { height: tx.height, time: tx.time, txCount: 1 })
  }

  return { blocks: [...blocks.values()], transactions }
}

type ActivityHandlers = { onActivity: (activity: RecentActivity) => void; onError?: (message: string) => void }

/** 최근 블록과 트랜잭션을 전달한다. 체인 웹소켓이 있으면 Tx 이벤트가 올 때만, 아니면 주기적으로 조회한다 */
export function subscribeRecentActivity({ onActivity, onError }: ActivityHandlers): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  // 늦게 도착한 이전 응답이 최신 응답을 덮어쓰지 않게 한다
  let requestSeq = 0

  const refetch = async () => {
    const seq = ++requestSeq
    try {
      const activity = await getRecentActivity()
      if (!stopped && seq === requestSeq) onActivity(activity)
    } catch {
      if (!stopped && seq === requestSeq) onError?.(ACTIVITY_ERROR)
    }
  }

  // 한 블록에 트랜잭션이 몰려 이벤트가 연달아 와도 재조회는 한 번만 한다
  const scheduleRefetch = () => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void refetch()
    }, 500)
  }

  void refetch()
  const stopPolling = pollWhileActive(() => {
    if (!isChainSocketOpen()) void refetch()
  }, 15000)
  const unsubscribe = isChainSocketEnabled() ? subscribeChainEvent("tm.event='Tx'", { onEvent: scheduleRefetch, onConnect: () => void refetch() }) : null

  return () => {
    stopped = true
    if (timer !== null) clearTimeout(timer)
    stopPolling()
    unsubscribe?.()
  }
}

const ELLIPSIS = '.....'

/** 트랜잭션 해시를 "E4047.....BD411" 형태로 줄인다 */
export function truncateHash(hash: string | null): string | null {
  if (!hash) return null
  return hash.length <= 10 ? hash : `${hash.slice(0, 5)}${ELLIPSIS}${hash.slice(-5)}`
}

/** 주소를 "1l50cj.....p8s9q" 형태로 줄인다. 모든 주소가 공유하는 bech32 접두사(cosmos)는 구분에 도움이 안 되어 뗀다 */
export function truncateAddress(address: string | null): string | null {
  if (!address) return null
  const separator = address.indexOf('1')
  const body = separator === -1 ? address : address.slice(separator)
  return body.length <= 11 ? body : `${body.slice(0, 6)}${ELLIPSIS}${body.slice(-5)}`
}

/** 결제 ID는 뒤쪽만 "....odvhgga6" 형태로 보여준다 */
export function truncatePaymentId(paymentId: string | null): string | null {
  if (!paymentId) return null
  return paymentId.length <= 8 ? paymentId : `${ELLIPSIS}${paymentId.slice(-8)}`
}

// ── 트랜잭션 검증 ──────────────────────────────

/** 결제 당사자에게만 내려오는 계약 상세 */
export interface TxDetail {
  contractUrl: string
  /** 체인에 기록된 계약서 주소와 같은지. 서버가 판단하지 못하면 null */
  contractUrlMatched: boolean | null
}

export interface TxVerification {
  txHash: string
  /** 원장과 서명이 모두 맞는지. 화면의 "트랜잭션 검증여부"가 이 값을 따른다 */
  verified: boolean
  reason: string | null
  /** 사람이 읽을 수 있는 실패 사유. 성공이면 null */
  reasonMessage: string | null
  height: number | null
  orderId: string | null
  amount: number | null
  /** 결제 일시(ISO 8601) */
  paidAt: string | null
  /** 체인에 같은 결제 기록이 남아 있는지 */
  ledgerMatched: boolean
  /** 트랜잭션 서명이 유효한지. 서버가 판단하지 못하면 null */
  signatureValid: boolean | null
  /** 로그인한 회원이 이 결제의 당사자인지. 당사자여야 detail 이 내려온다 */
  party: boolean
  detail: TxDetail | null
}

const VERIFY_ERROR = '트랜잭션을 조회할 수 없습니다.'

/** 로그인 상태로 조회해야 서버가 당사자인지 판단해 detail 을 내려준다. 비회원도 조회할 수 있으므로 토큰은 있을 때만 붙인다 */
export async function getTxVerification(txHash: string, token?: string | null): Promise<TxVerification> {
  let payload: { data?: Partial<TxVerification> }
  try {
    const res = await fetch(apiUrl(`/api/blockchain/verify/${encodeURIComponent(txHash)}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) throw new Error()
    payload = await res.json()
  } catch {
    throw new Error(VERIFY_ERROR)
  }
  const data = payload.data
  if (!data) throw new Error(VERIFY_ERROR)
  return {
    txHash: data.txHash ?? txHash,
    verified: data.verified ?? false,
    reason: data.reason ?? null,
    reasonMessage: data.reasonMessage ?? null,
    height: data.height ?? null,
    orderId: data.orderId ?? null,
    amount: data.amount ?? null,
    paidAt: data.paidAt ?? null,
    ledgerMatched: data.ledgerMatched ?? false,
    signatureValid: data.signatureValid ?? null,
    party: data.party ?? false,
    detail: data.detail ?? null,
  }
}

/** 결제액은 시안처럼 세 자리마다 끊고 통화를 붙인다 */
export function formatAmount(amount: number | null): string | null {
  return amount === null ? null : `${amount.toLocaleString('ko-KR')} KRW`
}
