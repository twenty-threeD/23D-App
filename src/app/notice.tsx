import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import Button from '@/components/ui/Button'
import BackHeader from '@/components/BackHeader'
import ComingSoon from '@/components/ComingSoon'
import { colors } from '@/constants/theme'

// 웹 /notice. 아직 문서가 없는 약관 등을 '준비 중'으로 안내한다
export default function Page() {
  const { title } = useLocalSearchParams<{ title?: string }>()

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }

  return (
    <View style={styles.container}>
      <BackHeader />
      <ComingSoon title={title || '이 페이지'}>
        <Button onPress={goBack}>돌아가기</Button>
      </ComingSoon>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
})
