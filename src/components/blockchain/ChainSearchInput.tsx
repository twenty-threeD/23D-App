import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, FONT_FAMILY, radius } from '@/constants/theme'

// 트랜잭션 해시 검색창(브랜드색 두꺼운 테두리, 웹 SearchInput)
export default function ChainSearchInput({ onSearch }: { onSearch: (input: string) => void }) {
  const [input, setInput] = useState('')
  const submit = () => {
    const trimmed = input.trim()
    if (trimmed) onSearch(trimmed)
  }
  return (
    <View style={styles.box}>
      <TextInput
        value={input}
        onChangeText={setInput}
        onSubmitEditing={submit}
        placeholder="해시를 입력해주세요."
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        selectionColor={colors.main}
        cursorColor={colors.main}
        accessibilityLabel="해시를 입력해주세요."
        style={styles.input}
      />
      <Pressable onPress={submit} hitSlop={8} accessibilityLabel="검색">
        <Ionicons name="search" size={22} color={colors.placeholder} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 52,
    paddingLeft: 20,
    paddingRight: 22,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.main,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONT_FAMILY,
    fontWeight: '500',
    fontSize: 16,
    color: colors.black,
    paddingVertical: 0,
  },
})
