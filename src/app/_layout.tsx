import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ToastHost } from '@/components/ui/Toast'
import CallProvider from '@/components/call/CallProvider'
import OfflineScreen from '@/components/OfflineScreen'
import { colors } from '@/constants/theme'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { useNotificationSubscription } from '@/hooks/useNotificationSubscription'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { installNetworkGuard } from '@/lib/network'

// 첫 화면이 요청을 보내기 전에 감싸야 앱을 켤 때부터 끊김을 잡는다. 그래서 컴포넌트가 아니라 모듈을 읽을 때 건다
installNetworkGuard()

export default function Layout() {
  // 저장된 로그인 정보를 꺼내고 만료 전에 재발급을 예약한다 (웹 AuthProvider)
  useAuthBootstrap()
  // 알림은 머리줄마다가 아니라 앱 전체에서 한 번만 구독한다
  useNotificationSubscription()
  // 앱이 꺼져 있거나 백그라운드일 때 채팅·전화를 알리는 푸시. 로그인하면 기기 토큰을 서버에 등록한다
  usePushNotifications()

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }} />
      {/* 인터넷이 끊기면 모든 화면 위를 덮는다. 통화 화면은 그보다 위에 둬 통화 중엔 가리지 않는다 */}
      <OfflineScreen />
      {/* 통화 화면은 어느 화면 위에서든 떠야 해서 화면 묶음 바깥(위)에 둔다 */}
      <CallProvider />
      <ToastHost />
    </>
  )
}
