import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toAbsoluteUrl } from '@/lib/file'

interface ImageLightboxProps {
  src: string | null
  onClose: () => void
}

// 이미지를 화면 가득 보여준다. 바깥(어두운 곳)이나 닫기 버튼, 안드로이드 뒤로가기로 닫힌다
export default function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={!!src} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기">
        <View style={styles.frame}>
          {src ? <Image source={{ uri: toAbsoluteUrl(src) }} style={styles.image} contentFit="contain" /> : null}
        </View>
      </Pressable>
      <Pressable
        onPress={onClose}
        accessibilityLabel="닫기"
        style={[styles.close, { top: insets.top + 12 }]}
        hitSlop={8}
      >
        <Ionicons name="close" size={24} color="#fff" />
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 16,
  },
  frame: {
    flex: 1,
  },
  image: {
    flex: 1,
  },
  close: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
