import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native'
import { colors, FONT_FAMILY, fontSizes, fontWeights, type FontSize, type FontWeight } from '@/constants/theme'

export interface TextProps extends RNTextProps {
  size?: FontSize
  weight?: FontWeight
  color?: string
  align?: 'left' | 'center' | 'right'
}

// 모든 글자는 이 컴포넌트로 그린다. RN 기본 Text 는 시스템 폰트로 떨어져서 Pretendard 통일이 깨진다
export default function Text({ size = 'base', weight = 'regular', color = colors.black, align, style, ...props }: TextProps) {
  return (
    <RNText
      {...props}
      style={[
        styles.base,
        fontSizes[size],
        { fontWeight: fontWeights[weight], color },
        align && { textAlign: align },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  base: {
    fontFamily: FONT_FAMILY,
    // 안드로이드는 글자 위아래에 폰트 여백을 더해 웹보다 줄이 뜬다. 꺼야 시안의 간격과 맞는다
    includeFontPadding: false,
  },
})
