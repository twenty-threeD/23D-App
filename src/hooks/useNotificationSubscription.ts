import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { useAuthStore } from '@/store/authStore'
import { useChatRoomsStore } from '@/store/chatRoomsStore'
import { useNotificationStore, type AppNotification } from '@/store/notificationStore'
import { getNotifications, readAllNotifications, readNotification, subscribeToNotifications, type NotificationResponse } from '@/lib/notifications'
import { previewOf } from '@/lib/chatPreview'

// 서버 NOTICE 에는 이동 경로가 없어서, 비밀번호 설정 안내만 문구로 알아보고 프로필로 보낸다
const PASSWORD_NOTICE_PREFIX = '비밀번호가 설정되지 않았어요'

function toNotification(n: NotificationResponse): AppNotification {
  if (n.type === 'CALL_MISSED') {
    return {
      id: n.notificationId ?? -Date.now(),
      type: 'call',
      senderName: n.senderName ?? '부재중 전화',
      message: n.message || '부재중 전화가 있어요.',
      createdAt: n.sentAt,
      roomId: n.roomId,
      // 누르면 전화가 걸려온 채팅방으로 보낸다. 채팅 알림과 달리 같은 방이어도 묶지 않아 따로 경로를 둔다
      link: n.roomId != null ? `/chat/${n.roomId}` : undefined,
    }
  }
  return {
    id: n.notificationId ?? -Date.now(),
    type: n.type === 'NOTICE' ? 'notice' : 'chat',
    senderName: n.senderName ?? '공지',
    // 카드형 메시지는 "[접두사]\nJSON" 원문이라 채팅 목록과 같은 요약 문구로 바꿔 보여준다
    message: n.type === 'NOTICE' ? n.message : previewOf(n.message),
    createdAt: n.sentAt,
    roomId: n.roomId,
    link: n.type === 'NOTICE' && n.message.startsWith(PASSWORD_NOTICE_PREFIX) ? '/profile' : undefined,
  }
}

// 같은 방에서 온 채팅 알림은 최신 것만 남기고, 밀려난 나머지는 서버에도 읽음 처리한다
function dedupeByRoom(list: AppNotification[]) {
  const seenRooms = new Set<number>()
  const kept: AppNotification[] = []
  const staleIds: number[] = []
  for (const n of list) {
    if (n.type === 'chat' && n.roomId !== null) {
      if (seenRooms.has(n.roomId)) {
        staleIds.push(n.id)
        continue
      }
      seenRooms.add(n.roomId)
    }
    kept.push(n)
  }
  return { kept, staleIds }
}

function markRead(id: number) {
  const token = useAuthStore.getState().accessToken
  if (token && id > 0) readNotification(token, id).catch(() => {})
}

/** 알림 하나를 읽음 처리한다(목록에서 빼고 서버에도 알린다) */
export function markNotificationRead(id: number) {
  useNotificationStore.getState().remove((n) => n.id === id)
  markRead(id)
}

export function clearAllNotifications() {
  useNotificationStore.getState().reset()
  const token = useAuthStore.getState().accessToken
  if (token) readAllNotifications(token).catch(() => {})
}

// 웹 useChatNotifications 의 구독 부분. 앱 전체에서 한 번만 부른다(루트 레이아웃).
// 웹은 탭이 숨겨져도 연결을 유지했지만, 앱은 백그라운드에서 스트림이 끊기거나 배터리를 쓰므로
// 앞에 나와 있을 때만 구독하고, 다시 앞에 나오면 그동안 쌓인 목록을 새로 받는다
export function useNotificationSubscription() {
  const token = useAuthStore((s) => s.accessToken)
  const activeRoomId = useChatRoomsStore((s) => s.activeRoomId)
  const notifications = useNotificationStore((s) => s.notifications)
  const [active, setActive] = useState(AppState.currentState === 'active')

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'))
    return () => subscription.remove()
  }, [])

  // 채팅방에 들어가 있는 동안은 그 방에서 온 알림을 벨에서 지운다
  useEffect(() => {
    if (activeRoomId === null) return
    const stale = notifications.filter((n) => n.type === 'chat' && n.roomId === activeRoomId)
    if (stale.length === 0) return
    stale.forEach((n) => markRead(n.id))
    useNotificationStore.getState().remove((n) => n.type === 'chat' && n.roomId === activeRoomId)
  }, [activeRoomId, notifications])

  useEffect(() => {
    if (!token) {
      useNotificationStore.getState().reset()
      return
    }
    if (!active) return
    let cancelled = false

    getNotifications(token)
      .then((list) => {
        if (cancelled) return
        const { kept, staleIds } = dedupeByRoom(list.map(toNotification))
        useNotificationStore.getState().setNotifications(kept)
        staleIds.forEach(markRead)
      })
      .catch(() => {})

    const unsubscribe = subscribeToNotifications(token, {
      onNotification: (raw) => {
        const n = toNotification(raw)
        if (n.type === 'chat' && n.roomId !== null) {
          // 이미 보고 있는 방이면 벨에 쌓지 않고 바로 읽음 처리한다
          if (useChatRoomsStore.getState().activeRoomId === n.roomId) {
            markRead(n.id)
            return
          }
          // 채팅 목록은 원문의 대괄호 접두사로 거래 완료·취소를 가르므로, 요약 문구가 아닌 원문을 넘긴다
          useChatRoomsStore.getState().markRoomUnread(n.roomId, raw.message, raw.sentAt)
        }
        useNotificationStore.getState().push(n)
      },
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [token, active])
}
