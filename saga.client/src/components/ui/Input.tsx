import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({
  label,
  error,
  icon,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-white/80 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full
            bg-[rgba(118,118,128,0.24)]
            border-none
            px-4 py-3
            ${icon ? 'pl-12' : ''}
            rounded-[14px]
            text-white text-[15px]
            placeholder:text-[#8E8E93]
            transition-all duration-200
            focus:outline-none focus:bg-[rgba(118,118,128,0.4)]
            focus:shadow-[0_0_0_2px_rgba(10,132,255,0.5)]
            ${error ? 'shadow-[0_0_0_2px_rgba(255,69,58,0.5)]' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-[#FF453A]">{error}</p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  label,
  error,
  className = '',
  ...props
}: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-white/80 mb-2">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full
          bg-[rgba(118,118,128,0.24)]
          border-none
          px-4 py-3
          rounded-[14px]
          text-white text-[15px]
          placeholder:text-[#8E8E93]
          transition-all duration-200
          focus:outline-none focus:bg-[rgba(118,118,128,0.4)]
          focus:shadow-[0_0_0_2px_rgba(10,132,255,0.5)]
          resize-none
          min-h-[100px]
          ${error ? 'shadow-[0_0_0_2px_rgba(255,69,58,0.5)]' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs text-[#FF453A]">{error}</p>
      )}
    </div>
  );
}
