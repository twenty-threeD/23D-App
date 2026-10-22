import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, radius as radii } from '@/constants/theme'

interface SkeletonProps {
  width?: DimensionValue
  height?: DimensionValue
  radius?: number
  style?: StyleProp<ViewStyle>
}

// 웹은 animate-pulse(투명도 깜빡임)지만, 앱은 밝은 띠가 왼쪽에서 오른쪽으로 쓸고 지나가는 웨이브로 바꿨다(사용자 요청).
// 불러온 뒤 레이아웃이 튀지 않도록 실제 요소와 같은 크기로 둔다
const WAVE_DURATION = 1200
// 'transparent' 는 iOS 에서 검은색 투명으로 보간돼 띠 가장자리가 회색으로 탁해져 흰색 투명을 쓴다
const WAVE_COLORS = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as const

export default function Skeleton({ width = '100%', height = 16, radius = radii.sm, style }: SkeletonProps) {
  // 렌더 중에 ref 를 읽지 않도록(React Compiler 규칙) 애니메이션 값은 처음 한 번만 만들어 state 로 들고 있는다
  const [progress] = useState(() => new Animated.Value(0))
  // 띠가 칸 너비만큼 움직여야 해서 그려진 너비를 잰다. '100%' 처럼 비율로 받은 너비는 그리기 전엔 모른다
  const [layoutWidth, setLayoutWidth] = useState(0)

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: WAVE_DURATION, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    )
    loop.start()
    return () => loop.stop()
  }, [progress])

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-layoutWidth, layoutWidth] })

  return (
    <View
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
      style={[styles.base, { width, height, borderRadius: radius }, style]}
    >
      {layoutWidth > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <LinearGradient colors={WAVE_COLORS} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.zinc200,
    overflow: 'hidden',
  },
})
