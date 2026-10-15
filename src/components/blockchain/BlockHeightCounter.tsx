import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native'
import Text from '@/components/ui/Text'
import { colors } from '@/constants/theme'

const DURATION = 1200
const DIGIT_HEIGHT = 40

// easeOutExpo: 빠르게 올라가다 목표값 근처에서 부드럽게 멈춘다
function easeOut(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

// 바뀐 자리의 숫자만 아래에서 위로 올라오며 바뀐다. 이 컴포넌트가 새로 붙을 때 한 번 올라온다
function RisingDigit({ char }: { char: string }) {
  const [progress] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 450, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }).start()
  }, [progress])
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [DIGIT_HEIGHT, 0] })
  return (
    <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>
      <Text weight="medium" color={colors.main} style={styles.digit}>
        {char}
      </Text>
    </Animated.View>
  )
}

/**
 * 처음 받은 블록 높이는 0에서부터 세어 올리고,
 * 이후 갱신될 때는 값이 바뀐 자리의 숫자만 아래에서 위로 올라오며 교체된다 (웹과 같은 연출)
 */
export default function BlockHeightCounter({ value }: { value: number | null }) {
  // 이전 값을 함께 들고 있어야 어느 자리가 바뀌었는지 렌더 중에 판단할 수 있다
  const [frame, setFrame] = useState<{ current: number; previous: number | null } | null>(null)
  // 최초 카운트업 중에는 값이 매 프레임 바뀌므로 자리별 연출을 걸지 않는다
  const [isLive, setIsLive] = useState(false)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (value === null) return
    let frameId: number | null = null
    let cancelled = false

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return
      const animate = !hasAnimated.current && !reduceMotion
      const duration = animate ? DURATION : 0
      hasAnimated.current = true
      const start = Date.now()

      // 갱신 값은 duration 0 으로 한 프레임 만에 최종값에 도달한다
      const step = () => {
        const progress = duration === 0 ? 1 : Math.min((Date.now() - start) / duration, 1)
        const next = Math.round(value * easeOut(progress))
        setFrame((prev) => (prev?.current === next ? prev : { current: next, previous: prev?.current ?? null }))
        if (progress < 1) {
          frameId = requestAnimationFrame(step)
          return
        }
        setIsLive(true)
      }
      frameId = requestAnimationFrame(step)
    })

    return () => {
      cancelled = true
      if (frameId !== null) cancelAnimationFrame(frameId)
    }
  }, [value])

  const text = frame === null ? '-' : frame.current.toLocaleString('ko-KR')
  const prevText = frame?.previous != null ? frame.previous.toLocaleString('ko-KR') : null

  // 자리수가 늘어나도 어긋나지 않도록 오른쪽 끝을 기준으로 이전 값과 비교한다
  const hasChanged = (indexFromRight: number, char: string) => {
    if (!isLive || prevText === null) return false
    return prevText[prevText.length - 1 - indexFromRight] !== char
  }

  return (
    <View style={[styles.row, frame === null && styles.hidden]}>
      {text.split('').map((char, index) => {
        const indexFromRight = text.length - 1 - index
        const changed = hasChanged(indexFromRight, char)
        return (
          <View key={indexFromRight} style={styles.slot}>
            {changed ? (
              // 바뀐 자리만 새로 붙여 그 자리에서만 연출이 재생된다
              <RisingDigit key={`${char}-${frame?.current}`} char={char} />
            ) : (
              <Text weight="medium" color={colors.main} style={styles.digit}>
                {char}
              </Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  hidden: { opacity: 0 },
  slot: { overflow: 'hidden', height: DIGIT_HEIGHT },
  digit: { fontSize: 36, lineHeight: DIGIT_HEIGHT, fontVariant: ['tabular-nums'] },
})
