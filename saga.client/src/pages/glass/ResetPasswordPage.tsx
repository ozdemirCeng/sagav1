import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import './LoginPage.css';

// ============================================
// SAGA RESET PASSWORD PAGE - VOID THEME
// ============================================

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase recovery flow'dan gelen session'ı kontrol et
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // URL hash'ten recovery token kontrolü
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      
      if (type === 'recovery' || session) {
        setHasValidSession(true);
      } else {
        setHasValidSession(false);
      }
    };
    
    checkSession();

    // Auth state değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasValidSession(true);
      } else if (session) {
        setHasValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      setSuccess(true);
      
      // Kullanıcıyı çıkış yaptır
      await supabase.auth.signOut();
    } catch (err: any) {
      setError(err.message || 'Şifre sıfırlama başarısız. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  // Yükleniyor durumu
  if (hasValidSession === null) {
    return (
      <div className="auth-page">
        <div className="bg-canvas">
          <div className="bg-gradient"></div>
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
        </div>
        <div className="auth-container">
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <Loader2 size={32} className="loading-spinner" style={{ margin: '0 auto 16px' }} />
            Doğrulanıyor...
          </div>
        </div>
      </div>
    );
  }

  // Token yoksa hata göster
  if (!hasValidSession && !success) {
    return (
      <div className="auth-page">
        <div className="bg-canvas">
          <div className="bg-gradient"></div>
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="particle"></div>
          ))}
        </div>

        <div className="auth-container">
          <div className="brand">
            <h1 className="brand-logo">SAGA</h1>
            <p className="brand-tagline">Her Hikayenin Bir Destanı Var</p>
          </div>

          <div className="auth-card">
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                margin: '0 auto 24px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle size={32} color="#ef4444" />
              </div>

              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
                Geçersiz Link
              </h2>
              
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                Şifre sıfırlama linki geçersiz veya süresi dolmuş.
                Lütfen yeni bir şifre sıfırlama talebi oluşturun.
              </p>

              <Link
                to="/sifre-sifirla"
                className="submit-btn"
                style={{ display: 'block', textDecoration: 'none', marginBottom: '16px' }}
              >
                <span>Yeni Şifre Sıfırlama Talebi</span>
              </Link>

              <Link
                to="/giris"
                className="forgot-link"
                style={{ display: 'block' }}
              >
                Giriş Sayfasına Dön
              </Link>
            </div>
          </div>

          <div className="auth-footer">
            <p>© 2024 Saga. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="bg-canvas">
          <div className="bg-gradient"></div>
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="particle"></div>
          ))}
        </div>

        <div className="auth-container">
          <div className="brand">
            <h1 className="brand-logo">SAGA</h1>
            <p className="brand-tagline">Her Hikayenin Bir Destanı Var</p>
          </div>

          <div className="auth-card">
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                margin: '0 auto 24px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle size={32} color="#22c55e" />
              </div>

              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
                Şifre Güncellendi
              </h2>
              
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                Şifreniz başarıyla değiştirildi. Artık yeni şifrenizle giriş yapabilirsiniz.
              </p>

              <button
                onClick={() => navigate('/giris')}
                className="submit-btn"
              >
                <span>Giriş Yap</span>
              </button>
            </div>
          </div>

          <div className="auth-footer">
            <p>© 2024 Saga. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="bg-canvas">
        <div className="bg-gradient"></div>
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        {[...Array(10)].map((_, i) => (
          <div key={i} className="particle"></div>
        ))}
      </div>

      <div className="auth-container">
        <div className="brand">
          <h1 className="brand-logo">SAGA</h1>
          <p className="brand-tagline">Her Hikayenin Bir Destanı Var</p>
        </div>

        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Yeni Şifre Belirle
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
              Hesabınız için yeni bir şifre belirleyin.
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label">Yeni Şifre</label>
              <div className="input-wrapper">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="input-field" 
                  placeholder="En az 8 karakter" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button 
                  type="button" 
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Şifre Tekrar</label>
              <div className="input-wrapper">
                <input 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  className="input-field" 
                  placeholder="Şifrenizi tekrar girin" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button 
                  type="button" 
                  className="toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className={`submit-btn ${loading ? 'loading' : ''}`} 
              disabled={loading || !password || !confirmPassword}
              style={{ marginBottom: '16px' }}
            >
              <span>
                {loading ? (
                  <>
                    <Loader2 size={18} className="loading-spinner" />
                    Şifre Güncelleniyor...
                  </>
                ) : (
                  'Şifreyi Güncelle'
                )}
              </span>
            </button>

            <Link
              to="/giris"
              className="social-btn"
              style={{ 
                width: '100%', 
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <ArrowLeft size={16} />
              Giriş Sayfasına Dön
            </Link>
          </form>
        </div>

        <div className="auth-footer">
          <p>© 2024 Saga. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </div>
  );
}
