import { useState, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import Text from '@/components/ui/Text'
import { colors, radius } from '@/constants/theme'

// 카드 제목 옆 '?' 도움말. 웹은 마우스를 올리거나 탭하면 말풍선을 띄웠다.
// 휴대폰에는 호버가 없고 카드 안에 말풍선을 띄우면 스크롤 영역에 잘려서, 눌렀을 때 화면 가운데 작은 카드로 보여준다
export default function HelpTooltip({ title, children, marker }: { title: string; children: ReactNode; marker?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityLabel={`${title} 설명`}
        style={marker ? styles.markerButton : [styles.button, open && styles.buttonOpen]}
      >
        {marker ?? (
          <Text weight="semibold" color={open ? colors.white : colors.placeholder} style={styles.mark}>
            ?
          </Text>
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.card}>
            <Text size="sm" weight="semibold">
              {title}
            </Text>
            <Text size="xs" color={colors.placeholder} style={styles.body}>
              {children}
            </Text>
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.placeholder,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOpen: {
    borderColor: colors.main,
    backgroundColor: colors.main,
  },
  markerButton: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    fontSize: 11,
    lineHeight: 13,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  card: {
    width: '100%',
    maxWidth: 300,
    gap: 6,
    padding: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(170,170,170,0.3)',
    backgroundColor: colors.white,
  },
  body: {
    lineHeight: 19,
  },
})
