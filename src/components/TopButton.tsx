import { Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/theme'

// 긴 목록에서 맨 위로 돌아가는 버튼. 맨 위에 있을 때는 숨긴다(웹 TopButton)
export default function TopButton({ visible, onPress, bottom = 20 }: { visible: boolean; onPress: () => void; bottom?: number }) {
  if (!visible) return null
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="맨위로 이동"
      style={({ pressed }) => [styles.button, { bottom }, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-up" size={24} color={colors.white} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.main,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: {
    backgroundColor: colors.mainPressed,
  },
})
