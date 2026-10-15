import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import { colors } from '@/constants/theme'

// 아직 옮기지 않은 화면 자리 (웹 /notice 의 '준비 중' 안내와 같은 모양)
export default function ComingSoon({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <Ionicons name="construct-outline" size={48} color={colors.zinc300} />
      <Text size="lg" weight="semibold">
        {title}는 준비 중입니다.
      </Text>
      <Text size="sm" color={colors.zinc400}>
        빠른 시일 내에 찾아뵙겠습니다.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
})
