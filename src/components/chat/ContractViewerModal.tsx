import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import BackHeader from '@/components/BackHeader'
import PdfView from '@/components/PdfView'
import { colors } from '@/constants/theme'

// 체결된 계약서 PDF 를 앱 안에서 본다. 웹은 새 탭에서 파일을 열었지만,
// 앱에서 외부로 열면 PDF 뷰어가 없는 기기는 아무것도 못 보고 파일 응답에 인증도 필요해 결제 화면과 같은 뷰어를 쓴다
export default function ContractViewerModal({ url, onClose }: { url: string; onClose: () => void }) {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // 머리줄(52)과 위아래 안전 영역을 뺀 나머지를 계약서로 채운다
  const viewerHeight = Math.max(240, height - insets.top - insets.bottom - 52)

  return (
    <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.container}>
        <BackHeader title="계약서" onBack={onClose} />
        <PdfView url={url} height={viewerHeight} />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
})
