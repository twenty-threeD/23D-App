import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { colors } from '@/constants/theme'

// 메인 화면이 들어오기 전까지 폰트·토큰이 제대로 붙었는지 보는 자리다
export default function Page() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Image source={require('@/assets/images/logo.png')} style={styles.logo} contentFit="contain" />
        <Text size="xl" weight="semibold" color={colors.ink} align="center">
          블록체인 기반 용역 중개 플랫폼,{' '}
          <Text size="2xl" weight="bold" color={colors.main}>
            잇다
          </Text>
        </Text>
        <Button onPress={() => toast.success('준비 중입니다.')}>시작하기</Button>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 20 },
  logo: { width: 84, height: 56 },
})
