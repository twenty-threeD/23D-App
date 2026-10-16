import { Client, type IFrame, type StompConfig } from '@stomp/stompjs'
import { WS_STOMP_URL } from './config'
import { useAuthStore } from '@/store/authStore'

// RN 의 WebSocket 은 세 번째 인자로 핸드셰이크 헤더를 받는다. 타입은 브라우저(DOM) 정의가 잡혀 있어 따로 적는다
type NativeWebSocket = new (url: string, protocols?: string | string[], options?: { headers: Record<string, string> }) => WebSocket

// 토큰은 만료 전에 재발급되므로 접속·발송 직전마다 스토어에서 최신 값을 꺼낸다
function currentToken() {
  return useAuthStore.getState().accessToken ?? ''
}

// 웹은 SockJS 를 썼지만 브라우저 SockJS 는 핸드셰이크에 헤더를 못 실어 쿠키로 인증했다.
// 앱의 WebSocket 은 핸드셰이크에 헤더를 실을 수 있어, 서버의 SockJS 원시 웹소켓 경로(/ws-stomp/websocket)로 바로 붙고
// 핸드셰이크(JWT 필터)와 STOMP CONNECT(채널 인터셉터) 양쪽에 같은 토큰을 보낸다
export function createStompClient(config: Omit<StompConfig, 'webSocketFactory' | 'beforeConnect' | 'onConnect'> & {
  onConnect: (client: Client, frame: IFrame) => void
}) {
  const { onConnect, ...rest } = config
  const client: Client = new Client({
    webSocketFactory: () =>
      new (WebSocket as unknown as NativeWebSocket)(WS_STOMP_URL, ['v12.stomp', 'v11.stomp', 'v10.stomp'], {
        headers: { Authorization: `Bearer ${currentToken()}` },
      }),
    // RN 의 WebSocket 은 문자열 프레임 끝의 NULL 을 잘라먹거나(수신) 중간에서 끊는(송신) 경우가 있어
    // 송신은 바이너리 프레임으로 보내고, 수신은 빠진 NULL 을 붙여 STOMP 프레임 끝을 알아보게 한다
    forceBinaryWSFrames: true,
    appendMissingNULLonIncoming: true,
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    ...rest,
    beforeConnect: () => {
      client.connectHeaders = { Authorization: `Bearer ${currentToken()}` }
    },
    onConnect: (frame) => onConnect(client, frame),
  })
  return client
}

// 채팅 발송. 서버 /app/chat.send 는 메시지마다 Authorization 헤더를 다시 본다
export function sendChatMessage(client: Client, roomId: number, message: string, fileUrls: string[] = []) {
  client.publish({
    destination: '/app/chat.send',
    headers: { Authorization: `Bearer ${currentToken()}` },
    body: JSON.stringify({ roomId, message, fileUrls }),
  })
}
