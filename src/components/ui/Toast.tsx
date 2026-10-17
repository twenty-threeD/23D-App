import { useCallback, useEffect, useState } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { radius } from '@/constants/theme'
import Text from './Text'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

// 웹은 sonner(richColors, 2초)를 썼다. 앱에서는 같은 색·같은 시간으로 화면 위쪽에 띄운다.
// 훅 밖(스토어·라이브러리)에서도 띄울 수 있어야 해서 모듈 단위로 구독자를 둔다
const DURATION = 2000
const MAX_VISIBLE = 3

type Listener = (item: ToastItem) => void
// RN Modal 은 별도 창이라 루트의 토스트가 그 아래에 깔려 보이지 않는다. 그래서 모달 안에도 호스트를 두고,
// 가장 나중에 붙은(=맨 위에 떠 있는) 호스트 하나에만 보내 같은 토스트가 두 번 뜨지 않게 한다
const listeners: Listener[] = []
let nextId = 1

export function showToast(message: string, type: ToastType = 'success') {
  const item = { id: nextId++, message, type }
  listeners[listeners.length - 1]?.(item)
}

export const toast = {
  success: (message: string) => showToast(message, 'success'),
  error: (message: string) => showToast(message, 'error'),
  warning: (message: string) => showToast(message, 'warning'),
  info: (message: string) => showToast(message, 'info'),
}

const STYLE: Record<ToastType, { bg: string; border: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: '#ECFDF3', border: '#BFFCD9', text: '#008A2E', icon: 'checkmark-circle' },
  error: { bg: '#FFF0F0', border: '#FFE0E1', text: '#E60000', icon: 'alert-circle' },
  warning: { bg: '#FFFCF0', border: '#FDF5D3', text: '#DC7609', icon: 'warning' },
  info: { bg: '#F0F8FF', border: '#D3E0FD', text: '#0973DC', icon: 'information-circle' },
}

function ToastRow({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const [opacity] = useState(() => new Animated.Value(0))
  const [translateY] = useState(() => new Animated.Value(-12))

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start()
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => onDone(item.id))
    }, DURATION)
    return () => clearTimeout(timer)
  }, [item.id, onDone, opacity, translateY])

  const s = STYLE[item.type]
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        onPress={() => onDone(item.id)}
        style={[styles.toast, { backgroundColor: s.bg, borderColor: s.border }]}
        accessibilityRole="alert"
      >
        <Ionicons name={s.icon} size={18} color={s.text} />
        <Text size="sm" weight="medium" color={s.text} style={styles.message}>
          {item.message}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

// 루트 레이아웃에 한 번 두고, 안에서 오류를 띄우는 RN Modal 마다 하나씩 더 둔다
export function ToastHost() {
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener: Listener = (item) => setItems((prev) => [...prev, item].slice(-MAX_VISIBLE))
    listeners.push(listener)
    return () => {
      listeners.splice(listeners.indexOf(listener), 1)
    }
  }, [])

  const remove = useCallback((id: number) => setItems((prev) => prev.filter((i) => i.id !== id)), [])

  if (items.length === 0) return null

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {items.map((item) => (
        <ToastRow key={item.id} item={item} onDone={remove} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  message: {
    flex: 1,
  },
})
