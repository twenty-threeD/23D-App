import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { toast } from '@/components/ui/Toast'
import { useAuthStore, decodeJwtUsername } from '@/store/authStore'
import { useCallStore } from '@/store/callStore'
import { callEngine } from '@/lib/agoraEngine'
import { createStompClient } from '@/lib/stomp'
import { playHangupTone, startRingtone, stopRingtone } from '@/lib/ringtone'
import type { CallSignalEvent } from '@/lib/call'
import CallOverlay from './CallOverlay'
import CallDock from './CallDock'

// 벨이 울리기 시작하고 이만큼 지나면 스스로 끊는다. 서버도 60초에 MISSED 를 쏘므로 조금 늦게 잡아 서버 판정에 우선권을 준다
const NO_ANSWER_TIMEOUT_MS = 63_000

// 웹 call/CallProvider. 통화 시그널은 채팅방과 달리 앱 어디에 있든 받아야 해서(걸려온 전화를 놓치면 안 된다)
// 로그인한 동안 유지되는 STOMP 연결을 따로 잡고 /user/queue/call 만 구독한다. 통화 화면(전체화면·도크)도 여기서 그린다
export default function CallProvider() {
  const token = useAuthStore((s) => s.accessToken)
  const hasToken = !!token
  const username = useAuthStore((s) => s.username ?? (s.accessToken ? decodeJwtUsername(s.accessToken) : null))
  const phase = useCallStore((s) => s.phase)
  const error = useCallStore((s) => s.error)
  const notice = useCallStore((s) => s.notice)
  const tokenRef = useRef(token)
  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    useCallStore.getState().setMyUsername(username)
  }, [username])

  // 앱을 껐다 켜면 채널에서 빠지지만 서버의 통화는 남아 있다. 들어오자마자 한 번만 되살린다
  const resumedRef = useRef(false)
  useEffect(() => {
    const current = useAuthStore.getState().accessToken
    if (!current || !username || resumedRef.current) return
    resumedRef.current = true
    void useCallStore.getState().resume(current).catch(() => {})
  }, [hasToken, username])

  useEffect(() => {
    callEngine.setHandlers({
      onRemoteVideo: (kind, uid) => useCallStore.getState().setRemoteVideo(kind, uid),
      onTokenExpiring: () => {
        const t = tokenRef.current
        if (t) void useCallStore.getState().renew(t)
      },
      // 상대가 앱을 끄거나 네트워크가 끊기면 종료 신호 없이 채널에서만 사라진다. 곧 돌아올 수 있어 기다린다
      onPeerLeft: () => useCallStore.getState().handlePeerLeft(() => tokenRef.current),
      onPeerJoined: () => useCallStore.getState().handlePeerJoined(),
      // 시스템 알림의 '중지'로 공유가 끝나도 우리 버튼을 누른 것처럼 정리해야 서버 점유까지 풀린다
      onScreenEnded: () => {
        const t = tokenRef.current
        if (t && useCallStore.getState().screenOn) void useCallStore.getState().toggleScreen(t)
      },
      onAudioOutput: (output) => useCallStore.getState().setAudioOutput(output),
      onError: (message) => useCallStore.getState().setError(message),
    })
  }, [])

  // 안내는 통화 화면이 떠 있는지와 상관없이 띄운다
  useEffect(() => {
    if (!error) return
    toast.error(error)
    useCallStore.getState().setError(null)
  }, [error])

  useEffect(() => {
    if (!notice) return
    toast.info(notice)
    useCallStore.getState().setNotice(null)
  }, [notice])

  // 벨이 울리는 동안만 소리·진동을 낸다
  useEffect(() => {
    if (phase !== 'incoming') return
    startRingtone()
    return () => stopRingtone()
  }, [phase])

  // 통화가 끝나면 종료음을 낸다. 화면이 닫히는 것만으로는 끊긴 걸 놓치기 쉽다
  const prevPhase = useRef(phase)
  useEffect(() => {
    if (prevPhase.current !== 'idle' && phase === 'idle') playHangupTone()
    prevPhase.current = phase
  }, [phase])

  // 아무도 받지 않는 전화가 영원히 울리지 않게 한다. 서버 MISSED 가 오지 않을 때의 마지막 방어선이기도 하다
  useEffect(() => {
    if (phase !== 'outgoing' && phase !== 'incoming') return
    const id = setTimeout(() => {
      const store = useCallStore.getState()
      if (store.phase !== 'outgoing' && store.phase !== 'incoming') return
      store.setNotice(store.phase === 'incoming' ? '부재중 전화가 있어요.' : '상대방이 받지 않았어요.')
      const t = tokenRef.current
      if (t) void store.hangUp(t)
      else void store.reset()
    }, NO_ANSWER_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [phase])

  // 앱이 백그라운드에 있는 동안 연결이 끊겼다 돌아오면 그 사이의 통화 상태를 다시 맞춘다
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const t = tokenRef.current
      if (state === 'active' && t && useCallStore.getState().phase === 'idle') void useCallStore.getState().resume(t).catch(() => {})
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!hasToken) return
    const client = createStompClient({
      onConnect: (stomp) => {
        stomp.subscribe('/user/queue/call', (message) => {
          let event: CallSignalEvent
          try {
            event = JSON.parse(message.body)
          } catch {
            return
          }
          try {
            useCallStore.getState().applySignal(event)
          } catch {
            // 한 시그널이 망가져도 구독은 살려 둔다
          }
        })
      },
    })
    client.activate()
    return () => {
      void client.deactivate()
    }
  }, [hasToken])

  // 로그아웃하면 통화도 끊는다
  useEffect(() => {
    if (!hasToken && useCallStore.getState().phase !== 'idle') void useCallStore.getState().reset()
  }, [hasToken])

  return (
    <>
      <CallDock />
      <CallOverlay />
    </>
  )
}
