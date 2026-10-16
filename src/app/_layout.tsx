import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ToastHost } from '@/components/ui/Toast'
import { colors } from '@/constants/theme'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }} />
      <ToastHost />
    </>
  )
}
