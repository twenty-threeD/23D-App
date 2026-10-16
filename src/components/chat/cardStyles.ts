import { StyleSheet } from 'react-native'
import { colors, radius } from '@/constants/theme'

// 계약·결제·거래 카드가 같은 골격(색 헤더 + 가운데 정렬 본문)과 폭을 쓴다.
// 웹 w-[min(16rem,68vw)] 과 같은 폭: 휴대폰 화면의 68% 를 넘지 않는 256
export function chatCardWidth(screenWidth: number) {
  return Math.min(256, Math.round(screenWidth * 0.68))
}

export const cardStyles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radius['2xl'],
    backgroundColor: colors.white,
    borderWidth: 1,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 18,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTexts: {
    alignItems: 'center',
    gap: 2,
  },
  body: {
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
  },
  small: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  caption: {
    fontSize: 11.5,
    lineHeight: 16,
  },
})
