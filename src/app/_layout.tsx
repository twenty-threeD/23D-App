import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ToastHost } from '@/components/ui/Toast'
import { colors } from '@/constants/theme'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { useNotificationSubscription } from '@/hooks/useNotificationSubscription'

export default function Layout() {
  // 저장된 로그인 정보를 꺼내고 만료 전에 재발급을 예약한다 (웹 AuthProvider)
  useAuthBootstrap()
  // 알림은 머리줄마다가 아니라 앱 전체에서 한 번만 구독한다
  useNotificationSubscription()

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }} />
      <ToastHost />
    </>
  )
}
