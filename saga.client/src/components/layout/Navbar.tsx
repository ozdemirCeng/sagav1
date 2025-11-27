import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, BookOpen, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: <Home size={18} />, label: 'Akış' },
  { path: '/kesfet', icon: <Search size={18} />, label: 'Keşfet' },
  { path: '/kutuphane', icon: <BookOpen size={18} />, label: 'Kitaplık' },
];

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    window.scrollTo(0, 0);
  };

  const handleProfileButtonClick = () => {
    if (isAuthenticated && user) {
      setShowDropdown(!showDropdown);
    } else {
      navigate('/giris');
    }
  };

  const handleGoToProfile = () => {
    if (user) {
      navigate(`/profil/${user.kullaniciAdi}`);
      setShowDropdown(false);
    }
  };

  const handleGoToSettings = () => {
    navigate('/ayarlar');
    setShowDropdown(false);
  };

  const handleLogout = async () => {
    await signOut();
    setShowDropdown(false);
    navigate('/');
  };

  return (
    <nav
      className="
        fixed top-5 left-1/2 -translate-x-1/2 z-[1000]
        w-auto min-w-[600px]
        h-16
        px-6 py-2
        bg-[rgba(28,28,30,0.65)]
        backdrop-blur-[25px]
        saturate-[180%]
        border border-white/[0.12]
        shadow-[0_8px_32px_rgba(0,0,0,0.4)]
        rounded-[20px]
        flex items-center justify-between
      "
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 cursor-pointer"
        onClick={() => handleNavClick('/')}
      >
        <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#0A84FF] to-[#BF5AF2] flex items-center justify-center">
          <BookOpen size={18} className="text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight text-white">SocialLib</span>
      </div>

      {/* Nav Links */}
      <div className="flex gap-1 bg-black/20 p-1 rounded-2xl">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNavClick(item.path)}
            className={`
              flex items-center gap-1.5
              px-4 py-2
              rounded-xl
              text-[13px] font-medium
              cursor-pointer
              transition-all duration-200
              ${isActive(item.path)
                ? 'bg-white/15 text-white font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.2)]'
                : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
              }
            `}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Profile with Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleProfileButtonClick}
          className="
            w-9 h-9 rounded-full
            bg-cover bg-center
            border-2 border-white/10
            cursor-pointer
            transition-all duration-200
            hover:border-white/30
          "
          style={{
            backgroundImage: user?.profilResmi
              ? `url(${user.profilResmi})`
              : 'linear-gradient(135deg, #3A3A3C, #2C2C2E)',
          }}
        >
          {!user?.profilResmi && (
            <User size={18} className="text-white/60 mx-auto mt-1.5" />
          )}
        </button>

        {/* Dropdown Menu */}
        {showDropdown && isAuthenticated && (
          <div className="
            absolute right-0 top-12
            w-52
            bg-[rgba(28,28,30,0.95)]
            backdrop-blur-xl
            border border-white/10
            rounded-xl
            shadow-[0_8px_32px_rgba(0,0,0,0.4)]
            overflow-hidden
            z-[1001]
          ">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-sm font-semibold text-white truncate">
                {user?.goruntulemeAdi || user?.kullaniciAdi}
              </p>
              <p className="text-xs text-white/50 truncate">@{user?.kullaniciAdi}</p>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <button
                onClick={handleGoToProfile}
                className="
                  w-full px-4 py-2.5
                  flex items-center gap-3
                  text-sm text-white/80
                  hover:bg-white/10
                  transition-colors
                "
              >
                <User size={16} />
                Profilim
              </button>
              <button
                onClick={handleGoToSettings}
                className="
                  w-full px-4 py-2.5
                  flex items-center gap-3
                  text-sm text-white/80
                  hover:bg-white/10
                  transition-colors
                "
              >
                <Settings size={16} />
                Ayarlar
              </button>
            </div>

            {/* Logout */}
            <div className="border-t border-white/10 py-1">
              <button
                onClick={handleLogout}
                className="
                  w-full px-4 py-2.5
                  flex items-center gap-3
                  text-sm text-red-400
                  hover:bg-white/10
                  transition-colors
                "
              >
                <LogOut size={16} />
                Çıkış Yap
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
