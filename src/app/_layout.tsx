import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ToastHost } from '@/components/ui/Toast'
import { colors } from '@/constants/theme'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

export default function Layout() {
  // 저장된 로그인 정보를 꺼내고 만료 전에 재발급을 예약한다 (웹 AuthProvider)
  useAuthBootstrap()

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }} />
      <ToastHost />
    </>
  )
}
