import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, FONT_FAMILY, radius } from '@/constants/theme'

interface SearchBarProps {
  value: string
  onChangeText: (value: string) => void
  onSubmit: () => void
  placeholder: string
}

// 메인·능력자 찾기가 같은 시안의 검색창을 쓴다 (h-52, rounded-xl, 포커스 시 브랜드색 테두리)
export default function SearchBar({ value, onChangeText, onSubmit, placeholder }: SearchBarProps) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.box, focused && styles.focused]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        returnKeyType="search"
        selectionColor={colors.main}
        cursorColor={colors.main}
        style={styles.input}
      />
      <Pressable onPress={onSubmit} hitSlop={8} accessibilityLabel="검색">
        <Ionicons name="search" size={22} color={colors.placeholder} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  focused: {
    borderColor: colors.main,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONT_FAMILY,
    fontWeight: '500',
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 0,
    includeFontPadding: false,
  },
})
