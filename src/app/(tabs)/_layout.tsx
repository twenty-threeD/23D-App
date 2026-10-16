import { Tabs } from 'expo-router/js-tabs'
import AppHeader from '@/components/AppHeader'
import TabBar from '@/components/TabBar'
import { colors } from '@/constants/theme'

export default function Layout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      // 뒤로가기를 누르면 직전 탭이 아니라 메인으로 돌아간다. 메인에서 한 번 더 누르면 앱을 나간다
      backBehavior="initialRoute"
      screenOptions={{
        header: () => <AppHeader />,
        sceneStyle: { backgroundColor: colors.white },
      }}
    >
      {/* 랜딩 없이 메인이 첫 화면이다. 메인은 탭 버튼이 없다(웹 모바일과 같이 로고로 돌아온다) */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="upload" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="blockchain" />
    </Tabs>
  )
}
