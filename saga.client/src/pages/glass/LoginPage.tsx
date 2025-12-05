import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, User, Mail } from 'lucide-react';
import { supabase } from '../../services/supabase';
import './LoginPage.css';

// ============================================
// SAGA AUTH PAGE - VOID THEME
// ============================================

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Register form state
  const [registerName, setRegisterName] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;
      navigate('/');
    } catch (err: any) {
      // Türkçe hata mesajları
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('E-posta veya şifre hatalı.');
      } else if (msg.includes('email not confirmed')) {
        setError('E-posta adresiniz henüz doğrulanmamış. Lütfen e-postanızı kontrol edin.');
      } else if (msg.includes('too many requests')) {
        setError('Çok fazla deneme yaptınız. Lütfen biraz bekleyin.');
      } else {
        setError(err.message || 'Giriş yapılırken hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) {
      setError('Kullanım şartlarını kabul etmelisiniz.');
      return;
    }

    if (registerPassword.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
      return;
    }

    if (registerPassword !== registerPasswordConfirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    if (registerUsername.length < 3) {
      setError('Kullanıcı adı en az 3 karakter olmalıdır.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const { error, data } = await supabase.auth.signUp({
        email: registerEmail,
        password: registerPassword,
        options: {
          data: {
            username: registerUsername,
            full_name: registerName || registerUsername,
          },
          emailRedirectTo: `${window.location.origin}/giris`
        }
      });

      if (error) throw error;

      // Supabase e-posta doğrulaması aktifse
      if (data?.user?.identities?.length === 0) {
        setError('Bu e-posta adresi zaten kayıtlı.');
        return;
      }

      setSuccess('Kayıt başarılı! E-posta adresinize doğrulama linki gönderdik. Lütfen e-postanızı kontrol edin.');
      setActiveTab('login');
      // Formu temizle
      setRegisterName('');
      setRegisterUsername('');
      setRegisterEmail('');
      setRegisterPassword('');
      setRegisterPasswordConfirm('');
      setAcceptTerms(false);
    } catch (err: any) {
      // Türkçe hata mesajları
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setError('Bu e-posta adresi zaten kullanımda.');
      } else if (msg.includes('password')) {
        setError('Şifre en az 8 karakter olmalı ve güçlü olmalıdır.');
      } else if (msg.includes('email')) {
        setError('Geçerli bir e-posta adresi girin.');
      } else {
        setError(err.message || 'Kayıt olurken hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Sosyal giriş yapılırken hata oluştu.');
    }
  };

  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setError('');
    setSuccess('');
  };

  return (
    <div className="auth-page">
      {/* Animated Background */}
      <div className="bg-canvas">
        <div className="bg-gradient"></div>
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        {[...Array(10)].map((_, i) => (
          <div key={i} className="particle"></div>
        ))}
      </div>

      {/* Main Auth Container */}
      <div className="auth-container">
        {/* Brand */}
        <div className="brand">
          <h1 className="brand-logo">SAGA</h1>
          <p className="brand-tagline">Her Hikayenin Bir Destanı Var</p>
        </div>

        {/* Auth Card */}
        <div className="auth-card">
          {/* Tab Navigation */}
          <div className={`auth-tabs ${activeTab === 'register' ? 'register-active' : ''}`}>
            <div className="tab-indicator"></div>
            <button 
              className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => switchTab('login')}
            >
              Giriş Yap
            </button>
            <button 
              className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => switchTab('register')}
            >
              Kayıt Ol
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {/* Form Panels */}
          <div className={`form-panels ${activeTab === 'register' ? 'show-register' : ''}`}>
            {/* Login Panel */}
            <form 
              className={`form-panel login-panel ${activeTab !== 'login' ? 'hidden' : ''}`}
              onSubmit={handleLogin}
            >
              <div className="input-group">
                <label className="input-label">E-posta veya Kullanıcı Adı</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="ornek@email.com" 
                    autoComplete="username"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                  <User className="input-icon" size={20} />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Şifre</label>
                <div className="input-wrapper">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    className="input-field" 
                    placeholder="••••••••" 
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
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

              <div className="form-options">
                <label className="checkbox-wrapper">
                  <input 
                    type="checkbox" 
                    className="checkbox-input"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="checkbox-label">Beni hatırla</span>
                </label>
                <button 
                  type="button" 
                  className="forgot-link"
                  onClick={() => navigate('/sifre-sifirla')}
                >
                  Şifremi unuttum
                </button>
              </div>

              <button type="submit" className={`submit-btn ${loading ? 'loading' : ''}`} disabled={loading}>
                <span>
                  {loading ? (
                    <>
                      <Loader2 size={18} className="loading-spinner" />
                      Giriş Yapılıyor...
                    </>
                  ) : (
                    'Giriş Yap'
                  )}
                </span>
              </button>

              <div className="divider">
                <span className="divider-line"></span>
                <span className="divider-text">veya</span>
                <span className="divider-line"></span>
              </div>

              <div className="social-login">
                <button type="button" className="social-btn" onClick={() => handleSocialLogin('google')}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                <button type="button" className="social-btn" onClick={() => handleSocialLogin('github')}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                  </svg>
                  GitHub
                </button>
              </div>
            </form>

            {/* Register Panel */}
            <form 
              className={`form-panel register-panel ${activeTab !== 'register' ? 'hidden' : ''}`}
              onSubmit={handleRegister}
            >
              <div className="input-group">
                <label className="input-label">Ad Soyad</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Adınız Soyadınız" 
                    autoComplete="name"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    required
                  />
                  <User className="input-icon" size={20} />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Kullanıcı Adı</label>
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Kullanıcı adınız" 
                    autoComplete="username"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    required
                  />
                  <span className="input-icon" style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>@</span>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">E-posta</label>
                <div className="input-wrapper">
                  <input 
                    type="email" 
                    className="input-field" 
                    placeholder="ornek@email.com" 
                    autoComplete="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                  />
                  <Mail className="input-icon" size={20} />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Şifre</label>
                <div className="input-wrapper">
                  <input 
                    type={showRegisterPassword ? 'text' : 'password'} 
                    className="input-field" 
                    placeholder="En az 8 karakter" 
                    autoComplete="new-password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button 
                    type="button" 
                    className="toggle-password"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  >
                    {showRegisterPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Şifre Tekrarı</label>
                <div className="input-wrapper">
                  <input 
                    type={showRegisterPassword ? 'text' : 'password'} 
                    className="input-field" 
                    placeholder="Şifrenizi tekrar girin" 
                    autoComplete="new-password"
                    value={registerPasswordConfirm}
                    onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button 
                    type="button" 
                    className="toggle-password"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  >
                    {showRegisterPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="form-options" style={{ marginBottom: '24px' }}>
                <label className="checkbox-wrapper">
                  <input 
                    type="checkbox" 
                    className="checkbox-input"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    required
                  />
                  <span className="checkbox-label">
                    <button 
                      type="button"
                      style={{ 
                        color: 'var(--gold)', 
                        background: 'none', 
                        border: 'none', 
                        padding: 0, 
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        font: 'inherit'
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        alert('Kullanım şartları sayfası yakında eklenecektir.');
                      }}
                    >
                      Kullanım şartlarını
                    </button> kabul ediyorum
                  </span>
                </label>
              </div>

              <button type="submit" className={`submit-btn ${loading ? 'loading' : ''}`} disabled={loading}>
                <span>
                  {loading ? (
                    <>
                      <Loader2 size={18} className="loading-spinner" />
                      Hesap Oluşturuluyor...
                    </>
                  ) : (
                    'Hesap Oluştur'
                  )}
                </span>
              </button>

              <div className="divider">
                <span className="divider-line"></span>
                <span className="divider-text">veya</span>
                <span className="divider-line"></span>
              </div>

              <div className="social-login">
                <button type="button" className="social-btn" onClick={() => handleSocialLogin('google')} style={{ flex: 1 }}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google ile Kaydol
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="auth-footer">
          <p>© 2024 Saga. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </div>
  );
}
