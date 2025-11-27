import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  TrendingUp, 
  Star, 
  Users, 
  ChevronRight,
  Film,
  BookOpen,
  Sparkles,
  Loader2,
  X,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { icerikApi, externalApi, kullaniciApi } from '../../services/api';
import type { IcerikListItem, TmdbFilm, OnerilenKullanici, Kullanici } from '../../services/api';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function RightWidgets() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IcerikListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // Trending data
  const [trendingItems, setTrendingItems] = useState<(IcerikListItem | TmdbFilm)[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  
  // User stats
  const [userStats, setUserStats] = useState({ film: 0, kitap: 0, takipci: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Suggested users - gerçek API'den (akıllı öneri sistemi)
  const [suggestedUsers, setSuggestedUsers] = useState<OnerilenKullanici[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Arama fonksiyonu
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    
    setSearchLoading(true);
    setShowResults(true);
    
    try {
      const result = await icerikApi.ara(query, { limit: 5 });
      setSearchResults(result.data);
    } catch (err) {
      console.error('Arama hatası:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    performSearch(debouncedSearch);
  }, [debouncedSearch, performSearch]);

  // Trending yükle
  useEffect(() => {
    const loadTrending = async () => {
      setTrendingLoading(true);
      try {
        // Önce local popüler içerikleri dene
        const populer = await icerikApi.getPopuler({ limit: 5 });
        if (populer.length > 0) {
          setTrendingItems(populer);
        } else {
          // Fallback: TMDB trending
          const tmdbTrending = await externalApi.getTmdbTrending('all', 'week', 1);
          setTrendingItems(tmdbTrending.slice(0, 5));
        }
      } catch (err) {
        console.error('Trending yüklenirken hata:', err);
        // Hata durumunda TMDB'yi dene
        try {
          const tmdbTrending = await externalApi.getTmdbTrending('all', 'week', 1);
          setTrendingItems(tmdbTrending.slice(0, 5));
        } catch {
          console.error('TMDB trending de yüklenemedi');
        }
      } finally {
        setTrendingLoading(false);
      }
    };
    
    loadTrending();
  }, []);

  // User stats yükle
  useEffect(() => {
    const loadUserStats = async () => {
      if (!isAuthenticated || !user) return;
      
      setStatsLoading(true);
      try {
        // Profil bilgisinden istatistikleri al
        const profil = await kullaniciApi.getProfil(user.kullaniciAdi);
        setUserStats({
          film: (profil as unknown as { toplamPuanlama?: number })?.toplamPuanlama || 0,
          kitap: (profil as unknown as { toplamYorum?: number })?.toplamYorum || 0,
          takipci: (profil as unknown as { takipEdenSayisi?: number })?.takipEdenSayisi || 0,
        });
      } catch (err) {
        console.error('User stats yüklenirken hata:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    
    loadUserStats();
  }, [isAuthenticated, user]);

  // Önerilen kullanıcıları yükle (akıllı öneri sistemi)
  useEffect(() => {
    const loadSuggestedUsers = async () => {
      setSuggestedLoading(true);
      try {
        // Akıllı öneri sistemi - benzer içerik türleriyle ilgilenenler
        const users = await kullaniciApi.getOnerilenler(5);
        setSuggestedUsers(users);
      } catch (err) {
        console.error('Önerilen kullanıcılar yüklenirken hata:', err);
        // Fallback: popüler kullanıcıları dene
        try {
          const users = await kullaniciApi.getPopuler(5);
          // Popüler kullanıcıları OnerilenKullanici formatına çevir
          const formattedUsers: OnerilenKullanici[] = users.map((u: Kullanici) => ({
            id: u.id,
            kullaniciAdi: u.kullaniciAdi,
            goruntulemeAdi: u.goruntulemeAdi,
            avatarUrl: u.avatarUrl,
            takipEdenSayisi: u.takipEdenSayisi,
            toplamPuanlama: u.toplamPuanlama,
            ortakIcerikSayisi: 0,
            oneriNedeni: 'Popüler kullanıcı'
          }));
          setSuggestedUsers(formattedUsers);
        } catch {
          console.error('Popüler kullanıcılar da yüklenemedi');
        }
      } finally {
        setSuggestedLoading(false);
      }
    };
    
    loadSuggestedUsers();
  }, [isAuthenticated]);

  // Takip et/bırak
  const handleFollow = async (userId: string) => {
    if (!isAuthenticated) {
      navigate('/giris');
      return;
    }
    
    try {
      await kullaniciApi.takipEt(userId);
      // Toggle following state
      setFollowingIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(userId)) {
          newSet.delete(userId);
        } else {
          newSet.add(userId);
        }
        return newSet;
      });
    } catch (err) {
      console.error('Takip hatası:', err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowResults(false);
      navigate(`/kesfet?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleResultClick = (item: IcerikListItem) => {
    setShowResults(false);
    setSearchQuery('');
    navigate(`/icerik/${item.id}`);
  };

  // Item'ın IcerikListItem mi TmdbFilm mi olduğunu kontrol et
  const isTmdbFilm = (item: IcerikListItem | TmdbFilm): item is TmdbFilm => {
    return 'tmdbId' in item;
  };

  return (
    <div className="p-5 space-y-6">
      {/* ===== SEARCH BAR ===== */}
      <div className="relative">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search 
              size={18} 
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)]" 
            />
            <input
              type="text"
              placeholder="Film, dizi veya kitap ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setShowResults(true)}
              className="
                w-full pl-11 pr-10 py-3
                rounded-xl
                bg-[rgba(255,255,255,0.05)]
                border border-[rgba(255,255,255,0.08)]
                text-white text-sm
                placeholder-[rgba(255,255,255,0.35)]
                focus:outline-none focus:border-[#6C5CE7]
                focus:ring-2 focus:ring-[#6C5CE7]/20
                transition-all
              "
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setShowResults(false); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)] hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </form>

        {/* Arama Sonuçları Dropdown */}
        {showResults && (
          <div className="
            absolute top-full left-0 right-0 mt-2
            bg-[rgba(20,20,35,0.98)]
            backdrop-blur-xl
            border border-[rgba(255,255,255,0.1)]
            rounded-xl
            shadow-xl
            overflow-hidden
            z-50
          ">
            {searchLoading ? (
              <div className="p-4 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-[#6C5CE7]" />
              </div>
            ) : searchResults.length > 0 ? (
              <>
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleResultClick(item)}
                    className="
                      w-full p-3
                      flex items-center gap-3
                      hover:bg-[rgba(255,255,255,0.05)]
                      transition-colors
                      text-left
                    "
                  >
                    {item.posterUrl ? (
                      <img 
                        src={item.posterUrl} 
                        alt={item.baslik}
                        className="w-10 h-14 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded bg-[rgba(255,255,255,0.1)] flex items-center justify-center">
                        {item.tur === 'kitap' ? <BookOpen size={16} /> : <Film size={16} />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.baslik}</p>
                      <p className="text-xs text-[rgba(255,255,255,0.5)] capitalize">{item.tur}</p>
                    </div>
                    {item.ortalamaPuan > 0 && (
                      <div className="flex items-center gap-1 text-[#FF9F0A]">
                        <Star size={12} className="fill-current" />
                        <span className="text-xs font-semibold">{item.ortalamaPuan.toFixed(1)}</span>
                      </div>
                    )}
                  </button>
                ))}
                <button
                  onClick={handleSearch}
                  className="
                    w-full px-4 py-3
                    border-t border-[rgba(255,255,255,0.06)]
                    text-sm text-[#6C5CE7]
                    hover:bg-[rgba(108,92,231,0.1)]
                    transition-colors
                  "
                >
                  Tüm sonuçları göster
                </button>
              </>
            ) : searchQuery && !searchLoading ? (
              <div className="p-4 text-center text-[rgba(255,255,255,0.5)] text-sm">
                Sonuç bulunamadı
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ===== USER PROFILE CARD (If logged in) ===== */}
      {isAuthenticated && user && (
        <div 
          className="
            p-4 rounded-2xl
            bg-[rgba(20,20,35,0.6)]
            border border-[rgba(255,255,255,0.06)]
            cursor-pointer
            hover:border-[rgba(255,255,255,0.12)]
            transition-all
          "
          onClick={() => navigate(`/profil/${user.kullaniciAdi}`)}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="
              w-12 h-12 rounded-full
              bg-gradient-to-br from-[#6C5CE7] to-[#fd79a8]
              flex items-center justify-center
              overflow-hidden
            ">
              {user.profilResmi ? (
                <img 
                  src={user.profilResmi} 
                  alt={user.kullaniciAdi}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-lg">
                  {user.kullaniciAdi?.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">
                {user.goruntulemeAdi || user.kullaniciAdi}
              </p>
              <p className="text-xs text-[rgba(255,255,255,0.5)]">
                @{user.kullaniciAdi}
              </p>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-[rgba(255,255,255,0.03)]">
              <p className="text-lg font-bold text-white">
                {statsLoading ? '-' : userStats.film}
              </p>
              <p className="text-[10px] text-[rgba(255,255,255,0.4)]">Puanlama</p>
            </div>
            <div className="p-2 rounded-lg bg-[rgba(255,255,255,0.03)]">
              <p className="text-lg font-bold text-white">
                {statsLoading ? '-' : userStats.kitap}
              </p>
              <p className="text-[10px] text-[rgba(255,255,255,0.4)]">Yorum</p>
            </div>
            <div className="p-2 rounded-lg bg-[rgba(255,255,255,0.03)]">
              <p className="text-lg font-bold text-white">
                {statsLoading ? '-' : userStats.takipci}
              </p>
              <p className="text-[10px] text-[rgba(255,255,255,0.4)]">Takipçi</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== TRENDING NOW ===== */}
      <div className="
        rounded-2xl
        bg-[rgba(20,20,35,0.6)]
        border border-[rgba(255,255,255,0.06)]
        overflow-hidden
      ">
        <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
          <TrendingUp size={16} className="text-[#00CEC9]" />
          <h3 className="font-semibold text-white text-sm">Trend Olanlar</h3>
        </div>
        <div className="p-2">
          {trendingLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[#6C5CE7]" />
            </div>
          ) : trendingItems.length > 0 ? (
            trendingItems.map((item, index) => {
              const isTmdb = isTmdbFilm(item);
              const title = isTmdb ? (item.baslik || item.title || 'Bilinmiyor') : item.baslik;
              const type = isTmdb ? (item.mediaType || 'film') : item.tur;
              const rating = isTmdb ? (item.puan || item.voteAverage || 0) : item.ortalamaPuan;
              const itemId = isTmdb ? item.id : item.id;
              
              return (
                <button
                  key={`${isTmdb ? 'tmdb' : 'local'}-${itemId}`}
                  onClick={() => {
                    if (isTmdb) {
                      // TMDB item - keşfet'e yönlendir
                      navigate(`/kesfet?q=${encodeURIComponent(title)}`);
                    } else {
                      navigate(`/icerik/${itemId}`);
                    }
                  }}
                  className="
                    w-full p-3 rounded-xl
                    flex items-center gap-3
                    hover:bg-[rgba(255,255,255,0.05)]
                    transition-colors
                    text-left
                  "
                >
                  <span className="
                    w-6 h-6 rounded-full
                    bg-gradient-to-br from-[#6C5CE7] to-[#00CEC9]
                    flex items-center justify-center
                    text-white text-xs font-bold
                  ">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[rgba(255,255,255,0.5)]">
                      {type === 'kitap' ? <BookOpen size={10} /> : <Film size={10} />}
                      <span className="capitalize">{type}</span>
                    </div>
                  </div>
                  {rating > 0 && (
                    <div className="flex items-center gap-1 text-[#FF9F0A]">
                      <Star size={12} className="fill-current" />
                      <span className="text-xs font-semibold">{rating.toFixed(1)}</span>
                    </div>
                  )}
                </button>
              );
            })
          ) : (
            <div className="py-6 text-center text-[rgba(255,255,255,0.4)] text-sm">
              Henüz trend içerik yok
            </div>
          )}
        </div>
        <button 
          onClick={() => navigate('/kesfet?tab=trending')}
          className="
            w-full px-4 py-3
            border-t border-[rgba(255,255,255,0.06)]
            flex items-center justify-center gap-1
            text-sm text-[#6C5CE7]
            hover:bg-[rgba(108,92,231,0.1)]
            transition-colors
          "
        >
          Tümünü Gör
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ===== SUGGESTED USERS ===== */}
      {/* ===== SUGGESTED USERS (Akıllı Öneri Sistemi) ===== */}
      {isAuthenticated && (
        <div className="
          rounded-2xl
          bg-[rgba(20,20,35,0.6)]
          border border-[rgba(255,255,255,0.06)]
          overflow-hidden
        ">
          <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
            <Users size={16} className="text-[#fd79a8]" />
            <h3 className="font-semibold text-white text-sm">Senin İçin Öneriler</h3>
          </div>
          <div className="p-2">
            {suggestedLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-[#6C5CE7]" />
              </div>
            ) : suggestedUsers.length === 0 ? (
              <p className="text-center text-[rgba(255,255,255,0.4)] text-sm py-4">
                Öneri bulunamadı
              </p>
            ) : (
              suggestedUsers.map((u) => (
                <div
                  key={u.id}
                  className="
                    w-full p-3 rounded-xl
                    flex items-center gap-3
                    hover:bg-[rgba(255,255,255,0.05)]
                    transition-colors
                  "
                >
                  <div 
                    onClick={() => navigate(`/profil/${u.kullaniciAdi}`)}
                    className="
                      w-10 h-10 rounded-full
                      bg-gradient-to-br from-[#fd79a8] to-[#6C5CE7]
                      flex items-center justify-center
                      text-white font-semibold text-sm
                      cursor-pointer
                      overflow-hidden
                      flex-shrink-0
                    "
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.kullaniciAdi} className="w-full h-full object-cover" />
                    ) : (
                      u.kullaniciAdi.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/profil/${u.kullaniciAdi}`)}
                  >
                    <p className="text-sm font-medium text-white truncate">
                      {u.goruntulemeAdi || u.kullaniciAdi}
                    </p>
                    <p className="text-[11px] text-[rgba(255,255,255,0.4)]">
                      @{u.kullaniciAdi} · {u.takipEdenSayisi} takipçi
                    </p>
                    {/* Öneri Nedeni */}
                    {u.oneriNedeni && (
                      <p className="text-[10px] text-[#6C5CE7] mt-0.5 flex items-center gap-1">
                        <Sparkles size={10} />
                        {u.oneriNedeni}
                      </p>
                    )}
                  </div>
                  <button 
                    onClick={() => handleFollow(u.id)}
                    className={`
                      px-3 py-1.5 rounded-full
                      text-xs font-medium
                      transition-colors
                      flex items-center gap-1
                      flex-shrink-0
                      ${followingIds.has(u.id) 
                        ? 'bg-[rgba(255,255,255,0.1)] text-white hover:bg-[rgba(255,255,255,0.15)]' 
                        : 'bg-[#6C5CE7] text-white hover:bg-[#5B4BD5]'
                      }
                    `}
                  >
                    {followingIds.has(u.id) ? (
                      'Takip Ediliyor'
                    ) : (
                      <>
                        <UserPlus size={12} />
                        Takip Et
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===== WEEKLY CHALLENGE ===== */}
      <div className="
        p-4 rounded-2xl
        bg-gradient-to-br from-[#6C5CE7]/20 to-[#00CEC9]/10
        border border-[rgba(108,92,231,0.3)]
      ">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-[#6C5CE7]" />
          <h3 className="font-semibold text-white text-sm">Haftalık Görev</h3>
        </div>
        <p className="text-sm text-[rgba(255,255,255,0.7)] mb-3">
          Bu hafta 3 film izle ve değerlendir!
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-[rgba(255,255,255,0.1)] overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-[#6C5CE7] to-[#00CEC9]"
              style={{ width: '66%' }}
            />
          </div>
          <span className="text-xs text-[rgba(255,255,255,0.5)]">2/3</span>
        </div>
      </div>

      {/* ===== FOOTER LINKS ===== */}
      <div className="pt-4 space-y-2 text-center">
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-[rgba(255,255,255,0.3)]">
          <a href="#" className="hover:text-[rgba(255,255,255,0.5)]">Hakkında</a>
          <a href="#" className="hover:text-[rgba(255,255,255,0.5)]">Yardım</a>
          <a href="#" className="hover:text-[rgba(255,255,255,0.5)]">Gizlilik</a>
          <a href="#" className="hover:text-[rgba(255,255,255,0.5)]">Şartlar</a>
        </div>
        <p className="text-[10px] text-[rgba(255,255,255,0.2)]">
          © 2024 Saga. Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  );
}
