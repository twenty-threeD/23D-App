// 빌드 때 .env 의 EXPO_PUBLIC_* 값이 번들에 그대로 박힌다. 비밀 키를 넣으면 안 된다(토스 클라이언트 키처럼 공개용만).
// 값이 없을 때는 웹(next.config.ts·.example.env)과 같은 운영 주소를 쓴다
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.idta.store').replace(/\/$/, '')

// 웹 서비스 주소. 결제창 웹뷰의 출처와 결제 후 돌아올 주소(앱이 가로채서 실제로 열리지는 않는다)에 쓴다
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.idta.store').replace(/\/$/, '')

// 토스페이먼츠 결제창 연동 클라이언트 키(test_ck_… / live_ck_…)
export const TOSS_CLIENT_KEY = process.env.EXPO_PUBLIC_TOSS_CLIENT_KEY ?? ''

// 웹은 노드 REST 가 CORS 를 막아 라우트 핸들러로 대신 불렀다. 앱은 CORS 가 없어 노드를 직접 부른다
export const CHAIN_REST_URL = (process.env.EXPO_PUBLIC_CHAIN_REST_URL ?? 'https://blockchain.idta.store').replace(/\/$/, '')

// 피어 수(/net_info)용 CometBFT RPC 주소. 없으면 '운용 노드'는 '-' 로 보인다(웹과 같다)
export const CHAIN_RPC_URL = process.env.EXPO_PUBLIC_CHAIN_RPC_URL?.replace(/\/$/, '') ?? null

// NewBlock 구독용 CometBFT 웹소켓. 없으면 REST 폴링으로 동작한다
export const CHAIN_RPC_WS = process.env.EXPO_PUBLIC_CHAIN_RPC_WS ?? null

// 채팅·통화 STOMP. 서버는 SockJS 엔드포인트라 원시 웹소켓은 /websocket 하위 경로로 붙는다
export const WS_STOMP_URL = `${API_URL.replace(/^http/, 'ws')}/ws-stomp/websocket`
