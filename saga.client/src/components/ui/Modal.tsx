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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        animation: 'modalFadeIn 0.2s ease-out forwards'
      }}
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
          animate-modal-scale-in
        `}
        style={{
          animation: 'modalScaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
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
      <div style={{ textAlign: 'center' }}>
        {/* SAGA Logo - Void Theme */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontFamily: "'Cinzel', serif",
            fontSize: '32px',
            fontWeight: 600,
            letterSpacing: '8px',
            color: '#fff',
            marginBottom: '8px'
          }}>
            SAGA
          </h1>
          <div style={{
            width: '60px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #d4a853, transparent)',
            margin: '0 auto'
          }} />
        </div>

        <h2 style={{
          fontSize: '20px',
          fontWeight: 500,
          color: '#fff',
          marginBottom: '12px',
          fontFamily: "'Inter', sans-serif"
        }}>
          Giriş Gerekli
        </h2>
        <p style={{ 
          fontSize: '14px',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '32px',
          lineHeight: 1.5
        }}>
          {message}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={onLogin}
            className="modal-login-btn"
          >
            <span>Giriş Yap</span>
          </button>
          <button
            onClick={onRegister}
            className="modal-register-btn"
          >
            Hesap Oluştur
          </button>
        </div>

        <p style={{ 
          marginTop: '24px',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.3)'
        }}>
          Misafir olarak içerikleri gezmeye devam edebilirsiniz.
        </p>
      </div>
    </Modal>
  );
}
