import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Film, BookOpen, Star, Loader2, X, Filter, Tv, TrendingUp, Clock, SlidersHorizontal, Calendar } from 'lucide-react';
import { icerikApi, externalApi } from '../../services/api';
import type { IcerikListItem, TmdbFilm, GoogleBook } from '../../services/api';

// ============================================
// NEBULA UI COMPONENTS
// ============================================

function NebulaCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-5 rounded-2xl bg-[rgba(20,20,35,0.65)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] shadow-lg ${className}`}>
      {children}
    </div>
  );
}

function NebulaButton({ 
  children, 
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick 
}: { 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const variantStyles = {
    primary: 'bg-gradient-to-r from-[#6C5CE7] to-[#a29bfe] text-white hover:shadow-lg hover:shadow-[#6C5CE7]/25',
    secondary: 'bg-[rgba(255,255,255,0.08)] text-white border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.12)]',
    ghost: 'bg-transparent text-[rgba(255,255,255,0.7)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
  };
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2'
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </button>
  );
}

// ============================================
// FILTER MENU COMPONENT
// ============================================

interface FilterMenuProps {
  isOpen: boolean;
  onClose: () => void;
  minYear: number | null;
  maxYear: number | null;
  minPuan: number | null;
  onMinYearChange: (year: number | null) => void;
  onMaxYearChange: (year: number | null) => void;
  onMinPuanChange: (puan: number | null) => void;
  onApply: () => void;
  onReset: () => void;
}

const FilterMenu = ({
  isOpen,
  onClose,
  minYear,
  maxYear,
  minPuan,
  onMinYearChange,
  onMaxYearChange,
  onMinPuanChange,
  onApply,
  onReset,
}: FilterMenuProps) => {
  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-[rgba(20,20,35,0.9)] rounded-2xl p-6 w-full max-w-md border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <SlidersHorizontal size={20} aria-hidden="true" />
            Filtreler
          </h3>
          <button 
            onClick={onClose} 
            className="text-[#8E8E93] hover:text-white"
            aria-label="Filtreleri kapat"
          >
            <X size={24} />
          </button>
        </div>

        {/* Yıl Filtresi */}
        <div className="mb-6">
          <label className="block text-white font-medium mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-[#6C5CE7]" />
            Yayın Yılı
          </label>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[#8E8E93] text-xs mb-1 block">Min</label>
              <select
                value={minYear || ''}
                onChange={(e) => onMinYearChange(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-[rgba(118,118,128,0.24)] text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/50"
              >
                <option value="">Hepsi</option>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[#8E8E93] text-xs mb-1 block">Max</label>
              <select
                value={maxYear || ''}
                onChange={(e) => onMaxYearChange(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-[rgba(118,118,128,0.24)] text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/50"
              >
                <option value="">Hepsi</option>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Minimum Puan */}
        <div className="mb-6">
          <label className="block text-white font-medium mb-3 flex items-center gap-2">
            <Star size={16} className="text-[#f39c12]" />
            Minimum Puan
          </label>
          <div className="flex gap-2 flex-wrap">
            {[null, 5, 6, 7, 8, 9].map((puan) => (
              <button
                key={puan ?? 'all'}
                onClick={() => onMinPuanChange(puan)}
                className={`px-4 py-2 rounded-xl text-sm transition-all ${
                  minPuan === puan
                    ? 'bg-[#f39c12]/20 text-[#f39c12] border border-[#f39c12]/30'
                    : 'bg-white/5 text-[#8E8E93] border border-transparent hover:bg-white/10'
                }`}
              >
                {puan ? `${puan}+` : 'Hepsi'}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={onReset}
            className="flex-1 py-3 rounded-xl bg-white/5 text-[#8E8E93] hover:bg-white/10 transition-colors"
          >
            Sıfırla
          </button>
          <button
            onClick={onApply}
            className="flex-1 py-3 rounded-xl bg-[#6C5CE7] text-white hover:bg-[#6C5CE7]/80 transition-colors"
          >
            Uygula
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// CONTENT CARD COMPONENT
// ============================================

interface ContentCardProps {
  id: number;
  baslik: string;
  posterUrl?: string;
  tur: string;
  puan?: number;
  hariciPuan?: number;
  yil?: string;
  onClick?: () => void;
}

function ContentCard({ baslik, posterUrl, tur, puan, hariciPuan, yil, onClick }: ContentCardProps) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2 bg-white/5">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={baslik}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {tur === 'film' ? (
              <Film size={40} className="text-[#8E8E93]" />
            ) : (
              <BookOpen size={40} className="text-[#8E8E93]" />
            )}
          </div>
        )}
        {/* Puan göstergesi - hem harici hem platform */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {hariciPuan !== undefined && hariciPuan > 0 && (
            <div className="flex items-center gap-1 bg-[#f39c12]/20 backdrop-blur-md px-1.5 py-0.5 rounded-md">
              <span className="text-[10px] text-[#f39c12] font-bold">IMDB</span>
              <span className="text-xs text-white font-semibold">{hariciPuan.toFixed(1)}</span>
            </div>
          )}
          {puan !== undefined && puan > 0 && (
            <div className="flex items-center gap-1 bg-[#6C5CE7]/20 backdrop-blur-md px-1.5 py-0.5 rounded-md">
              <span className="text-[10px] text-[#6C5CE7] font-bold">SAGA</span>
              <span className="text-xs text-white font-semibold">{puan.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
      <h3 className="font-medium text-white text-sm line-clamp-2 group-hover:text-[#6C5CE7] transition-colors">
        {baslik}
      </h3>
      <div className="flex items-center gap-2 mt-1">
        {tur === 'film' ? (
          <Film size={12} className="text-[#8E8E93]" />
        ) : (
          <BookOpen size={12} className="text-[#8E8E93]" />
        )}
        <span className="text-xs text-[#8E8E93] capitalize">{tur}</span>
        {yil && <span className="text-xs text-[#8E8E93]">• {yil}</span>}
      </div>
    </div>
  );
}

// ============================================
// EXTERNAL API CARD (TMDB / Google Books)
// ============================================

interface ExternalCardProps {
  item: TmdbFilm | GoogleBook;
  type: 'film' | 'kitap' | 'tv';
  onImport: () => void;
  importing?: boolean;
}

function ExternalCard({ item, type, onImport, importing }: ExternalCardProps) {
  const isTmdb = type === 'film' || type === 'tv';
  const film = item as TmdbFilm;
  const book = item as GoogleBook;

  // Backend Türkçe alan adları kullanıyor (posterUrl, baslik, puan)
  // HTTP URL'leri HTTPS'e çevir
  let posterUrl: string | undefined;
  if (isTmdb) {
    // Backend posterUrl tam URL döndürüyor, posterPath ise sadece path
    posterUrl = film.posterUrl || (film.posterPath
      ? `https://image.tmdb.org/t/p/w300${film.posterPath}`
      : undefined);
  } else {
    const rawUrl = book.posterUrl || book.thumbnail;
    posterUrl = rawUrl?.replace('http://', 'https://');
  }

  const title = isTmdb ? (film.baslik || film.title) : (book.baslik || book.title);
  const rating = isTmdb ? (film.puan || film.voteAverage) : (book.ortalamaPuan || book.averageRating);
  const year = isTmdb
    ? (film.yayinTarihi || film.releaseDate)?.split('-')[0]
    : (book.yayinTarihi || book.publishedDate)?.split('-')[0];
  
  // Media type belirleme
  const mediaType = isTmdb ? (film.mediaType || type) : 'kitap';
  const displayType = mediaType === 'tv' ? 'Dizi' : mediaType === 'movie' ? 'Film' : type === 'kitap' ? 'Kitap' : 'Film';

  return (
    <div className="group">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2 bg-white/5">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {type === 'tv' ? (
              <Tv size={40} className="text-[#8E8E93]" />
            ) : type === 'film' ? (
              <Film size={40} className="text-[#8E8E93]" />
            ) : (
              <BookOpen size={40} className="text-[#8E8E93]" />
            )}
          </div>
        )}
        {rating !== undefined && rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#6C5CE7]/20 backdrop-blur-md px-1.5 py-0.5 rounded-md">
            <Star size={10} className="text-[#6C5CE7] fill-[#6C5CE7]" />
            <span className="text-xs text-white font-semibold">{rating.toFixed(1)}</span>
          </div>
        )}
        {/* Media type badge */}
        {isTmdb && mediaType === 'tv' && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#00CEC9]/80 text-white text-xs font-medium">
            Dizi
          </div>
        )}
        {/* Import overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <NebulaButton
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onImport();
            }}
            disabled={importing}
          >
            {importing ? <Loader2 size={14} className="animate-spin" /> : 'Ekle'}
          </NebulaButton>
        </div>
      </div>
      <h3 className="font-medium text-white text-sm line-clamp-2">{title}</h3>
      <div className="flex items-center gap-2 mt-1">
        {type === 'tv' ? (
          <Tv size={12} className="text-[#00CEC9]" />
        ) : type === 'film' ? (
          <Film size={12} className="text-[#6C5CE7]" />
        ) : (
          <BookOpen size={12} className="text-[#8E8E93]" />
        )}
        <span className="text-xs text-[#8E8E93]">{displayType}</span>
        {year && <span className="text-xs text-[#8E8E93]">• {year}</span>}
      </div>
    </div>
  );
}

// ============================================
// CONTENT GRID SKELETON
// ============================================

function ContentSkeleton() {
  return (
    <div>
      <div className="aspect-[2/3] rounded-xl skeleton mb-2" />
      <div className="h-4 w-full skeleton rounded mb-1" />
      <div className="h-3 w-20 skeleton rounded" />
    </div>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Yayın tarihini yıla çeviren yardımcı fonksiyon
// "2023", "2023-05", "2023-05-15" formatlarını destekler
function parseYearFromDate(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  
  const yearMatch = dateStr.match(/^(\d{4})/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10);
  }
  return 0;
}

// ============================================
// MAIN EXPLORE PAGE
// ============================================

export default function ExplorePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // States
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState<'veritabani' | 'tmdb' | 'kitaplar'>(
    (searchParams.get('tab') as any) || 'veritabani'
  );
  const [filter, setFilter] = useState<'hepsi' | 'film' | 'kitap'>(
    (searchParams.get('tur') as any) || 'hepsi'
  );

  // TMDB filters
  const [tmdbFilter, setTmdbFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [tmdbSort, setTmdbSort] = useState<'popular' | 'top_rated' | 'trending' | 'now_playing'>('popular');

  // Kitap filters
  const [bookSort, setBookSort] = useState<'relevance' | 'newest'>('relevance');

  // Advanced filter states
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [minYear, setMinYear] = useState<number | null>(null);
  const [maxYear, setMaxYear] = useState<number | null>(null);
  const [minPuan, setMinPuan] = useState<number | null>(null);
  const [appliedFilters, setAppliedFilters] = useState({ minYear: null as number | null, maxYear: null as number | null, minPuan: null as number | null });

  // Data states
  const [icerikler, setIcerikler] = useState<IcerikListItem[]>([]);
  const [tmdbResults, setTmdbResults] = useState<TmdbFilm[]>([]);
  const [bookResults, setBookResults] = useState<GoogleBook[]>([]);
  const [populerIcerikler, setPopulerIcerikler] = useState<IcerikListItem[]>([]);
  const [yeniIcerikler, setYeniIcerikler] = useState<IcerikListItem[]>([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  // Filter helper - filtre uygulama
  const applyFilters = () => {
    setAppliedFilters({ minYear, maxYear, minPuan });
    setShowFilterMenu(false);
  };

  const resetFilters = () => {
    setMinYear(null);
    setMaxYear(null);
    setMinPuan(null);
    setAppliedFilters({ minYear: null, maxYear: null, minPuan: null });
    setShowFilterMenu(false);
  };

  // Filtre sayısı
  const activeFilterCount = [appliedFilters.minYear, appliedFilters.maxYear, appliedFilters.minPuan].filter(Boolean).length;

  // Popüler ve yeni içerikleri yükle (filtre değişince de tekrar yükle)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const turParam = filter !== 'hepsi' ? filter : undefined;
        const [populer, yeni] = await Promise.all([
          icerikApi.getPopuler({ limit: 12, tur: turParam }),
          icerikApi.getYeni({ limit: 12, tur: turParam }),
        ]);
        setPopulerIcerikler(populer);
        setYeniIcerikler(yeni);
      } catch (err) {
        console.error('Initial data yükleme hatası:', err);
      }
    };
    loadInitialData();
  }, [filter]);

  // TMDB verilerini yükle (arama yokken sıralamaya göre)
  const loadTmdbData = useCallback(async () => {
    if (activeTab !== 'tmdb') return;
    
    // Arama varsa arama yap
    if (searchQuery.trim().length >= 2) {
      setLoading(true);
      try {
        let results: TmdbFilm[];
        if (tmdbFilter === 'movie') {
          results = await externalApi.searchTmdb(searchQuery);
        } else if (tmdbFilter === 'tv') {
          results = await externalApi.searchTmdbTv(searchQuery);
        } else {
          results = await externalApi.searchTmdbMulti(searchQuery);
        }
        setTmdbResults(results);
      } catch (err) {
        console.error('TMDB arama hatası:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Arama yoksa sıralamaya göre yükle
    setLoading(true);
    try {
      let results: TmdbFilm[] = [];
      
      if (tmdbSort === 'popular') {
        if (tmdbFilter === 'movie') {
          results = await externalApi.getTmdbPopular();
        } else if (tmdbFilter === 'tv') {
          results = await externalApi.getTmdbPopularTv();
        } else {
          const [movies, tv] = await Promise.all([
            externalApi.getTmdbPopular(),
            externalApi.getTmdbPopularTv(),
          ]);
          results = [...movies, ...tv].sort((a, b) => (b.puan || 0) - (a.puan || 0));
        }
      } else if (tmdbSort === 'top_rated') {
        if (tmdbFilter === 'movie') {
          results = await externalApi.getTmdbTopRated();
        } else if (tmdbFilter === 'tv') {
          results = await externalApi.getTmdbTopRatedTv();
        } else {
          const [movies, tv] = await Promise.all([
            externalApi.getTmdbTopRated(),
            externalApi.getTmdbTopRatedTv(),
          ]);
          results = [...movies, ...tv].sort((a, b) => (b.puan || 0) - (a.puan || 0));
        }
      } else if (tmdbSort === 'trending') {
        const mediaType = tmdbFilter === 'movie' ? 'movie' : tmdbFilter === 'tv' ? 'tv' : 'all';
        results = await externalApi.getTmdbTrending(mediaType);
      } else if (tmdbSort === 'now_playing') {
        if (tmdbFilter === 'movie') {
          results = await externalApi.getTmdbNowPlaying();
        } else if (tmdbFilter === 'tv') {
          results = await externalApi.getTmdbOnTheAir();
        } else {
          const [movies, tv] = await Promise.all([
            externalApi.getTmdbNowPlaying(),
            externalApi.getTmdbOnTheAir(),
          ]);
          results = [...movies, ...tv];
        }
      }
      
      // Filtreleri uygula
      if (appliedFilters.minYear || appliedFilters.maxYear || appliedFilters.minPuan) {
        results = results.filter(item => {
          const year = item.yayinTarihi ? parseInt(item.yayinTarihi.split('-')[0]) : null;
          if (appliedFilters.minYear && (!year || year < appliedFilters.minYear)) return false;
          if (appliedFilters.maxYear && (!year || year > appliedFilters.maxYear)) return false;
          if (appliedFilters.minPuan && (!item.puan || item.puan < appliedFilters.minPuan)) return false;
          return true;
        });
      }
      
      setTmdbResults(results);
    } catch (err) {
      console.error('TMDB veri yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, tmdbFilter, tmdbSort, appliedFilters]);

  // Arama fonksiyonu
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setIcerikler([]);
      setBookResults([]);
      // TMDB için ayrıca sıralamaya göre yükle
      if (activeTab === 'tmdb') {
        loadTmdbData();
      } else {
        setTmdbResults([]);
      }
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'veritabani') {
        const turParam = filter !== 'hepsi' ? filter : undefined;
        const result = await icerikApi.ara(searchQuery, { tur: turParam, limit: 40 });
        setIcerikler(result.data);
      } else if (activeTab === 'tmdb') {
        let results: TmdbFilm[];
        if (tmdbFilter === 'movie') {
          results = await externalApi.searchTmdb(searchQuery);
        } else if (tmdbFilter === 'tv') {
          results = await externalApi.searchTmdbTv(searchQuery);
        } else {
          results = await externalApi.searchTmdbMulti(searchQuery);
        }
        setTmdbResults(results);
      } else if (activeTab === 'kitaplar') {
        const results = await externalApi.searchBooks(searchQuery, 0, 40, bookSort);
        
        // "En Yeni" seçiliyse, yayın yılına göre sırala
        if (bookSort === 'newest' && results.length > 0) {
          results.sort((a, b) => {
            const yearA = parseYearFromDate(a.yayinTarihi);
            const yearB = parseYearFromDate(b.yayinTarihi);
            return yearB - yearA; // En yeniden en eskiye
          });
        }
        
        setBookResults(results);
      }
    } catch (err) {
      console.error('Arama hatası:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeTab, filter, tmdbFilter, bookSort, loadTmdbData]);

  // TMDB verileri yükle (tab veya filtre değişince)
  useEffect(() => {
    if (activeTab === 'tmdb' && !searchQuery.trim()) {
      loadTmdbData();
    }
  }, [activeTab, tmdbFilter, tmdbSort, loadTmdbData, searchQuery, appliedFilters]);

  // Kitaplar için varsayılan veri yükle (tab değişince veya sıralama değişince)
  useEffect(() => {
    const loadBooksData = async () => {
      if (activeTab !== 'kitaplar') return;
      
      // Arama varsa zaten handleSearch çalışacak
      if (searchQuery.trim().length >= 2) return;
      
      setLoading(true);
      try {
        // Varsayılan olarak "bestseller" araması yap
        const results = await externalApi.searchBooks('bestseller', 0, 40, bookSort);
        
        // "En Yeni" seçiliyse, yayın yılına göre sırala (client tarafında)
        if (bookSort === 'newest' && results.length > 0) {
          results.sort((a, b) => {
            const yearA = parseYearFromDate(a.yayinTarihi);
            const yearB = parseYearFromDate(b.yayinTarihi);
            return yearB - yearA; // En yeniden en eskiye
          });
        }
        
        setBookResults(results);
      } catch (err) {
        console.error('Kitap yükleme hatası:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadBooksData();
  }, [activeTab, bookSort, searchQuery]);

  // Arama tetikle
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, filter, tmdbFilter, bookSort, handleSearch]);

  // URL params güncelle
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (activeTab !== 'veritabani') params.set('tab', activeTab);
    if (filter !== 'hepsi') params.set('tur', filter);
    setSearchParams(params, { replace: true });
  }, [searchQuery, activeTab, filter, setSearchParams]);

  // İçerik import et
  const handleImport = async (id: string, type: 'film' | 'kitap' | 'tv') => {
    setImporting(id);
    try {
      let icerik;
      if (type === 'film') {
        icerik = await externalApi.importTmdbFilm(id);
      } else if (type === 'tv') {
        icerik = await externalApi.importTmdbTvShow(id);
      } else {
        icerik = await externalApi.importBook(id);
      }
      // İçerik detayına yönlendir
      const tur = type === 'tv' ? 'film' : type; // Diziler de film olarak kaydediliyor
      navigate(`/icerik/${tur}/${icerik.id}`);
    } catch (err) {
      console.error('Import hatası:', err);
    } finally {
      setImporting(null);
    }
  };

  // İçerik detayına git
  const handleContentClick = (icerik: IcerikListItem) => {
    navigate(`/icerik/${icerik.tur}/${icerik.id}`);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Filter Menu Modal */}
      <FilterMenu
        isOpen={showFilterMenu}
        onClose={() => setShowFilterMenu(false)}
        minYear={minYear}
        maxYear={maxYear}
        minPuan={minPuan}
        onMinYearChange={setMinYear}
        onMaxYearChange={setMaxYear}
        onMinPuanChange={setMinPuan}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Keşfet</h1>
          <p className="text-[#8E8E93]">Film ve kitapları keşfedin, kütüphanenize ekleyin.</p>
        </div>
        <button
          onClick={() => setShowFilterMenu(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
            activeFilterCount > 0 
              ? 'bg-[#6C5CE7]/20 text-[#6C5CE7] border border-[#6C5CE7]/30' 
              : 'bg-white/5 text-[#8E8E93] border border-transparent hover:bg-white/10'
          }`}
        >
          <SlidersHorizontal size={18} />
          <span className="text-sm font-medium">Filtreler</span>
          {activeFilterCount > 0 && (
            <span className="bg-[#6C5CE7] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-[#8E8E93] text-sm">Aktif Filtreler:</span>
          {appliedFilters.minYear && (
            <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
              Min Yıl: {appliedFilters.minYear}
              <button 
                onClick={() => setAppliedFilters(prev => ({ ...prev, minYear: null }))} 
                className="ml-1 hover:text-red-400"
                aria-label="Min yıl filtresini kaldır"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {appliedFilters.maxYear && (
            <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
              Max Yıl: {appliedFilters.maxYear}
              <button 
                onClick={() => setAppliedFilters(prev => ({ ...prev, maxYear: null }))} 
                className="ml-1 hover:text-red-400"
                aria-label="Max yıl filtresini kaldır"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {appliedFilters.minPuan && (
            <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
              Min Puan: {appliedFilters.minPuan}+
              <button 
                onClick={() => setAppliedFilters(prev => ({ ...prev, minPuan: null }))} 
                className="ml-1 hover:text-red-400"
                aria-label="Min puan filtresini kaldır"
              >
                <X size={12} />
              </button>
            </span>
          )}
          <button 
            onClick={resetFilters}
            className="text-[#fd79a8] text-xs hover:underline"
          >
            Tümünü Temizle
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" aria-hidden="true" />
        <input
          id="search-input"
          name="search"
          type="text"
          placeholder="Film veya kitap ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Film veya kitap ara"
          className="w-full bg-[rgba(118,118,128,0.24)] border-none pl-12 pr-12 py-4 rounded-2xl text-white text-base focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/50 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-white transition-colors"
            aria-label="Aramayı temizle"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
        {[
          { id: 'veritabani', label: 'Kütüphane', icon: <Filter size={16} /> },
          { id: 'tmdb', label: 'Film & Dizi', icon: <Film size={16} /> },
          { id: 'kitaplar', label: 'Kitaplar', icon: <BookOpen size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-[#6C5CE7] text-white'
                : 'bg-white/5 text-[#8E8E93] hover:bg-white/10 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Chips (only for veritabani tab) */}
      {activeTab === 'veritabani' && (
        <div className="flex gap-2 mb-6">
          {[
            { id: 'hepsi', label: 'Tümü' },
            { id: 'film', label: 'Filmler' },
            { id: 'kitap', label: 'Kitaplar' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                filter === f.id
                  ? 'bg-white/20 text-white border border-white/20'
                  : 'bg-white/5 text-[#8E8E93] border border-transparent hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* TMDB Filters */}
      {activeTab === 'tmdb' && (
        <div className="space-y-4 mb-6">
          {/* Tür Filtresi */}
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all', label: 'Tümü', icon: <Star size={14} /> },
              { id: 'movie', label: 'Filmler', icon: <Film size={14} /> },
              { id: 'tv', label: 'Diziler', icon: <Tv size={14} /> },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTmdbFilter(f.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                  tmdbFilter === f.id
                    ? 'bg-[#6C5CE7]/20 text-[#6C5CE7] border border-[#6C5CE7]/30'
                    : 'bg-white/5 text-[#8E8E93] border border-transparent hover:bg-white/10'
                }`}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>
          
          {/* Sıralama */}
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'popular', label: 'Popüler', icon: <TrendingUp size={14} /> },
              { id: 'top_rated', label: 'En Yüksek Puan', icon: <Star size={14} /> },
              { id: 'trending', label: 'Trend', icon: <TrendingUp size={14} /> },
              { id: 'now_playing', label: tmdbFilter === 'tv' ? 'Yayında' : 'Vizyonda', icon: <Clock size={14} /> },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setTmdbSort(s.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                  tmdbSort === s.id
                    ? 'bg-[#00CEC9]/20 text-[#00CEC9] border border-[#00CEC9]/30'
                    : 'bg-white/5 text-[#8E8E93] border border-transparent hover:bg-white/10'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kitap Filters */}
      {activeTab === 'kitaplar' && (
        <div className="flex gap-2 mb-6">
          {[
            { id: 'relevance', label: 'En İlgili', icon: <Star size={14} /> },
            { id: 'newest', label: 'En Yeni', icon: <Clock size={14} /> },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setBookSort(s.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                bookSort === s.id
                  ? 'bg-[#00b894]/20 text-[#00b894] border border-[#00b894]/30'
                  : 'bg-white/5 text-[#8E8E93] border border-transparent hover:bg-white/10'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <ContentSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Veritabanı Search Results */}
      {!loading && searchQuery.trim().length >= 2 && activeTab === 'veritabani' && (
        <>
          {icerikler.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {icerikler.map((icerik) => (
                <ContentCard
                  key={icerik.id}
                  id={icerik.id}
                  baslik={icerik.baslik}
                  posterUrl={icerik.posterUrl}
                  tur={icerik.tur}
                  puan={icerik.ortalamaPuan}
                  hariciPuan={icerik.hariciPuan}
                  yil={icerik.yayinTarihi?.split('-')[0]}
                  onClick={() => handleContentClick(icerik)}
                />
              ))}
            </div>
          ) : (
            <NebulaCard className="text-center py-12">
              <Search size={48} className="mx-auto mb-4 text-[#8E8E93]" />
              <p className="text-[#8E8E93]">
                "{searchQuery}" için sonuç bulunamadı.
              </p>
              <p className="text-[#8E8E93] text-sm mt-2">
                TMDB veya Kitaplar sekmesinden arayabilirsiniz.
              </p>
            </NebulaCard>
          )}
        </>
      )}

      {/* TMDB Results - arama veya sıralama sonuçları */}
      {!loading && activeTab === 'tmdb' && (
        <>
          {tmdbResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {tmdbResults.map((film) => {
                const mediaType = film.mediaType === 'tv' ? 'tv' : 'film';
                return (
                  <ExternalCard
                    key={`${mediaType}-${film.id}`}
                    item={film}
                    type={mediaType}
                    onImport={() => handleImport(film.id, mediaType)}
                    importing={importing === film.id}
                  />
                );
              })}
            </div>
          ) : searchQuery.trim().length >= 2 ? (
            <NebulaCard className="text-center py-12">
              <Film size={48} className="mx-auto mb-4 text-[#8E8E93]" />
              <p className="text-[#8E8E93]">
                "{searchQuery}" için TMDB'de sonuç bulunamadı.
              </p>
            </NebulaCard>
          ) : null}
        </>
      )}

      {/* Kitap sonuçları */}
      {!loading && activeTab === 'kitaplar' && (
        <>
          {bookResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {bookResults.map((book) => (
                <ExternalCard
                  key={book.id}
                  item={book}
                  type="kitap"
                  onImport={() => handleImport(book.id, 'kitap')}
                  importing={importing === book.id}
                />
              ))}
            </div>
          ) : searchQuery.trim().length >= 2 ? (
            <NebulaCard className="text-center py-12">
              <BookOpen size={48} className="mx-auto mb-4 text-[#8E8E93]" />
              <p className="text-[#8E8E93]">
                "{searchQuery}" için kitap bulunamadı.
              </p>
            </NebulaCard>
          ) : null}
        </>
      )}

      {/* Default Content (no search) - sadece veritabanı sekmesinde */}
      {!loading && activeTab === 'veritabani' && searchQuery.trim().length < 2 && (
        <>
          {/* Popüler İçerikler */}
          {populerIcerikler.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Star size={20} className="text-[#f39c12]" />
                  Popüler
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {populerIcerikler.map((icerik) => (
                  <ContentCard
                    key={icerik.id}
                    id={icerik.id}
                    baslik={icerik.baslik}
                    posterUrl={icerik.posterUrl}
                    tur={icerik.tur}
                    puan={icerik.ortalamaPuan}
                    hariciPuan={icerik.hariciPuan}
                    yil={icerik.yayinTarihi?.split('-')[0]}
                    onClick={() => handleContentClick(icerik)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Yeni Eklenenler */}
          {yeniIcerikler.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Yeni Eklenenler</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {yeniIcerikler.map((icerik) => (
                  <ContentCard
                    key={icerik.id}
                    id={icerik.id}
                    baslik={icerik.baslik}
                    posterUrl={icerik.posterUrl}
                    tur={icerik.tur}
                    puan={icerik.ortalamaPuan}
                    hariciPuan={icerik.hariciPuan}
                    yil={icerik.yayinTarihi?.split('-')[0]}
                    onClick={() => handleContentClick(icerik)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {populerIcerikler.length === 0 && yeniIcerikler.length === 0 && (
            <NebulaCard className="text-center py-12">
              <Search size={48} className="mx-auto mb-4 text-[#8E8E93]" />
              <h3 className="text-xl font-semibold text-white mb-2">Keşfetmeye Başlayın</h3>
              <p className="text-[#8E8E93]">
                Film veya kitap arayarak kütüphanenizi oluşturmaya başlayın.
              </p>
            </NebulaCard>
          )}
        </>
      )}
    </div>
  );
}
