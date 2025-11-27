import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: `
    bg-[#0A84FF] text-white
    shadow-[0_4px_12px_rgba(10,132,255,0.3)]
    hover:bg-[#0071e3]
  `,
  secondary: `
    bg-white/10 text-white
    border border-white/[0.08]
    hover:bg-white/[0.15]
  `,
  danger: `
    bg-[#FF453A] text-white
    shadow-[0_4px_12px_rgba(255,69,58,0.3)]
    hover:bg-[#e53e35]
  `,
  success: `
    bg-[#30D158] text-white
    shadow-[0_4px_12px_rgba(48,209,88,0.3)]
    hover:bg-[#2bc04f]
  `,
  ghost: `
    bg-transparent text-white/70
    hover:bg-white/[0.05] hover:text-white
  `,
  icon: `
    bg-white/[0.05] text-white
    hover:bg-white/10
    rounded-full !p-0
  `,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const isIconOnly = variant === 'icon';

  return (
    <button
      className={`
        inline-flex items-center justify-center
        font-semibold
        border-none
        cursor-pointer
        transition-all duration-200
        rounded-[14px]
        active:scale-[0.96]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variantClasses[variant]}
        ${isIconOnly ? iconSizeClasses[size] : sizeClasses[size]}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <>
          {icon}
          {children && <span>{children}</span>}
        </>
      ) : (
        children
      )}
    </button>
  );
}
