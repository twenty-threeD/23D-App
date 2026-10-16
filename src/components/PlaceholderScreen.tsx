import { View } from 'react-native'
import BackHeader from '@/components/BackHeader'
import ComingSoon from '@/components/ComingSoon'
import { colors } from '@/constants/theme'

// 탭 밖 화면 중 아직 옮기지 않은 자리 (뒤로가기 머리줄 + 준비 중 안내)
export default function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <BackHeader />
      <ComingSoon title={title} />
    </View>
  )
}
