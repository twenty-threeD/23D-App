import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius } from '@/constants/theme'

// 웹 로그인·가입·비밀번호 재설정이 같은 틀(회색 바탕 위 흰 카드 + 왼쪽 위 뒤로가기)을 쓴다.
// 휴대폰 웹처럼 그림 패널은 빼고 입력 카드만 화면 폭에 맞춘다
export default function AuthCard({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Pressable onPress={() => router.navigate('/')} accessibilityLabel="잇다 홈">
              <Image source={require('@/assets/images/logo.png')} style={styles.logo} contentFit="contain" />
            </Pressable>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityLabel="뒤로가기"
        hitSlop={8}
        style={[styles.back, { top: insets.top + 12 }]}
      >
        <Ionicons name="chevron-back" size={24} color={colors.black} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.zinc100,
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 48,
    borderRadius: radius['3xl'],
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  logo: {
    width: 80,
    height: 53,
  },
  back: {
    position: 'absolute',
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
