import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius } from '@/constants/theme'
import Text from './Text'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

// 웹 components/ui/Button.tsx 와 같은 변형·크기를 쓴다. 앱에는 hover 가 없어 누르고 있을 때의 색으로 대신한다
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  style,
  children,
  ...props
}: ButtonProps) {
  const inactive = disabled || loading

  return (
    <Pressable
      {...props}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        SIZE[size],
        VARIANT[variant].container,
        pressed && VARIANT[variant].pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {({ pressed }) => (
        <View style={styles.content}>
          {loading ? <ActivityIndicator size="small" color={VARIANT[variant].text} /> : icon}
          {typeof children === 'string' ? (
            <Text
              size={size === 'sm' ? 'xs' : 'sm'}
              weight="semibold"
              color={pressed && VARIANT[variant].pressedText ? VARIANT[variant].pressedText : VARIANT[variant].text}
            >
              {children}
            </Text>
          ) : (
            children
          )}
        </View>
      )}
    </Pressable>
  )
}

const SIZE: Record<Size, ViewStyle> = {
  sm: { paddingHorizontal: 12, paddingVertical: 6 },
  md: { paddingHorizontal: 16, paddingVertical: 9 },
  lg: { alignSelf: 'stretch', paddingVertical: 12 },
}

const VARIANT: Record<Variant, { container: ViewStyle; pressed: ViewStyle; text: string; pressedText?: string }> = {
  primary: {
    container: { backgroundColor: colors.main },
    pressed: { backgroundColor: colors.mainPressed },
    text: colors.white,
  },
  secondary: {
    container: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
    pressed: { borderColor: colors.main },
    text: colors.zinc600,
    pressedText: colors.main,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: colors.zinc100 },
    text: colors.zinc500,
  },
  danger: {
    container: { backgroundColor: colors.red500 },
    pressed: { backgroundColor: colors.red600 },
    text: colors.white,
  },
  dangerOutline: {
    container: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
    pressed: { borderColor: colors.red400 },
    text: colors.red500,
  },
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  disabled: {
    opacity: 0.4,
  },
})
