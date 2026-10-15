import { forwardRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, FONT_FAMILY, radius } from '@/constants/theme'
import Text from './Text'

interface TextFieldProps extends TextInputProps {
  invalid?: boolean
  /** 입력칸 오른쪽에 붙는 단위·버튼(원, 일, 보기 토글 등) */
  right?: ReactNode
  containerStyle?: StyleProp<ViewStyle>
}

// 웹 components/ui/Field.tsx 의 inputClass·inputShellClass 를 하나로 합쳤다.
// 테두리·라운드·포커스 색을 한곳에서 관리해야 화면마다 입력칸 모양이 갈리지 않는다
const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { invalid, right, containerStyle, style, editable = true, multiline, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false)

  return (
    <View
      style={[
        styles.shell,
        multiline && styles.multilineShell,
        focused && styles.focused,
        invalid && styles.invalid,
        !editable && styles.disabled,
        containerStyle,
      ]}
    >
      <TextInput
        ref={ref}
        {...props}
        editable={editable}
        multiline={multiline}
        placeholderTextColor={colors.zinc400}
        selectionColor={colors.main}
        cursorColor={colors.main}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        style={[styles.input, multiline && styles.multilineInput, !editable && styles.disabledText, style]}
      />
      {right}
    </View>
  )
})

export default TextField

// 보기/숨기기 토글이 붙은 비밀번호 입력칸. 웹 로그인·비밀번호 모달과 같은 동작이다
export const PasswordField = forwardRef<TextInput, Omit<TextFieldProps, 'secureTextEntry' | 'right'>>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false)
    return (
      <TextField
        ref={ref}
        {...props}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        right={
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            accessibilityLabel={visible ? '비밀번호 숨기기' : '비밀번호 표시'}
          >
            <Ionicons name={visible ? 'eye' : 'eye-off'} size={18} color={colors.zinc400} />
          </Pressable>
        }
      />
    )
  },
)

// 라벨 + 입력칸 묶음 (웹 Field)
export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text size="sm" weight="medium" color={error ? colors.red500 : colors.zinc600}>
        {error ? `${label} · ${error}` : label}
      </Text>
      {children}
      {hint ? (
        <Text size="xs" color={colors.inkHint}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    minHeight: 44,
  },
  multilineShell: {
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  focused: {
    borderColor: colors.main,
  },
  invalid: {
    borderColor: colors.red400,
  },
  disabled: {
    backgroundColor: colors.zinc100,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    color: colors.black,
    paddingVertical: 10,
    includeFontPadding: false,
  },
  multilineInput: {
    paddingVertical: 0,
    textAlignVertical: 'top',
    minHeight: 72,
  },
  disabledText: {
    color: colors.zinc500,
  },
  field: {
    gap: 6,
  },
})
