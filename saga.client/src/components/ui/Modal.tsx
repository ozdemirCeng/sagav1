import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  showClose?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
}: ModalProps) {
  // Close on Escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[8px]" />
      
      {/* Modal Content */}
      <div
        className={`
          relative w-full ${sizeClasses[size]}
          bg-[rgba(28,28,30,0.9)]
          backdrop-blur-[30px]
          saturate-[180%]
          border border-white/[0.12]
          shadow-[0_20px_60px_rgba(0,0,0,0.5)]
          rounded-[24px]
          p-8
          animate-scale-in
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        {showClose && (
          <button
            onClick={onClose}
            className="
              absolute top-4 right-4
              w-8 h-8 rounded-full
              bg-white/[0.05]
              flex items-center justify-center
              text-white/60 hover:text-white hover:bg-white/10
              transition-all duration-200
            "
          >
            <X size={18} />
          </button>
        )}

        {/* Title */}
        {title && (
          <h2 className="text-xl font-bold text-white mb-6 pr-8">{title}</h2>
        )}

        {/* Content */}
        {children}
      </div>
    </div>,
    document.body
  );
}

// Login Required Modal - Special Component
interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onRegister: () => void;
  message?: string;
}

export function LoginRequiredModal({
  isOpen,
  onClose,
  onLogin,
  onRegister,
  message = 'Bu özelliği kullanmak için giriş yapmalısınız.',
}: LoginRequiredModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        {/* Logo */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#0A84FF] to-[#BF5AF2] flex items-center justify-center">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Giriş Gerekli</h2>
        <p className="text-[#8E8E93] text-sm mb-8">{message}</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onLogin}
            className="
              w-full py-3 px-5
              bg-[#0A84FF] text-white
              font-semibold text-sm
              rounded-[14px]
              shadow-[0_4px_12px_rgba(10,132,255,0.3)]
              hover:bg-[#0071e3]
              transition-all duration-200
              active:scale-[0.98]
            "
          >
            Giriş Yap
          </button>
          <button
            onClick={onRegister}
            className="
              w-full py-3 px-5
              bg-white/10 text-white
              font-semibold text-sm
              rounded-[14px]
              border border-white/[0.08]
              hover:bg-white/[0.15]
              transition-all duration-200
              active:scale-[0.98]
            "
          >
            Hesap Oluştur
          </button>
        </div>

        <p className="mt-6 text-xs text-[#48484A]">
          Misafir olarak içerikleri gezmeye devam edebilirsiniz.
        </p>
      </div>
    </Modal>
  );
}
