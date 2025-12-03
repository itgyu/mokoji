'use client';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'black';
}

export function Logo({ size = 'md', color = 'primary' }: LogoProps) {
  const sizeClass = {
    sm: 'text-sm',   // 14px - 하단 네비게이션, 푸터
    md: 'text-lg',   // 18px - 헤더
    lg: 'text-lg',   // 18px - 스플래시, 로그인 (제목 크기)
  };

  const colorClass = {
    primary: 'text-[#5f0080]',
    white: 'text-white',
    black: 'text-gray-900',
  };

  return (
    <span className={`font-semibold tracking-widest ${sizeClass[size]} ${colorClass[color]}`}>
      MOKKOJI
    </span>
  );
}

export default Logo;
