import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import { colors } from '@/constants/theme'
import { retryNow, useNetworkStore } from '@/lib/network'

// 5초 넘게 서버 응답이 없으면 화면 위를 덮는다. 웹에는 없는 화면이다(브라우저가 자체 오프라인 화면을 보여줘서).
// 아래 화면은 그대로 두어, 연결이 돌아오면 이 화면만 걷히고 붙들어 둔 요청이 내용을 채운다
export default function OfflineScreen() {
  const offline = useNetworkStore((s) => s.offline)
  const [retrying, setRetrying] = useState(false)

  if (!offline) return null

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await retryNow()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <View style={styles.container} accessibilityViewIsModal>
      <Ionicons name="cloud-offline-outline" size={44} color={colors.zinc300} />
      <Text size="lg" weight="semibold">
        인터넷에 연결되어 있지 않아요
      </Text>
      <Text size="sm" color={colors.zinc400} align="center">
        연결 상태를 확인한 뒤 다시 시도해주세요.{'\n'}연결되면 자동으로 다시 불러와요.
      </Text>
      <Button loading={retrying} onPress={() => void handleRetry()}>
        다시 시도
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: colors.white,
  },
})
