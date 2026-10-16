import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '@/constants/theme'
import Text from './Text'

interface ModalProps {
  visible?: boolean
  title: string
  /** 작성 중 내용이 날아가면 안 되는 모달은 false 로 둬 바깥을 눌러도 닫히지 않게 한다 */
  closeOnBackdrop?: boolean
  /** 본문을 직접 채우는 모달(계약서처럼)은 기본 패딩·스크롤을 끈다 */
  bare?: boolean
  /** 화면을 거의 다 채우는 큰 모달 */
  full?: boolean
  onClose: () => void
  children: ReactNode
  contentStyle?: StyleProp<ViewStyle>
}

// 웹 components/ui/Modal.tsx 를 옮겼다. 안드로이드 뒤로가기(onRequestClose)도 닫기 버튼과 같게 처리한다
export default function Modal({
  visible = true,
  title,
  closeOnBackdrop = true,
  bare = false,
  full = false,
  onClose,
  children,
  contentStyle,
}: ModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeOnBackdrop ? onClose : undefined} accessible={false} />
          <View style={[styles.panel, full && styles.full]}>
            <View style={styles.header}>
              <Text size="lg" weight="bold" style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기" style={styles.close}>
                <Ionicons name="close" size={22} color={colors.zinc400} />
              </Pressable>
            </View>
            {bare ? (
              <View style={[styles.flexShrink, contentStyle]}>{children}</View>
            ) : (
              <ScrollView
                style={styles.flexShrink}
                contentContainerStyle={[styles.body, contentStyle]}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  )
}

/** 모달 하단의 버튼 줄. 취소/확인 배치를 통일한다. */
export function ModalActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '88%',
    backgroundColor: colors.white,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  full: {
    height: '92%',
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: {
    flexShrink: 1,
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  body: {
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 4,
  },
})
