import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { Search, Bell, ArrowLeft, X, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { kullaniciApi, bildirimApi } from '../../services/api';
import './VoidLayout.css';

// ============================================
// PAGE TITLES
// ============================================

const PAGE_TITLES: Record<string, string> = {
  '/': 'Akış',
  '/akis': 'Akış',
  '/kesfet': 'Keşfet',
  '/kutuphane': 'Kütüphanem',
  '/listelerim': 'Listelerim',
  '/bildirimler': 'Bildirimler',
  '/ayarlar': 'Ayarlar',
  '/begeniler': 'Beğeniler',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/profil/')) return 'Profil';
  if (pathname.startsWith('/liste/')) return 'Liste';
  if (pathname.startsWith('/icerik/')) return '';
  return '';
}

function shouldShowBack(pathname: string): boolean {
  const backPaths = ['/profil/', '/ayarlar', '/liste/', '/bildirimler', '/icerik/', '/begeniler'];
  return backPaths.some(path => pathname.includes(path));
}

// ============================================
// HEADER COMPONENT
// ============================================

interface SearchResult {
  id: string;
  kullaniciAdi: string;
  profilResmi?: string;
  ad?: string;
}

function VoidHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useAuth();
  const title = getPageTitle(location.pathname);
  const showBack = shouldShowBack(location.pathname);
  
  const [scrolled, setScrolled] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [okunmamisBildirimSayisi, setOkunmamisBildirimSayisi] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Okunmamış bildirim sayısını çek
  const fetchBildirimSayisi = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await bildirimApi.getOkunmamis();
      setOkunmamisBildirimSayisi(response.okunmamisSayisi || 0);
    } catch (error) {
      console.error('Bildirim sayısı alınamadı:', error);
    }
  }, [isAuthenticated]);

  // İlk yükleme ve periyodik güncelleme
  useEffect(() => {
    fetchBildirimSayisi();
    
    // Her 30 saniyede bir güncelle
    const interval = setInterval(fetchBildirimSayisi, 30000);
    return () => clearInterval(interval);
  }, [fetchBildirimSayisi]);

  // Sayfa değiştiğinde bildirim sayısını güncelle
  useEffect(() => {
    fetchBildirimSayisi();
  }, [location.pathname, fetchBildirimSayisi]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Profil menüsü dışına tıklanınca kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await kullaniciApi.ara(searchQuery.trim());
        setSearchResults(results.slice(0, 5));
      } catch (err) {
        console.error('Arama hatası:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSearchClose = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleResultClick = (kullaniciAdi: string) => {
    handleSearchClose();
    navigate(`/profil/${kullaniciAdi}`);
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await signOut();
    navigate('/giris');
  };

  const handleSettingsClick = () => {
    setShowProfileMenu(false);
    navigate('/ayarlar');
  };

  const handleProfileClick = () => {
    setShowProfileMenu(false);
    if (user?.kullaniciAdi) {
      navigate(`/profil/${user.kullaniciAdi}`);
    }
  };

  return (
    <header className={`void-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="void-header-content">
        {/* Sol: Geri veya Logo */}
        <div className="void-header-left">
          {showBack ? (
            <button className="void-header-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </button>
          ) : (
            <Link to="/" className="void-header-logo">SAGA</Link>
          )}
        </div>

        {/* Orta: Title veya Search Input */}
        <div className="void-header-center">
          {showSearch ? (
            <div className="void-search-container">
              <Search size={18} className="void-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Kullanıcı ara..."
                className="void-search-input"
              />
              <button className="void-search-close" onClick={handleSearchClose}>
                <X size={18} />
              </button>
              
              {/* Arama Sonuçları */}
              {(searchResults.length > 0 || searching) && (
                <div className="void-search-results">
                  {searching ? (
                    <div className="void-search-loading">Aranıyor...</div>
                  ) : (
                    searchResults.map((user) => (
                      <button
                        key={user.id}
                        className="void-search-result"
                        onClick={() => handleResultClick(user.kullaniciAdi)}
                      >
                        {user.profilResmi ? (
                          <img src={user.profilResmi} alt="" className="void-search-avatar" />
                        ) : (
                          <div className="void-search-avatar-placeholder">
                            <User size={16} />
                          </div>
                        )}
                        <div className="void-search-info">
                          <span className="void-search-username">@{user.kullaniciAdi}</span>
                          {user.ad && <span className="void-search-name">{user.ad}</span>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className="void-header-title">{title}</span>
          )}
        </div>

        {/* Sağ: Aksiyonlar */}
        <div className="void-header-right">
          {!showSearch && (
            <button className="void-header-btn" onClick={() => setShowSearch(true)}>
              <Search size={20} />
            </button>
          )}
          <button className="void-header-btn void-notification-btn" onClick={() => navigate('/bildirimler')}>
            <Bell size={20} />
            {okunmamisBildirimSayisi > 0 && (
              <span className="void-notification-badge">
                {okunmamisBildirimSayisi > 99 ? '99+' : okunmamisBildirimSayisi}
              </span>
            )}
          </button>
          
          {/* Profil Dropdown - Sadece giriş yapmış kullanıcılar için */}
          {isAuthenticated ? (
            <div className="void-profile-wrapper" ref={profileMenuRef}>
              <button 
                className="void-profile-btn"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                {user?.profilResmi ? (
                  <img src={user.profilResmi} alt="" className="void-profile-avatar" />
                ) : (
                  <div className="void-profile-avatar-placeholder">
                    <User size={18} />
                  </div>
                )}
              </button>
              
              {showProfileMenu && (
                <div className="void-profile-menu">
                  <button className="void-profile-menu-item" onClick={handleProfileClick}>
                    <User size={18} />
                    <span>Profilim</span>
                  </button>
                  <button className="void-profile-menu-item" onClick={handleSettingsClick}>
                    <Settings size={18} />
                    <span>Ayarlar</span>
                  </button>
                  <div className="void-profile-menu-divider" />
                  <button className="void-profile-menu-item logout" onClick={handleLogout}>
                    <LogOut size={18} />
                    <span>Çıkış Yap</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button 
              className="void-header-btn void-login-btn"
              onClick={() => navigate('/giris')}
            >
              <User size={20} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ============================================
// BOTTOM NAV COMPONENT
// ============================================

// SVG Icons (FloatingNav tarzında)
const HomeIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
  </svg>
);

const ExploreIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
  </svg>
);

const LibraryIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
  </svg>
);

const ProfileIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
  </svg>
);

function VoidBottomNav() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const getActiveState = () => {
    const path = location.pathname;
    if (path === '/' || path === '/akis') return 'feed';
    if (path.startsWith('/kesfet')) return 'explore';
    if (path.startsWith('/kutuphane') || path.startsWith('/listelerim')) return 'library';
    if (path.startsWith('/profil')) return 'profile';
    return 'feed';
  };

  const active = getActiveState();
  const profileLink = isAuthenticated && user?.kullaniciAdi 
    ? `/profil/${user.kullaniciAdi}` 
    : '/giris';

  return (
    <nav className="void-bottom-nav">
      <Link to="/" className="void-nav-logo">SAGA</Link>
      
      <Link to="/" className={`void-nav-item ${active === 'feed' ? 'active' : ''}`}>
        <HomeIcon />
      </Link>
      
      <Link to="/kesfet" className={`void-nav-item ${active === 'explore' ? 'active' : ''}`}>
        <ExploreIcon />
      </Link>
      
      <Link to="/kutuphane" className={`void-nav-item ${active === 'library' ? 'active' : ''}`}>
        <LibraryIcon />
      </Link>
      
      <Link to={profileLink} className={`void-nav-item ${active === 'profile' ? 'active' : ''}`}>
        <ProfileIcon />
      </Link>
    </nav>
  );
}

// ============================================
// MAIN LAYOUT COMPONENT
// ============================================

export function VoidLayout() {
  return (
    <div className="void-layout">
      <VoidHeader />
      <main className="void-layout-content">
        <Outlet />
      </main>
      <VoidBottomNav />
    </div>
  );
}

export default VoidLayout;
