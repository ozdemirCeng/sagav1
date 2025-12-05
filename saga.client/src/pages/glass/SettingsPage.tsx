import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { kullaniciApi, ayarlarApi, authApi } from '../../services/api';
import { supabase } from '../../services/supabase';
import './SettingsPage.css';

// ============================================
// ICONS
// ============================================
const CrownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const HelpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const LogOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// ============================================
// TYPES
// ============================================
type SettingsTab = 'main' | 'profil' | 'bildirimler' | 'gizlilik';

// ============================================
// MAIN COMPONENT
// ============================================
export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<SettingsTab>('main');

  // Preferences state
  const [darkMode, setDarkMode] = useState(true);
  
  // Modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Profile edit state
  const [profilForm, setProfilForm] = useState({
    goruntulemeAdi: '',
    biyografi: '',
    avatarUrl: '',
  });
  const [profilLoading, setProfilLoading] = useState(false);
  const [profilSaved, setProfilSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  
  // Bildirim ayarları state
  const [bildirimAyarlari, setBildirimAyarlari] = useState({
    yeniTakipci: true,
    yorumlar: true,
    begeniler: true,
    oneriler: false,
    emailBildirimleri: false,
  });
  const [bildirimLoading, setBildirimLoading] = useState(false);
  const [bildirimSaving, setBildirimSaving] = useState(false);

  // Gizlilik ayarları state
  const [gizlilikAyarlari, setGizlilikAyarlari] = useState({
    profilGizli: false,
    aktiviteGizli: false,
  });
  const [gizlilikLoading, setGizlilikLoading] = useState(false);
  const [gizlilikSaving, setGizlilikSaving] = useState(false);
  
  // Delete account state
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Load profil data
  useEffect(() => {
    if (activeTab === 'profil' && user) {
      loadProfilData();
    }
  }, [activeTab, user]);

  // Load bildirim ayarları
  useEffect(() => {
    if (activeTab === 'bildirimler' && user) {
      loadBildirimAyarlari();
    }
  }, [activeTab, user]);

  // Load gizlilik ayarları
  useEffect(() => {
    if (activeTab === 'gizlilik' && user) {
      loadGizlilikAyarlari();
    }
  }, [activeTab, user]);

  const loadProfilData = async () => {
    if (!user) return;
    try {
      const profil = await kullaniciApi.getProfil(user.kullaniciAdi);
      setProfilForm({
        goruntulemeAdi: profil.goruntulemeAdi || '',
        biyografi: profil.biyografi || '',
        avatarUrl: profil.avatarUrl || '',
      });
    } catch (err) {
      console.error('Profil yüklenemedi:', err);
    }
  };

  const loadBildirimAyarlari = async () => {
    setBildirimLoading(true);
    try {
      const ayarlar = await ayarlarApi.getAyarlar();
      setBildirimAyarlari({
        yeniTakipci: ayarlar.bildirimYeniTakipci,
        yorumlar: ayarlar.bildirimYorumlar,
        begeniler: ayarlar.bildirimBegeniler,
        oneriler: ayarlar.bildirimOneriler,
        emailBildirimleri: ayarlar.bildirimEmail,
      });
    } catch (err) {
      console.error('Bildirim ayarları yüklenemedi:', err);
    } finally {
      setBildirimLoading(false);
    }
  };

  const loadGizlilikAyarlari = async () => {
    setGizlilikLoading(true);
    try {
      const ayarlar = await ayarlarApi.getAyarlar();
      setGizlilikAyarlari({
        profilGizli: ayarlar.profilGizli || false,
        aktiviteGizli: ayarlar.aktiviteGizli || false,
      });
    } catch (err) {
      console.error('Gizlilik ayarları yüklenemedi:', err);
    } finally {
      setGizlilikLoading(false);
    }
  };

  // Avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Dosya boyutu 2MB\'dan küçük olmalıdır.');
      return;
    }

    setAvatarUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setProfilForm({ ...profilForm, avatarUrl: publicUrlData.publicUrl });
    } catch (err) {
      console.error('Avatar yükleme hatası:', err);
      alert('Avatar yüklenirken bir hata oluştu.');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Save profile
  const handleSaveProfile = async () => {
    setProfilLoading(true);
    setProfilSaved(false);
    try {
      await kullaniciApi.updateProfil({
        goruntulemeAdi: profilForm.goruntulemeAdi || undefined,
        biyografi: profilForm.biyografi || undefined,
        avatarUrl: profilForm.avatarUrl || undefined,
      });
      setProfilSaved(true);
      setTimeout(() => setProfilSaved(false), 3000);
    } catch (err) {
      console.error('Profil güncelleme hatası:', err);
      alert('Profil güncellenirken bir hata oluştu.');
    } finally {
      setProfilLoading(false);
    }
  };

  // Toggle bildirim ayarı
  const handleBildirimToggle = async (key: keyof typeof bildirimAyarlari) => {
    const newValue = !bildirimAyarlari[key];
    setBildirimAyarlari({ ...bildirimAyarlari, [key]: newValue });
    
    setBildirimSaving(true);
    try {
      const apiKeyMap: Record<string, string> = {
        yeniTakipci: 'bildirimYeniTakipci',
        yorumlar: 'bildirimYorumlar',
        begeniler: 'bildirimBegeniler',
        oneriler: 'bildirimOneriler',
        emailBildirimleri: 'bildirimEmail',
      };
      await ayarlarApi.updateBildirimler({ [apiKeyMap[key]]: newValue });
    } catch (err) {
      console.error('Bildirim ayarı güncellenemedi:', err);
      setBildirimAyarlari({ ...bildirimAyarlari, [key]: !newValue });
    } finally {
      setBildirimSaving(false);
    }
  };

  // Toggle gizlilik ayarı
  const handleGizlilikToggle = async (key: keyof typeof gizlilikAyarlari) => {
    const newValue = !gizlilikAyarlari[key];
    setGizlilikAyarlari({ ...gizlilikAyarlari, [key]: newValue });
    
    setGizlilikSaving(true);
    try {
      await ayarlarApi.updateGizlilik({ [key]: newValue });
    } catch (err) {
      console.error('Gizlilik ayarı güncellenemedi:', err);
      setGizlilikAyarlari({ ...gizlilikAyarlari, [key]: !newValue });
    } finally {
      setGizlilikSaving(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    await signOut();
    navigate('/giris');
  };

  // Delete account
  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await authApi.deleteAccount();
      await signOut();
      navigate('/');
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Hesap silinirken bir hata oluştu.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="settings-page">
        <div className="settings-empty">
          <UserIcon />
          <h2>Giriş Yapmalısınız</h2>
          <p>Ayarları görüntülemek için giriş yapın.</p>
          <button className="settings-login-btn" onClick={() => navigate('/giris')}>
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  const renderMainTab = () => (
    <>
      <div className="settings-page-header">
        <h1 className="settings-page-title">Hesap</h1>
      </div>

      <div className="settings-groups">
        {/* Group 1: Premium & Profile */}
        <div className="settings-group">
          <div className="settings-item" onClick={() => alert('Premium özelliği yakında!')}>
            <div className="settings-icon gold">
              <CrownIcon />
            </div>
            <div className="settings-item-content">
              <div className="settings-label">SAGA Premium</div>
              <div className="settings-desc">Reklamsız deneyim, özel özellikler</div>
            </div>
            <span className="settings-arrow">
              <ChevronRightIcon />
            </span>
          </div>

          <div className="settings-item" onClick={() => setActiveTab('profil')}>
            <div className="settings-icon">
              <UserIcon />
            </div>
            <div className="settings-item-content">
              <div className="settings-label">Profili Düzenle</div>
              <div className="settings-desc">Ad, bio, fotoğraf</div>
            </div>
            <span className="settings-arrow">
              <ChevronRightIcon />
            </span>
          </div>

          <div className="settings-item" onClick={() => setActiveTab('bildirimler')}>
            <div className="settings-icon blue">
              <BellIcon />
            </div>
            <div className="settings-item-content">
              <div className="settings-label">Bildirimler</div>
              <div className="settings-desc">Push bildirimleri, e-posta</div>
            </div>
            <span className="settings-arrow">
              <ChevronRightIcon />
            </span>
          </div>

          <div className="settings-item" onClick={() => setActiveTab('gizlilik')}>
            <div className="settings-icon">
              <LockIcon />
            </div>
            <div className="settings-item-content">
              <div className="settings-label">Gizlilik</div>
              <div className="settings-desc">Profil görünürlüğü, engellenenler</div>
            </div>
            <span className="settings-arrow">
              <ChevronRightIcon />
            </span>
          </div>
        </div>

        {/* Group 2: Preferences */}
        <div className="settings-group">
          <div className="settings-item" onClick={() => setDarkMode(!darkMode)}>
            <div className="settings-icon">
              <MoonIcon />
            </div>
            <div className="settings-item-content">
              <div className="settings-label">Karanlık Mod</div>
              <div className="settings-desc">Sistem ayarını kullan</div>
            </div>
            <div className={`settings-toggle ${darkMode ? 'active' : ''}`} />
          </div>

          <div className="settings-item" onClick={() => alert('Dil ayarları yakında!')}>
            <div className="settings-icon">
              <GlobeIcon />
            </div>
            <div className="settings-item-content">
              <div className="settings-label">Dil</div>
              <div className="settings-desc">Türkçe</div>
            </div>
            <span className="settings-arrow">
              <ChevronRightIcon />
            </span>
          </div>

          <div className="settings-item" onClick={() => alert('Veri indirme yakında!')}>
            <div className="settings-icon">
              <DownloadIcon />
            </div>
            <div className="settings-item-content">
              <div className="settings-label">Verilerimi İndir</div>
              <div className="settings-desc">Tüm izleme geçmişi ve listeler</div>
            </div>
            <span className="settings-arrow">
              <ChevronRightIcon />
            </span>
          </div>
        </div>

        {/* Group 3: Support & Logout */}
        <div className="settings-group">
          <div className="settings-item" onClick={() => alert('Yardım & Destek yakında!')}>
            <div className="settings-icon">
              <HelpIcon />
            </div>
            <div className="settings-item-content">
              <div className="settings-label">Yardım & Destek</div>
              <div className="settings-desc">SSS, iletişim</div>
            </div>
            <span className="settings-arrow">
              <ChevronRightIcon />
            </span>
          </div>

          <div className="settings-item logout" onClick={() => setShowLogoutModal(true)}>
            <div className="settings-icon red">
              <LogOutIcon />
            </div>
            <div className="settings-item-content">
              <div className="settings-label red">Çıkış Yap</div>
            </div>
          </div>
        </div>

        {/* Group 4: Danger Zone */}
        <div className="settings-group danger">
          <div className="settings-item" onClick={() => setShowDeleteModal(true)}>
            <div className="settings-icon red">
              <TrashIcon />
            </div>
            <div className="settings-item-content">
              <div className="settings-label red">Hesabı Sil</div>
              <div className="settings-desc">Bu işlem geri alınamaz</div>
            </div>
            <span className="settings-arrow">
              <ChevronRightIcon />
            </span>
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <p>SAGA v1.0.0</p>
        <p>© 2024 SAGA. Tüm hakları saklıdır.</p>
      </div>
    </>
  );

  const renderProfilTab = () => (
    <>
      <div className="settings-tab-header">
        <button className="settings-back-btn" onClick={() => setActiveTab('main')}>
          <ChevronLeftIcon />
        </button>
        <h1 className="settings-tab-title">Profili Düzenle</h1>
        <div className="settings-tab-spacer" />
      </div>

      <div className="settings-tab-content">
        {/* Avatar Section */}
        <div className="profile-avatar-section">
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar">
              {profilForm.avatarUrl ? (
                <img src={profilForm.avatarUrl} alt="Avatar" />
              ) : (
                <span className="avatar-letter">
                  {(user.ad || user.kullaniciAdi).charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <button 
              className="avatar-edit-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
            >
              <CameraIcon />
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            accept="image/jpeg,image/png,image/gif,image/webp"
            style={{ display: 'none' }}
          />
          <span 
            className="avatar-change-text"
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarUploading ? 'Yükleniyor...' : 'Fotoğrafı Değiştir'}
          </span>
        </div>

        {/* Form Fields */}
        <div className="settings-form">
          <div className="settings-field">
            <label>İsim</label>
            <input
              type="text"
              value={profilForm.goruntulemeAdi}
              onChange={(e) => setProfilForm({ ...profilForm, goruntulemeAdi: e.target.value })}
              placeholder="İsminiz"
            />
          </div>

          <div className="settings-field">
            <label>Kullanıcı Adı</label>
            <input
              type="text"
              value={`@${user.kullaniciAdi}`}
              disabled
              className="disabled"
            />
            <span className="field-hint">Kullanıcı adı değiştirilemez</span>
          </div>

          <div className="settings-field">
            <label>Bio</label>
            <textarea
              value={profilForm.biyografi}
              onChange={(e) => setProfilForm({ ...profilForm, biyografi: e.target.value })}
              placeholder="Kendinizden bahsedin..."
              rows={3}
            />
          </div>
        </div>

        {/* Save Button */}
        <button 
          className={`settings-save-btn ${profilSaved ? 'saved' : ''}`}
          onClick={handleSaveProfile}
          disabled={profilLoading}
        >
          {profilLoading ? 'Kaydediliyor...' : profilSaved ? 'Kaydedildi!' : 'Kaydet'}
        </button>
      </div>
    </>
  );

  const renderBildirimlerTab = () => (
    <>
      <div className="settings-tab-header">
        <button className="settings-back-btn" onClick={() => setActiveTab('main')}>
          <ChevronLeftIcon />
        </button>
        <h1 className="settings-tab-title">Bildirimler</h1>
        <div className="settings-tab-spacer" />
      </div>

      <div className="settings-tab-content">
        {bildirimLoading ? (
          <div className="settings-loading">
            <div className="loading-spinner" />
            <span>Yükleniyor...</span>
          </div>
        ) : (
          <div className="settings-groups">
            <div className="settings-group">
              <div className="settings-item" onClick={() => handleBildirimToggle('yeniTakipci')}>
                <div className="settings-item-content">
                  <div className="settings-label">Yeni takipçi</div>
                  <div className="settings-desc">Biri sizi takip ettiğinde bildirim alın</div>
                </div>
                <div className={`settings-toggle ${bildirimAyarlari.yeniTakipci ? 'active' : ''}`} />
              </div>

              <div className="settings-item" onClick={() => handleBildirimToggle('yorumlar')}>
                <div className="settings-item-content">
                  <div className="settings-label">Yorumlar</div>
                  <div className="settings-desc">Yorumlarınıza yanıt geldiğinde</div>
                </div>
                <div className={`settings-toggle ${bildirimAyarlari.yorumlar ? 'active' : ''}`} />
              </div>

              <div className="settings-item" onClick={() => handleBildirimToggle('begeniler')}>
                <div className="settings-item-content">
                  <div className="settings-label">Beğeniler</div>
                  <div className="settings-desc">İçeriğiniz beğenildiğinde</div>
                </div>
                <div className={`settings-toggle ${bildirimAyarlari.begeniler ? 'active' : ''}`} />
              </div>

              <div className="settings-item" onClick={() => handleBildirimToggle('oneriler')}>
                <div className="settings-item-content">
                  <div className="settings-label">Öneriler</div>
                  <div className="settings-desc">Size özel içerik önerileri</div>
                </div>
                <div className={`settings-toggle ${bildirimAyarlari.oneriler ? 'active' : ''}`} />
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-item" onClick={() => handleBildirimToggle('emailBildirimleri')}>
                <div className="settings-item-content">
                  <div className="settings-label">E-posta bildirimleri</div>
                  <div className="settings-desc">Önemli güncellemeleri e-posta ile alın</div>
                </div>
                <div className={`settings-toggle ${bildirimAyarlari.emailBildirimleri ? 'active' : ''}`} />
              </div>
            </div>
          </div>
        )}

        {bildirimSaving && (
          <div className="settings-saving-indicator">
            Kaydediliyor...
          </div>
        )}
      </div>
    </>
  );

  const renderGizlilikTab = () => (
    <>
      <div className="settings-tab-header">
        <button className="settings-back-btn" onClick={() => setActiveTab('main')}>
          <ChevronLeftIcon />
        </button>
        <h1 className="settings-tab-title">Gizlilik</h1>
        <div className="settings-tab-spacer" />
      </div>

      <div className="settings-tab-content">
        {gizlilikLoading ? (
          <div className="settings-loading">
            <div className="loading-spinner" />
            <span>Yükleniyor...</span>
          </div>
        ) : (
          <div className="settings-groups">
            <div className="settings-group">
              <div className="settings-item" onClick={() => handleGizlilikToggle('profilGizli')}>
                <div className="settings-icon">
                  <UserIcon />
                </div>
                <div className="settings-item-content">
                  <div className="settings-label">Gizli Profil</div>
                  <div className="settings-desc">Sadece takipçileriniz profilinizi görebilir</div>
                </div>
                <div className={`settings-toggle ${gizlilikAyarlari.profilGizli ? 'active' : ''}`} />
              </div>

              <div className="settings-item" onClick={() => handleGizlilikToggle('aktiviteGizli')}>
                <div className="settings-icon">
                  <ShieldIcon />
                </div>
                <div className="settings-item-content">
                  <div className="settings-label">Aktivite Gizliliği</div>
                  <div className="settings-desc">Aktiviteleriniz akışta görünmesin</div>
                </div>
                <div className={`settings-toggle ${gizlilikAyarlari.aktiviteGizli ? 'active' : ''}`} />
              </div>
            </div>
          </div>
        )}

        {gizlilikSaving && (
          <div className="settings-saving-indicator">
            Kaydediliyor...
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="settings-page">
      <main className="settings-content">
        {activeTab === 'main' && renderMainTab()}
        {activeTab === 'profil' && renderProfilTab()}
        {activeTab === 'bildirimler' && renderBildirimlerTab()}
        {activeTab === 'gizlilik' && renderGizlilikTab()}
      </main>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="modal-backdrop" onClick={() => setShowLogoutModal(false)}>
          <div className="modal-content small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon warning">
              <LogOutIcon />
            </div>
            <h3 className="modal-title centered">Çıkış Yap</h3>
            <p className="modal-text">Hesabınızdan çıkış yapmak istediğinize emin misiniz?</p>
            <div className="modal-actions">
              <button 
                className="modal-btn secondary" 
                onClick={() => setShowLogoutModal(false)}
              >
                İptal
              </button>
              <button 
                className="modal-btn primary"
                onClick={handleLogout}
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon danger">
              <TrashIcon />
            </div>
            <h3 className="modal-title centered">Hesabı Sil</h3>
            <p className="modal-text">
              Bu işlem geri alınamaz. Tüm verileriniz kalıcı olarak silinecektir.
            </p>
            {deleteError && (
              <div className="modal-error">{deleteError}</div>
            )}
            <div className="modal-actions">
              <button 
                className="modal-btn secondary" 
                onClick={() => { setShowDeleteModal(false); setDeleteError(''); }}
                disabled={deleteLoading}
              >
                İptal
              </button>
              <button 
                className="modal-btn danger"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Siliniyor...' : 'Hesabı Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
