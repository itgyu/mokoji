// 모꼬지 디자인 시스템
// 통일된 톤앤매너를 위한 컬러, 타이포그래피, 스페이싱 정의

export const colors = {
  // 브랜드 컬러
  primary: {
    50: '#FFF5ED',
    100: '#FFE8D5',
    200: '#FFCFAA',
    300: '#FFB074',
    400: '#FF9B50',  // 메인
    500: '#FF8A3D',
    600: '#F67422',
    700: '#CC5A18',
    800: '#A1471B',
    900: '#823C1A',
  },

  secondary: {
    50: '#F3F9ED',
    100: '#E5F2D9',
    200: '#CFE6B9',
    300: '#B4D590',
    400: '#A8D08D',  // 메인
    500: '#86BA64',
    600: '#6B9A4C',
    700: '#53773E',
    800: '#446034',
    900: '#3A502D',
  },

  accent: {
    50: '#FFF1F0',
    100: '#FFE0DE',
    200: '#FFC7C2',
    300: '#FFA099',
    400: '#FF6B6B',  // 메인
    500: '#FF5252',
    600: '#F03A3A',
    700: '#D92929',
    800: '#B32424',
    900: '#942424',
  },

  // 중성 컬러 (따뜻한 회색)
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAF9',
    100: '#F5F5F4',
    200: '#E7E5E4',
    300: '#D6D3D1',
    400: '#A8A29E',
    500: '#78716C',
    600: '#57534E',
    700: '#44403C',
    800: '#292524',
    900: '#1C1917',
    950: '#0C0A09',
  },

  // 시맨틱 컬러
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // 배경 컬러
  background: {
    primary: '#FFFBF7',      // 따뜻한 아이보리
    secondary: '#FFF9F5',    // 연한 아이보리
    tertiary: '#F8F8F7',     // 중립적 회색
  },
} as const

export const typography = {
  // 폰트 크기
  xs: '0.75rem',      // 12px
  sm: '0.875rem',     // 14px
  base: '1rem',       // 16px
  lg: '1.125rem',     // 18px
  xl: '1.25rem',      // 20px
  '2xl': '1.5rem',    // 24px
  '3xl': '1.875rem',  // 30px
  '4xl': '2.25rem',   // 36px

  // 폰트 굵기
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const

export const spacing = {
  // 기본 간격 (4px 단위)
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
} as const

export const borderRadius = {
  none: '0',
  sm: '0.375rem',    // 6px
  base: '0.5rem',    // 8px
  md: '0.75rem',     // 12px
  lg: '1rem',        // 16px
  xl: '1.25rem',     // 20px
  '2xl': '1.5rem',   // 24px
  '3xl': '2rem',     // 32px
  full: '9999px',
} as const

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  none: 'none',
} as const

// 컴포넌트 스타일 프리셋
export const components = {
  button: {
    primary: `bg-[${colors.primary[400]}] text-white font-semibold rounded-xl px-6 py-3 hover:bg-[${colors.primary[500]}] active:scale-98 transition-all shadow-sm`,
    secondary: `bg-[${colors.secondary[400]}] text-white font-semibold rounded-xl px-6 py-3 hover:bg-[${colors.secondary[500]}] active:scale-98 transition-all shadow-sm`,
    outline: `border-2 border-[${colors.primary[400]}] text-[${colors.primary[400]}] font-semibold rounded-xl px-6 py-3 hover:bg-[${colors.primary[50]}] active:scale-98 transition-all`,
    ghost: `text-[${colors.neutral[700]}] font-semibold rounded-xl px-6 py-3 hover:bg-[${colors.neutral[100]}] active:scale-98 transition-all`,
  },
  card: {
    default: `bg-white rounded-2xl p-6 shadow-sm border border-[${colors.neutral[200]}] hover:shadow-md transition-all`,
    elevated: `bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all`,
    flat: `bg-[${colors.neutral[50]}] rounded-2xl p-6 hover:bg-[${colors.neutral[100]}] transition-all`,
  },
  input: {
    default: `w-full px-4 py-3 rounded-xl border border-[${colors.neutral[300]}] focus:border-[${colors.primary[400]}] focus:ring-2 focus:ring-[${colors.primary[400]}]/20 outline-none transition-all`,
  },
  badge: {
    primary: `inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-[${colors.primary[50]}] text-[${colors.primary[600]}]`,
    secondary: `inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-[${colors.secondary[50]}] text-[${colors.secondary[600]}]`,
    neutral: `inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-[${colors.neutral[100]}] text-[${colors.neutral[700]}]`,
  },
} as const
