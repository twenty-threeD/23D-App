import { create } from 'zustand'

export type NotificationType = 'chat' | 'notice' | 'call'

export interface AppNotification {
  id: number
  type: NotificationType
  senderName: string
  message: string
  createdAt: string
  roomId: number | null
  /** 누르면 갈 경로. 채팅방 이동이 아닌 알림(비밀번호 설정 안내 등)에 쓴다 */
  link?: string
}

interface NotificationStore {
  notifications: AppNotification[]
  setNotifications: (list: AppNotification[]) => void
  /** 같은 방 채팅 알림은 최신 것 하나만 남긴다(웹 벨과 같다) */
  push: (notification: AppNotification) => void
  remove: (predicate: (notification: AppNotification) => boolean) => void
  reset: () => void
}

// 웹은 헤더(벨)가 한 개라 훅 안에 목록을 들었다. 앱은 탭마다 머리줄이 따로 떠서, 목록을 한 곳에 모으고 구독도 한 번만 한다
export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  setNotifications: (list) => set({ notifications: list }),
  push: (notification) =>
    set((s) => ({
      notifications: [
        notification,
        ...(notification.type === 'chat' && notification.roomId !== null
          ? s.notifications.filter((n) => n.roomId !== notification.roomId)
          : s.notifications),
      ],
    })),
  remove: (predicate) => set((s) => ({ notifications: s.notifications.filter((n) => !predicate(n)) })),
  reset: () => set({ notifications: [] }),
}))
