import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../../services/supabase';

// ============================================
// NEBULA UI COMPONENTS
// ============================================

function NebulaCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-8 rounded-2xl bg-[rgba(20,20,35,0.75)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function NebulaInput({ 
  type = 'text', 
  placeholder, 
  value, 
  onChange, 
  icon, 
  required 
}: { 
  type?: string; 
  placeholder?: string; 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  icon?: React.ReactNode; 
  required?: boolean;
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)]">
          {icon}
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className={`w-full px-4 py-3.5 rounded-xl text-white text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/50 focus:border-transparent placeholder:text-[rgba(255,255,255,0.4)] transition-all ${icon ? 'pl-12' : ''}`}
      />
    </div>
  );
}

export default function RegisterPage() {
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    if (kullaniciAdi.length < 3) {
      setError('Kullanıcı adı en az 3 karakter olmalıdır.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            kullanici_adi: kullaniciAdi,
          },
        },
      });

      if (error) throw error;

      // Success - Navigate or show message
      navigate('/');
    } catch (err: any) {
      if (err.message.includes('already registered')) {
        setError('Bu e-posta adresi zaten kullanımda.');
      } else {
        setError(err.message || 'Kayıt sırasında hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `
          radial-gradient(ellipse at 20% 0%, rgba(108, 92, 231, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 100%, rgba(0, 206, 201, 0.1) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(253, 121, 168, 0.05) 0%, transparent 70%),
          linear-gradient(180deg, #0a0a12 0%, #0f0f1a 100%)
        `,
      }}
    >
      {/* Floating orbs */}
      <div className="fixed top-20 right-20 w-64 h-64 rounded-full bg-[#00CEC9]/10 blur-3xl animate-float" />
      <div className="fixed bottom-20 left-20 w-80 h-80 rounded-full bg-[#6C5CE7]/10 blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
      
      <NebulaCard className="w-full max-w-[420px] text-center animate-scale-in relative z-10">
        {/* Logo */}
        <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#00CEC9] to-[#6C5CE7] flex items-center justify-center shadow-lg shadow-[#6C5CE7]/25 animate-pulse-glow">
          <Sparkles size={28} className="text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2 font-['Outfit']">Hesap Oluştur</h1>
        <p className="text-[rgba(255,255,255,0.5)] text-sm mb-8">Nebula evrenine katılın.</p>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[rgba(253,121,168,0.15)] text-[#fd79a8] text-sm border border-[rgba(253,121,168,0.2)]">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <NebulaInput
            type="text"
            placeholder="Kullanıcı Adı"
            value={kullaniciAdi}
            onChange={(e) => setKullaniciAdi(e.target.value)}
            icon={<User size={18} />}
            required
          />

          <NebulaInput
            type="email"
            placeholder="E-posta Adresi"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={18} />}
            required
          />

          <NebulaInput
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock size={18} />}
            required
          />

          <NebulaInput
            type="password"
            placeholder="Şifre Tekrar"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            icon={<Lock size={18} />}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-3.5 mt-2
              bg-gradient-to-r from-[#6C5CE7] to-[#a29bfe] text-white
              font-semibold text-sm
              rounded-xl
              shadow-lg shadow-[#6C5CE7]/25
              hover:shadow-xl hover:shadow-[#6C5CE7]/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-300
              active:scale-[0.98]
              flex items-center justify-center gap-2
            "
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Kayıt Olunuyor...
              </>
            ) : (
              'Hesap Oluştur'
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/giris')}
            className="
              w-full py-3.5
              bg-[rgba(255,255,255,0.05)] text-white
              font-semibold text-sm
              rounded-xl
              border border-[rgba(255,255,255,0.1)]
              hover:bg-[rgba(255,255,255,0.1)]
              transition-all duration-200
              active:scale-[0.98]
            "
          >
            Zaten hesabım var
          </button>
        </form>
      </NebulaCard>
    </div>
  );
}
