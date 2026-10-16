import { Pressable, StyleSheet } from 'react-native'
import Text from '@/components/ui/Text'
import { colors, radius } from '@/constants/theme'

// 로그인·가입 단계의 큰 버튼(웹 w-75 h-10 text-lg bold). 조건을 못 채우면 회색으로 눌리지 않는다
export default function SubmitButton({ label, enabled, onPress }: { label: string; enabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [styles.button, enabled ? (pressed ? styles.pressed : styles.enabled) : styles.disabled]}
    >
      <Text size="lg" weight="bold" color={enabled ? colors.white : colors.zinc500}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    maxWidth: 300,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enabled: { backgroundColor: colors.main },
  pressed: { backgroundColor: colors.mainPressed },
  disabled: { backgroundColor: colors.zinc300 },
})
