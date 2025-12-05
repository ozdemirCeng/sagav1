import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import './LoginPage.css';

// ============================================
// SAGA FORGOT PASSWORD PAGE - VOID THEME
// ============================================

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/sifre-yenile`,
      });
      
      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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

              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: 600, 
                color: '#fff', 
                marginBottom: '12px' 
              }}>
                E-posta Gönderildi
              </h2>
              
              <p style={{ 
                color: 'rgba(255,255,255,0.5)', 
                fontSize: '14px', 
                marginBottom: '24px',
                lineHeight: 1.6
              }}>
                Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama linki gönderildi.
                Lütfen gelen kutunuzu kontrol edin.
              </p>

              <p style={{ 
                color: 'rgba(255,255,255,0.3)', 
                fontSize: '12px', 
                marginBottom: '24px' 
              }}>
                E-posta gelmediyse spam klasörünü kontrol edin.
              </p>

              <button
                onClick={() => navigate('/giris')}
                className="submit-btn"
              >
                <span>Giriş Sayfasına Dön</span>
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
      {/* Animated Background */}
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
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 600, 
              color: '#fff', 
              marginBottom: '8px' 
            }}>
              Şifremi Unuttum
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
              E-posta adresinizi girin, size şifre sıfırlama linki gönderelim.
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label">E-posta Adresi</label>
              <div className="input-wrapper">
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="ornek@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail className="input-icon" size={20} />
              </div>
            </div>

            <button 
              type="submit" 
              className={`submit-btn ${loading ? 'loading' : ''}`} 
              disabled={loading || !email}
              style={{ marginBottom: '16px' }}
            >
              <span>
                {loading ? (
                  <>
                    <Loader2 size={18} className="loading-spinner" />
                    Gönderiliyor...
                  </>
                ) : (
                  'Şifre Sıfırlama Linki Gönder'
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
