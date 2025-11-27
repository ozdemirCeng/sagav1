import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  onClick?: () => void;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
  xl: 'p-8',
};

export function GlassCard({
  children,
  className = '',
  padding = 'md',
  hover = false,
  onClick,
}: GlassCardProps) {
  return (
    <div
      className={`
        bg-[rgba(28,28,30,0.65)]
        backdrop-blur-[25px]
        saturate-[180%]
        border border-white/[0.12]
        shadow-[0_8px_32px_rgba(0,0,0,0.4)]
        rounded-[20px]
        ${paddingClasses[padding]}
        ${hover ? 'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function GlassPanel({
  children,
  className = '',
  padding = 'md',
}: {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}) {
  return (
    <div
      className={`
        bg-[rgba(28,28,30,0.65)]
        backdrop-blur-[25px]
        saturate-[180%]
        border border-white/[0.12]
        shadow-[0_8px_32px_rgba(0,0,0,0.4)]
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
