import { StyleSheet, View } from 'react-native'
import { router, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import { colors } from '@/constants/theme'
import { signinHref } from '@/lib/navigation'

// 로그인해야 쓸 수 있는 탭(채팅 등). 웹은 미들웨어가 로그인 화면으로 튕겼지만,
// 탭에서 바로 튕기면 뒤로가기 때마다 다시 튕겨 갇히므로 안내와 로그인 버튼을 보여준다
export default function LoginRequired({ message = '로그인하고 이용해주세요.' }: { message?: string }) {
  const pathname = usePathname()
  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed-outline" size={44} color={colors.zinc300} />
      <Text size="lg" weight="semibold">
        로그인이 필요해요
      </Text>
      <Text size="sm" color={colors.zinc400} align="center">
        {message}
      </Text>
      <Button onPress={() => router.push(signinHref(pathname) as never)}>로그인</Button>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
})
