import { useEffect, useState } from 'react'
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius as radii } from '@/constants/theme'

interface SkeletonProps {
  width?: DimensionValue
  height?: DimensionValue
  radius?: number
  style?: StyleProp<ViewStyle>
}

// 웹의 animate-pulse 자리표시자. 불러온 뒤 레이아웃이 튀지 않도록 실제 요소와 같은 크기로 둔다
export default function Skeleton({ width = '100%', height = 16, radius = radii.sm, style }: SkeletonProps) {
  // 렌더 중에 ref 를 읽지 않도록(React Compiler 규칙) 애니메이션 값은 처음 한 번만 만들어 state 로 들고 있는다
  const [opacity] = useState(() => new Animated.Value(1))

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.zinc200, opacity }, style]} />
}
