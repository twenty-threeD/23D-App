// 웹(23D-Web) src/app/globals.css 의 @theme 토큰과 화면에서 반복해 쓰던 Tailwind 색을 그대로 옮긴다.
// 새 색을 임의로 만들지 말고 여기 있는 이름을 먼저 찾는다. 시안에만 있는 색을 옮길 때만 추가하고, 이유를 주석으로 남긴다.

export const colors = {
  // --color-main: 브랜드 오렌지
  main: '#FE6A4C',
  // 웹의 hover:bg-orange-600. 앱에는 hover 가 없어 누르고 있을 때 색으로 쓴다
  mainPressed: '#EA580C',
  mainSoft: 'rgba(254, 106, 76, 0.1)',
  // --color-contract: 계약서 본문색
  contract: '#1A2747',
  // 본문 텍스트 3단계 + 힌트
  ink: '#363636',
  inkSub: '#666666',
  inkMuted: '#A1A1A1',
  inkHint: '#838383',
  // 모든 회색 테두리·구분선의 공통색
  line: '#D4D4D8',

  white: '#FFFFFF',
  black: '#000000',

  // Tailwind zinc
  zinc50: '#FAFAFA',
  zinc100: '#F4F4F5',
  zinc200: '#E4E4E7',
  zinc300: '#D4D4D8',
  zinc400: '#A1A1AA',
  zinc500: '#71717A',
  zinc600: '#52525B',
  zinc700: '#3F3F46',
  zinc800: '#27272A',
  zinc900: '#18181B',

  // 카드·섹션 바탕으로 쓰던 시안 회색
  surface: '#FAFAFA',
  surfaceAlt: '#FBFBFB',
  placeholder: '#AAAAAA',

  red500: '#EF4444',
  red400: '#F87171',
  red50: '#FEF2F2',
  red100: '#FEE2E2',
  red600: '#DC2626',
  danger: '#FB1C1C',

  emerald50: '#ECFDF5',
  emerald200: '#A7F3D0',
  emerald500: '#10B981',
  emerald600: '#059669',
  emerald700: '#047857',
  emerald800: '#065F46',
  emerald900: '#064E3B',

  yellow100: '#FEF9C3',
  yellow400: '#FACC15',
  yellow700: '#A16207',
  orange50: '#FFF7ED',
  orange200: '#FED7AA',
  orange300: '#FDBA74',

  // 계약 카드 전용 브라운 팔레트(시안). 전역 contract 색과는 별개다
  brown: '#452B24',
  brownLine: '#E4D3CC',
  brownSoftLine: '#EADCD6',
  brownSurface: '#FAF3F0',
  brownSurfaceAlt: '#F8F0ED',
  brownText: '#6E4A40',
  brownMuted: '#9A7A70',

  // 통화 화면 배경
  callBackground: '#0D0C11',
  callDock: '#17161C',

  backdrop: 'rgba(0, 0, 0, 0.4)',
} as const

export type ColorName = keyof typeof colors

// Tailwind 글자 크기·줄 높이. 웹과 같은 이름을 써서 화면을 옮길 때 숫자를 다시 맞추지 않게 한다
export const fontSizes = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 20, lineHeight: 28 },
  '2xl': { fontSize: 24, lineHeight: 32 },
  '3xl': { fontSize: 30, lineHeight: 36 },
  '4xl': { fontSize: 36, lineHeight: 40 },
} as const

export type FontSize = keyof typeof fontSizes

// 프로젝트 폰트는 Pretendard 하나로 통일한다(app.json 의 expo-font 플러그인이 굵기별 파일을 한 패밀리로 묶는다)
export const FONT_FAMILY = 'Pretendard'

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const

export type FontWeight = keyof typeof fontWeights

// Tailwind rounded-*
export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const

// 웹 layout.ts 의 PAGE_X(px-5) 에 해당하는 휴대폰 좌우 여백
export const PAGE_X = 20
export const PAGE_Y = 32
