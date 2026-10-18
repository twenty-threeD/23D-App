import { useEffect } from 'react'
import { router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '@/store/authStore'
import { getExpoPushToken, pushDataOf, registerPushToken } from '@/lib/push'

// 앱을 보고 있을 때는 시스템 배너를 띄우지 않는다. 그때는 실시간 연결(SSE·STOMP)이 알림 벨·통화 화면으로 이미 알려줘서
// 배너까지 뜨면 같은 알림이 두 번 보인다. 푸시는 앱이 백그라운드·종료 상태일 때만 시스템이 보여준다
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
})

function openFrom(notification: Notifications.Notification) {
  const data = pushDataOf(notification)
  if (!data?.roomId) return
  // 전화도 그 방으로 보낸다. 울리던 전화는 앱이 앞으로 나올 때 CallProvider 가 서버에서 다시 받아 벨 화면을 띄운다
  router.push(`/chat/${data.roomId}`)
}

// 루트 레이아웃에서 한 번만 부른다
export function usePushNotifications() {
  const username = useAuthStore((s) => s.username)

  // 로그인한 계정이 바뀔 때마다 이 기기 토큰을 서버에 등록한다.
  // 같은 토큰을 다른 계정으로 다시 등록하면 서버가 이전 계정에서 뺀다
  useEffect(() => {
    if (!username) return
    let cancelled = false
    void getExpoPushToken()
      .then((pushToken) => {
        const accessToken = useAuthStore.getState().accessToken
        if (cancelled || !pushToken || !accessToken) return
        return registerPushToken(accessToken, pushToken)
      })
      // 권한 거부·네트워크 실패여도 앱은 그대로 쓸 수 있다. 다음 실행 때 다시 시도한다
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [username])

  // 알림을 눌러 앱이 열렸을 때(종료 상태에서 시작 포함) 해당 채팅방으로 보낸다
  useEffect(() => {
    const last = Notifications.getLastNotificationResponse()
    if (last?.notification) openFrom(last.notification)
    const sub = Notifications.addNotificationResponseReceivedListener((response) => openFrom(response.notification))
    return () => sub.remove()
  }, [])
}
