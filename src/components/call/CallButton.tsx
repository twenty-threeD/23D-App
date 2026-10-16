import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import { colors } from '@/constants/theme'

type Tone = 'normal' | 'off' | 'on' | 'danger' | 'accept'

// normal = 정상 동작 중, off = 꺼둔 상태(흰 버튼으로 강조), on = 켜둔 기능(브랜드 색)
const TONES: Record<Tone, { bg: string; fg: string }> = {
  normal: { bg: 'rgba(255,255,255,0.1)', fg: colors.white },
  off: { bg: colors.white, fg: colors.zinc900 },
  on: { bg: colors.main, fg: colors.white },
  danger: { bg: colors.red500, fg: colors.white },
  accept: { bg: colors.emerald500, fg: colors.white },
}

interface CallButtonProps {
  icon: keyof typeof MaterialIcons.glyphMap
  label: string
  onPress: () => void
  tone?: Tone
  size?: 'md' | 'sm'
  showLabel?: boolean
  disabled?: boolean
  /** 내가 말하는 중일 때 마이크 버튼에 주황 링을 두른다 */
  highlight?: boolean
}

// 통화 화면 어디서나 쓰는 동그란 버튼(웹 call/CallButton). 도크와 전체화면이 같은 조작을 제공한다
export default function CallButton({ icon, label, onPress, tone = 'normal', size = 'md', showLabel = true, disabled, highlight }: CallButtonProps): ReactNode {
  const dimension = size === 'md' ? 56 : 40
  const { bg, fg } = TONES[tone]
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.button,
          { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: bg },
          highlight && styles.highlight,
          (pressed || disabled) && { opacity: disabled ? 0.4 : 0.8 },
        ]}
      >
        <MaterialIcons name={icon} size={size === 'md' ? 26 : 20} color={fg} />
      </Pressable>
      {showLabel ? (
        <Text color="rgba(255,255,255,0.5)" style={styles.label}>
          {label}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  button: { alignItems: 'center', justifyContent: 'center' },
  highlight: { borderWidth: 3, borderColor: colors.main },
  label: { fontSize: 11, lineHeight: 14 },
})
