import { forwardRef, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import { colors, FONT_FAMILY } from '@/constants/theme'

const ERROR = '#FF0000'

interface InputFieldProps extends Omit<TextInputProps, 'placeholder'> {
  /** 에러일 때 입력칸 아래에 보이는 문구 */
  label?: string
  /** 입력칸 안에 있다가 입력·포커스하면 위로 올라가는 이름 */
  placeholder: string
  isError?: boolean
  /** 비밀번호 보기/숨기기 토글 */
  showIcon?: boolean
}

// 웹 로그인·가입 화면의 밑줄 입력칸(InputField)을 옮겼다. 포커스·입력 상태면 이름이 위로 작게 올라간다
const InputField = forwardRef<TextInput, InputFieldProps>(function InputField(
  { label, placeholder, isError = false, showIcon = false, value, secureTextEntry, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(!!secureTextEntry)
  const floating = focused || !!value
  const lineColor = isError ? ERROR : focused ? colors.main : colors.line
  const labelColor = isError ? ERROR : focused ? colors.main : colors.zinc400

  return (
    <View style={styles.container}>
      <View style={[styles.field, { borderBottomColor: lineColor }]}>
        <Text style={[styles.floatingLabel, floating ? styles.labelUp : styles.labelDown]} color={labelColor} pointerEvents="none">
          {placeholder}
        </Text>
        <TextInput
          ref={ref}
          {...props}
          value={value}
          secureTextEntry={showIcon ? hidden : secureTextEntry}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          selectionColor={colors.main}
          cursorColor={colors.main}
          style={[styles.input, { color: isError ? ERROR : focused ? colors.main : colors.black }]}
        />
        {showIcon ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityLabel={hidden ? '비밀번호 표시' : '비밀번호 숨기기'}>
            <Ionicons name={hidden ? 'eye-off' : 'eye'} size={20} color={colors.black} />
          </Pressable>
        ) : null}
      </View>
      {isError && label ? (
        <Text size="xs" color={ERROR}>
          {label}
        </Text>
      ) : null}
    </View>
  )
})

export default InputField

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 300,
    gap: 4,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderBottomWidth: 2,
    paddingTop: 16,
  },
  floatingLabel: {
    position: 'absolute',
    left: 0,
  },
  labelUp: {
    top: 0,
    fontSize: 12,
    lineHeight: 16,
  },
  labelDown: {
    top: 22,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    paddingVertical: 8,
    includeFontPadding: false,
  },
})
