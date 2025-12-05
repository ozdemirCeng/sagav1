import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, Film, BookOpen, Star, Loader2, X, Tv,
  ChevronRight, Sparkles, Heart, BadgeCheck,
  Swords, Ghost, Laugh, Rocket, Wand2, SlidersHorizontal, Layers, User,
  TrendingUp, Clock, Calendar, ChevronDown, ChevronUp, Globe
} from 'lucide-react';
import { externalApi, icerikApi, listeApi, kullaniciApi, kutuphaneApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { TmdbFilm, GoogleBook, PopulerListe, OnerilenKullanici } from '../../services/api';
import bookQueriesConfig from '../../config/bookQueries.json';
import { ContentCard, ContentGrid, tmdbToCardData, bookToCardData, normalizeContentType } from '../../components/ui';
import {
  getTmdbCache, setTmdbCache, clearTmdbCache,
  getBookCache, setBookCache, clearBookCache,
  getExploreDataCache, setExploreDataCache,
  getScrollCache, setScrollCache
} from '../../services/exploreCache';
import './ExplorePage.css';

type SagaRatingCacheEntry = {
  saga?: number;
  harici?: number;
  updatedAt?: number;
};

type SagaRatingUpdateDetail = {
  icerikId: number;
  saga?: number | null;
  harici?: number | null;
};

const sagaRatingsCache = new Map<number, SagaRatingCacheEntry>();

const applySagaRatingUpdate = (detail?: SagaRatingUpdateDetail) => {
  if (!detail || !detail.icerikId) return;
  const sagaValue = typeof detail.saga === 'number' ? detail.saga : undefined;
  const hariciValue = typeof detail.harici === 'number' ? detail.harici : undefined;
  if (sagaValue === undefined && hariciValue === undefined) {
    sagaRatingsCache.delete(detail.icerikId);
    return;
  }
  sagaRatingsCache.set(detail.icerikId, {
    saga: sagaValue,
    harici: hariciValue,
    updatedAt: Date.now(),
  });
};

let sagaRatingCacheListener: ((event: Event) => void) | null = null;

if (typeof window !== 'undefined' && !sagaRatingCacheListener) {
  sagaRatingCacheListener = (event: Event) => {
    const custom = event as CustomEvent<SagaRatingUpdateDetail>;
    applySagaRatingUpdate(custom.detail);
  };
  window.addEventListener('saga-rating-updated', sagaRatingCacheListener as EventListener);
}

// ============================================
// MATCH PERCENTAGE ALGORITHM
// ============================================

interface UserPreferences {
  favoriteGenres: Map<number, number>; // genreId -> weight (izleme/puan sayısı)
  avgRating: number; // kullanıcının ortalama puanı
  prefersTv: boolean; // dizi mi film mi tercih ediyor
  recentYearBias: number; // yeni içerik tercihi (0-1)
}

// Kullanıcının tercihlerine göre eşleşme yüzdesi hesapla
function calculateMatchPercentage(
  film: TmdbFilm,
  userPrefs: UserPreferences | null,
  allResults: TmdbFilm[]
): number {
  // Kullanıcı giriş yapmamış veya tercih verisi yoksa basit formül
  if (!userPrefs || userPrefs.favoriteGenres.size === 0) {
    const rating = film.puan || film.voteAverage || 0;
    const sagaRating = film.sagaOrtalamaPuan || 0;
    // Temel formül: TMDB puanı + SAGA puanı + popülerlik
    const baseScore = (rating * 5) + (sagaRating * 5) + 40;
    return Math.min(99, Math.max(50, Math.round(baseScore)));
  }

  let score = 50; // Başlangıç puanı

  // 1. Tür eşleşmesi (max +30 puan)
  const filmGenres = film.turIds || [];
  let genreScore = 0;
  let maxGenreWeight = 0;
  userPrefs.favoriteGenres.forEach((weight) => {
    if (weight > maxGenreWeight) maxGenreWeight = weight;
  });
  
  filmGenres.forEach(genreId => {
    const weight = userPrefs.favoriteGenres.get(genreId) || 0;
    if (weight > 0 && maxGenreWeight > 0) {
      genreScore += (weight / maxGenreWeight) * 15; // Her eşleşen tür için max 15 puan
    }
  });
  score += Math.min(30, genreScore);

  // 2. Puan kalitesi (max +20 puan)
  const rating = film.puan || film.voteAverage || 0;
  const sagaRating = film.sagaOrtalamaPuan || 0;
  const combinedRating = sagaRating > 0 ? (rating * 0.4 + sagaRating * 0.6) : rating;
  score += (combinedRating / 10) * 20;

  // 3. Media type tercihi (max +10 puan)
  const isTV = film.mediaType === 'tv';
  if ((userPrefs.prefersTv && isTV) || (!userPrefs.prefersTv && !isTV)) {
    score += 10;
  }

  // 4. Yenilik faktörü (max +10 puan)
  const year = parseInt((film.yayinTarihi || film.releaseDate || '0').split('-')[0]);
  const currentYear = new Date().getFullYear();
  if (year >= currentYear - 2) {
    score += 10 * userPrefs.recentYearBias;
  } else if (year >= currentYear - 5) {
    score += 5 * userPrefs.recentYearBias;
  }

  // 5. Göreceli popülerlik (max +10 puan)
  // En yüksek puanlı içerikle karşılaştır
  const maxRating = Math.max(...allResults.map(f => f.puan || f.voteAverage || 0));
  if (maxRating > 0) {
    score += (rating / maxRating) * 10;
  }

  return Math.min(99, Math.max(40, Math.round(score)));
}

// ============================================
// FILTER PANEL COMPONENT (Sağ Sidebar)
// ============================================

// TMDB türleri
const FILM_GENRES = [
  { id: 28, name: 'Aksiyon' },
  { id: 12, name: 'Macera' },
  { id: 16, name: 'Animasyon' },
  { id: 35, name: 'Komedi' },
  { id: 80, name: 'Suç' },
  { id: 99, name: 'Belgesel' },
  { id: 18, name: 'Dram' },
  { id: 10751, name: 'Aile' },
  { id: 14, name: 'Fantastik' },
  { id: 36, name: 'Tarih' },
  { id: 27, name: 'Korku' },
  { id: 10402, name: 'Müzik' },
  { id: 9648, name: 'Gizem' },
  { id: 10749, name: 'Romantik' },
  { id: 878, name: 'Bilim Kurgu' },
  { id: 10770, name: 'TV Film' },
  { id: 53, name: 'Gerilim' },
  { id: 10752, name: 'Savaş' },
  { id: 37, name: 'Western' },
];

const TV_GENRES = [
  { id: 10759, name: 'Aksiyon & Macera' },
  { id: 16, name: 'Animasyon' },
  { id: 35, name: 'Komedi' },
  { id: 80, name: 'Suç' },
  { id: 99, name: 'Belgesel' },
  { id: 18, name: 'Dram' },
  { id: 10751, name: 'Aile' },
  { id: 10762, name: 'Çocuk' },
  { id: 9648, name: 'Gizem' },
  { id: 10763, name: 'Haber' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Bilim Kurgu & Fantazi' },
  { id: 10766, name: 'Pembe Dizi' },
  { id: 10767, name: 'Talk Show' },
  { id: 10768, name: 'Savaş & Politik' },
  { id: 37, name: 'Western' },
];

// "Tümü" seçiliyken kullanılacak birleşik türler (ortak ID'ler)
const COMBINED_GENRES = [
  { id: 16, name: 'Animasyon' },
  { id: 35, name: 'Komedi' },
  { id: 80, name: 'Suç' },
  { id: 99, name: 'Belgesel' },
  { id: 18, name: 'Dram' },
  { id: 10751, name: 'Aile' },
  { id: 9648, name: 'Gizem' },
  { id: 37, name: 'Western' },
];

// Film ve dizi tür eşleştirmesi (benzer türler için)
// Kullanıcı bir tür seçtiğinde, hem film hem dizi için geçerli ID'leri döndürür
const GENRE_MAPPING: { [key: number]: number[] } = {
  // Film türleri -> eşleşen tüm ID'ler
  28: [28, 10759], // Aksiyon -> Film Aksiyon + Dizi Aksiyon&Macera
  12: [12, 10759], // Macera -> Film Macera + Dizi Aksiyon&Macera
  14: [14, 10765], // Fantastik -> Film Fantastik + Dizi Bilim Kurgu&Fantazi
  878: [878, 10765], // Bilim Kurgu -> Film Bilim Kurgu + Dizi Bilim Kurgu&Fantazi
  10752: [10752, 10768], // Savaş -> Film Savaş + Dizi Savaş&Politik
  // Dizi türleri -> eşleşen tüm ID'ler
  10759: [28, 12, 10759], // Aksiyon&Macera -> kendisi + Film Aksiyon + Film Macera
  10765: [14, 878, 10765], // Bilim Kurgu&Fantazi -> kendisi + Film Fantastik + Film Bilim Kurgu
  10768: [10752, 10768], // Savaş&Politik -> kendisi + Film Savaş
  // Ortak türler (aynı ID)
  16: [16], 35: [35], 80: [80], 99: [99], 18: [18], 10751: [10751], 9648: [9648], 37: [37],
  27: [27], 10402: [10402], 10749: [10749], 36: [36], 10770: [10770], 53: [53],
  10762: [10762], 10763: [10763], 10764: [10764], 10766: [10766], 10767: [10767],
};

interface FilterPanelProps {
  // Modal kontrolü
  isOpen: boolean;
  onClose: () => void;
  // Tab
  activeTab: 'tmdb' | 'kitaplar';
  // TMDB filtreleri
  tmdbFilter: 'all' | 'movie' | 'tv';
  onTmdbFilterChange: (filter: 'all' | 'movie' | 'tv') => void;
  tmdbSort: 'popular' | 'top_rated' | 'trending' | 'now_playing';
  onTmdbSortChange: (sort: 'popular' | 'top_rated' | 'trending' | 'now_playing') => void;
  // Kitap filtreleri
  bookCategory: string;
  bookCategories: { value: string; label: string; queryEn: string; queryTr: string }[];
  onBookCategoryChange: (category: string) => void;
  bookLang: string;
  bookLanguages: { value: string; label: string }[];
  onBookLangChange: (lang: string) => void;
  // Ortak filtreler
  minYear: number | null;
  maxYear: number | null;
  minPuan: number | null;
  selectedGenres: number[];
  onMinYearChange: (year: number | null) => void;
  onMaxYearChange: (year: number | null) => void;
  onMinPuanChange: (puan: number | null) => void;
  onGenresChange: (genres: number[]) => void;
  onApply: () => void;
  onReset: () => void;
}

function FilterPanel({
  isOpen,
  onClose,
  activeTab,
  tmdbFilter,
  onTmdbFilterChange,
  tmdbSort,
  onTmdbSortChange,
  bookCategory,
  bookCategories,
  onBookCategoryChange,
  bookLang,
  bookLanguages,
  onBookLangChange,
  minYear,
  maxYear,
  minPuan,
  selectedGenres,
  onMinYearChange,
  onMaxYearChange,
  onMinPuanChange,
  onGenresChange,
  onApply,
  onReset,
}: FilterPanelProps) {
  // Collapsible sections state
  const [showGenres, setShowGenres] = useState(true);
  const [showYearFilter, setShowYearFilter] = useState(true);
  const [showRatingFilter, setShowRatingFilter] = useState(true);
  const [showBookCategories, setShowBookCategories] = useState(true);

  // Aktif tab'a göre tür listesi
  const genres = tmdbFilter === 'all' ? COMBINED_GENRES : tmdbFilter === 'tv' ? TV_GENRES : FILM_GENRES;

  const toggleGenre = (genreId: number) => {
    if (selectedGenres.includes(genreId)) {
      onGenresChange(selectedGenres.filter(id => id !== genreId));
    } else {
      onGenresChange([...selectedGenres, genreId]);
    }
  };

  // Filtre sayısı
  const activeFilterCount = [
    minYear, 
    maxYear, 
    minPuan, 
    selectedGenres.length > 0 ? selectedGenres : null,
    bookCategory !== 'all' ? bookCategory : null,
    bookLang !== 'all' ? bookLang : null
  ].filter(Boolean).length;

  // ESC tuşu ile kapatma
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Uygula ve kapat
  const handleApplyAndClose = () => {
    onApply();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        bottom: '100px',
        width: '300px',
        background: 'rgba(17,17,21,0.95)',
        border: '1px solid rgba(212,168,83,0.2)',
        borderRadius: '16px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px)'
      }}
    >
      {/* Header */}
      <div style={{ 
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SlidersHorizontal size={16} style={{ color: '#d4a853' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Filtreler</span>
          {activeFilterCount > 0 && (
            <span style={{ 
              background: '#d4a853', 
              color: '#000', 
              fontSize: '10px', 
              fontWeight: 600, 
              padding: '2px 6px', 
              borderRadius: '10px' 
            }}>
              {activeFilterCount}
            </span>
          )}
        </div>
        <button 
          onClick={onClose}
          style={{ 
            background: 'rgba(255,255,255,0.05)', 
            border: 'none', 
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.5)', 
            cursor: 'pointer', 
            padding: '6px',
            display: 'flex'
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ 
        flex: 1, 
        padding: '16px 20px', 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* TMDB Filtreleri */}
        {activeTab === 'tmdb' && (
          <>
            {/* Medya Türü */}
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '12px', 
              padding: '14px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Medya Türü
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { value: 'all', label: 'Tümü', icon: <Star size={12} /> },
                  { value: 'movie', label: 'Film', icon: <Film size={12} /> },
                  { value: 'tv', label: 'Dizi', icon: <Tv size={12} /> }
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => onTmdbFilterChange(item.value as 'all' | 'movie' | 'tv')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: tmdbFilter === item.value ? '1px solid #d4a853' : '1px solid rgba(255,255,255,0.08)',
                      background: tmdbFilter === item.value ? 'rgba(212,168,83,0.15)' : 'transparent',
                      color: tmdbFilter === item.value ? '#d4a853' : 'rgba(255,255,255,0.6)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sıralama */}
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '12px', 
              padding: '14px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Sıralama
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { value: 'popular', label: 'Popüler', icon: <TrendingUp size={12} /> },
                  { value: 'top_rated', label: 'En İyi', icon: <Star size={12} /> },
                  { value: 'trending', label: 'Trend', icon: <TrendingUp size={12} /> },
                  { value: 'now_playing', label: tmdbFilter === 'tv' ? 'Yayında' : 'Vizyonda', icon: <Clock size={12} /> }
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => onTmdbSortChange(item.value as 'popular' | 'top_rated' | 'trending' | 'now_playing')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: tmdbSort === item.value ? '1px solid #d4a853' : '1px solid rgba(255,255,255,0.08)',
                      background: tmdbSort === item.value ? 'rgba(212,168,83,0.15)' : 'transparent',
                      color: tmdbSort === item.value ? '#d4a853' : 'rgba(255,255,255,0.6)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Türler */}
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '12px', 
              padding: '14px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <button
                onClick={() => setShowGenres(!showGenres)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  marginBottom: showGenres ? '10px' : 0
                }}
              >
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Türler {selectedGenres.length > 0 && `(${selectedGenres.length})`}
                </span>
                {showGenres ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.4)' }} /> : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />}
              </button>
              {showGenres && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  {genres.map((genre) => (
                    <button
                      key={genre.id}
                      onClick={() => toggleGenre(genre.id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '20px',
                        border: selectedGenres.includes(genre.id) ? '1px solid #d4a853' : '1px solid rgba(255,255,255,0.08)',
                        background: selectedGenres.includes(genre.id) ? 'rgba(212,168,83,0.15)' : 'transparent',
                        color: selectedGenres.includes(genre.id) ? '#d4a853' : 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 500
                      }}
                    >
                      {genre.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Kitap Filtreleri */}
        {activeTab === 'kitaplar' && (
          <>
            {/* Kitap Kategorileri */}
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '12px', 
              padding: '14px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <button
                onClick={() => setShowBookCategories(!showBookCategories)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  marginBottom: showBookCategories ? '10px' : 0
                }}
              >
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={12} style={{ color: '#d4a853' }} />
                  Kategori
                </span>
                {showBookCategories ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.4)' }} /> : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />}
              </button>
              {showBookCategories && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {bookCategories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => onBookCategoryChange(cat.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: bookCategory === cat.value ? '1px solid #d4a853' : '1px solid rgba(255,255,255,0.08)',
                        background: bookCategory === cat.value ? 'rgba(212,168,83,0.15)' : 'transparent',
                        color: bookCategory === cat.value ? '#d4a853' : 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 500
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dil Filtresi */}
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '12px', 
              padding: '14px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={12} style={{ color: '#d4a853' }} />
                Dil
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {bookLanguages.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => onBookLangChange(lang.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: bookLang === lang.value ? '1px solid #d4a853' : '1px solid rgba(255,255,255,0.08)',
                      background: bookLang === lang.value ? 'rgba(212,168,83,0.15)' : 'transparent',
                      color: bookLang === lang.value ? '#d4a853' : 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 500
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Yıl Filtresi - Tüm tablar için */}
        <div style={{ 
          background: 'rgba(255,255,255,0.03)', 
          borderRadius: '12px', 
          padding: '14px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <button
            onClick={() => setShowYearFilter(!showYearFilter)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginBottom: showYearFilter ? '10px' : 0
            }}
          >
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={12} style={{ color: '#d4a853' }} />
              Yayın Yılı
            </span>
            {showYearFilter ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.4)' }} /> : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />}
          </button>
          {showYearFilter && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Hızlı Seçim */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { label: 'Tümü', min: null, max: null },
                  { label: '2024', min: 2024, max: 2024 },
                  { label: '2023', min: 2023, max: 2023 },
                  { label: '2020-24', min: 2020, max: 2024 },
                  { label: '2010-19', min: 2010, max: 2019 },
                  { label: 'Klasik', min: null, max: 1999 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      onMinYearChange(preset.min);
                      onMaxYearChange(preset.max);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '20px',
                      border: minYear === preset.min && maxYear === preset.max ? '1px solid #d4a853' : '1px solid rgba(255,255,255,0.08)',
                      background: minYear === preset.min && maxYear === preset.max ? 'rgba(212,168,83,0.15)' : 'transparent',
                      color: minYear === preset.min && maxYear === preset.max ? '#d4a853' : 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 500
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {/* Custom Range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  placeholder="Min"
                  min="1900"
                  max="2025"
                  value={minYear || ''}
                  onChange={(e) => onMinYearChange(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min="1900"
                  max="2025"
                  value={maxYear || ''}
                  onChange={(e) => onMaxYearChange(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Puan Filtresi */}
        <div style={{ 
          background: 'rgba(255,255,255,0.03)', 
          borderRadius: '12px', 
          padding: '14px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <button
            onClick={() => setShowRatingFilter(!showRatingFilter)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginBottom: showRatingFilter ? '10px' : 0
            }}
          >
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Star size={12} style={{ color: '#d4a853' }} />
              Minimum Puan
            </span>
            {showRatingFilter ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.4)' }} /> : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />}
          </button>
          {showRatingFilter && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[null, 5, 6, 7, 8, 9].map((puan) => (
                <button
                  key={puan ?? 'all'}
                  onClick={() => onMinPuanChange(puan)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: minPuan === puan ? '1px solid #d4a853' : '1px solid rgba(255,255,255,0.08)',
                    background: minPuan === puan ? 'rgba(212,168,83,0.15)' : 'transparent',
                    color: minPuan === puan ? '#d4a853' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                >
                  {puan ? `${puan}+` : 'Tümü'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        padding: '12px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        gap: '8px'
      }}>
        <button 
          onClick={onReset}
          style={{ 
            flex: 1, 
            padding: '10px', 
            borderRadius: '8px', 
            background: 'transparent', 
            border: '1px solid rgba(255,255,255,0.1)', 
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500
          }}
        >
          Temizle
        </button>
        <button 
          onClick={handleApplyAndClose}
          style={{ 
            flex: 1, 
            padding: '10px', 
            borderRadius: '8px', 
            background: 'linear-gradient(135deg, #d4a853 0%, #a68532 100%)', 
            border: 'none', 
            color: '#000',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600
          }}
        >
          Uygula
        </button>
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

// HTML taglarını temizleyen yardımcı fonksiyon
// Google Books API bazen <b>, <p>, <i> gibi HTML tagları döndürüyor
function stripHtmlTags(html: string | undefined | null): string {
  if (!html) return '';
  // <br> ve </p> taglarını satır sonuna çevir (paragraf geçişleri için)
  let text = html.replace(/<br\s*\/?>/gi, '\n')
                 .replace(/<\/p>/gi, '\n');
  // Diğer HTML taglarını kaldır
  text = text.replace(/<[^>]*>/g, '');
  // HTML entities'i decode et
  text = text.replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&nbsp;/g, ' ');
  // Birden fazla satır sonunu tek satır sonuna çevir
  text = text.replace(/\n{3,}/g, '\n\n');
  // Satır başı/sonu boşlukları temizle
  text = text.split('\n').map(line => line.trim()).join('\n').trim();
  return text;
}

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
  const { user } = useAuth();

  // Kullanıcı tercihleri state'i
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  // Kullanıcının izlediği/kütüphanesindeki içerik ID'leri (harici ID'ler - TMDB ID)
  const [userWatchedIds, setUserWatchedIds] = useState<Set<string>>(new Set());

  // Body background override for void theme
  useEffect(() => {
    const originalBg = document.body.style.background;
    document.body.style.background = '#030304';
    return () => {
      document.body.style.background = originalBg;
    };
  }, []);

  // Kullanıcı tercihlerini yükle (kütüphane ve izleme geçmişinden)
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!user?.id) {
        setUserPreferences(null);
        setUserWatchedIds(new Set());
        return;
      }

      try {
        // Kullanıcının kütüphanesini çek
        const kutuphane = await kutuphaneApi.getKutuphane(user.id, { limit: 200 });
        
        // İzlenen içeriklerin harici ID'lerini topla
        const watchedIds = new Set<string>();
        
        if (!kutuphane || kutuphane.length === 0) {
          setUserPreferences(null);
          setUserWatchedIds(watchedIds);
          return;
        }

        // Tür tercihlerini analiz et
        const genreWeights = new Map<number, number>();
        let totalRating = 0;
        let ratingCount = 0;
        let tvCount = 0;
        let movieCount = 0;
        let recentCount = 0;
        let totalCount = 0;
        const currentYear = new Date().getFullYear();

        for (const item of kutuphane) {
          // İçerik ID'sini kaydet (sagaIcerikId ile eşleşecek)
          if (item.icerikId) {
            watchedIds.add(String(item.icerikId));
          }
          
          if (item.icerik) {
            totalCount++;
            
            // Tür analizi - içeriğin türlerini kontrol et
            // Not: Backend'den turIds gelmiyorsa içerik detayından çekmemiz gerekebilir
            // Şimdilik basit bir yaklaşım kullanalım
            
            // Puan ortalaması
            if (item.ortalamaPuan && item.ortalamaPuan > 0) {
              totalRating += item.ortalamaPuan;
              ratingCount++;
            }

            // Media type tercihi
            if (item.tur === 'dizi') {
              tvCount++;
            } else {
              movieCount++;
            }

            // Yenilik tercihi - güncelleme zamanına bak
            const updateYear = item.guncellemeZamani 
              ? new Date(item.guncellemeZamani).getFullYear() 
              : currentYear;
            if (updateYear >= currentYear - 1) {
              recentCount++;
            }
          }
        }
        
        setUserWatchedIds(watchedIds);

        // Tercihleri hesapla
        const prefs: UserPreferences = {
          favoriteGenres: genreWeights,
          avgRating: ratingCount > 0 ? totalRating / ratingCount : 7,
          prefersTv: tvCount > movieCount,
          recentYearBias: totalCount > 0 ? Math.min(1, recentCount / totalCount + 0.3) : 0.5,
        };

        setUserPreferences(prefs);
      } catch (error) {
        console.error('Kullanıcı tercihleri yüklenemedi:', error);
        setUserPreferences(null);
        setUserWatchedIds(new Set());
      }
    };

    loadUserPreferences();
  }, [user?.id]);

  // Kullanıcının takip ettiklerini yükle
  useEffect(() => {
    const loadTakipEdilenler = async () => {
      if (!user?.id) {
        setTakipEdilenIds(new Set());
        return;
      }
      try {
        const takipEdilenler = await kullaniciApi.getTakipEdilenler(user.id.toString());
        const ids = new Set(takipEdilenler.map(k => k.id));
        setTakipEdilenIds(ids);
      } catch (error) {
        console.error('Takip edilenler yüklenemedi:', error);
      }
    };
    loadTakipEdilenler();
  }, [user?.id]);

  // Keşfet sayfası ek verilerini yükle (popüler listeler, önerilen kullanıcılar)
  useEffect(() => {
    const loadKesfetData = async () => {
      // Cache'den veri varsa API çağrısı yapma
      const cachedExploreData = getExploreDataCache();
      if (cachedExploreData) {
        setPopulerListeler(cachedExploreData.populerListeler);
        setOnerilenKullanicilar(cachedExploreData.onerilenKullanicilar);
        return;
      }
      try {
        const [listeler, kullanicilar] = await Promise.all([
          listeApi.getPopuler(6).catch(() => []),
          kullaniciApi.getOnerilenler(5).catch(() => []),
        ]);
        setPopulerListeler(listeler);
        setOnerilenKullanicilar(kullanicilar);
        
        // Cache'e kaydet
        setExploreDataCache(listeler, kullanicilar);
      } catch (error) {
        console.error('Keşfet verileri yüklenemedi:', error);
      }
    };
    loadKesfetData();
  }, []);

  // URL'den state'leri oku (sayfa geri dönüşünde korunması için)
  const initialTab = (searchParams.get('tab') as 'tmdb' | 'kitaplar') || 'tmdb';
  const initialQuery = searchParams.get('q') || '';
  const initialTmdbFilter = (searchParams.get('tmdbFilter') as 'all' | 'movie' | 'tv') || 'all';
  const initialTmdbSort = (searchParams.get('tmdbSort') as 'popular' | 'top_rated' | 'trending' | 'now_playing') || 'popular';
  const initialBookLang = searchParams.get('bookLang') || '';
  const initialBookCategory = searchParams.get('bookCategory') || 'all';
  const initialMinYear = searchParams.get('minYear') ? parseInt(searchParams.get('minYear')!) : null;
  const initialMaxYear = searchParams.get('maxYear') ? parseInt(searchParams.get('maxYear')!) : null;
  const initialMinPuan = searchParams.get('minPuan') ? parseInt(searchParams.get('minPuan')!) : null;

  // In-memory cache'den sonuçları oku - initial değerlerden sonra tanımlanmalı
  const tmdbCacheData = getTmdbCache(initialTmdbFilter, initialTmdbSort);
  const bookCacheData = getBookCache(initialBookCategory, initialBookLang);
  
  // Cache'den veri geldiyse başlangıç değerlerini ayarla
  const hasCache = (tmdbCacheData !== null && tmdbCacheData.results.length > 0) || 
                   (bookCacheData !== null && bookCacheData.results.length > 0);
  
  // Cache'den sayfa ve index değerlerini al
  const initialTmdbPage = tmdbCacheData?.page || 1;
  const initialBookStartIndex = bookCacheData?.startIndex || 0;
  const initialQueryIndex = bookCacheData?.queryIndex || 0;

  // States
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const previousSearchValue = useRef(searchQuery);
  const [activeTab, setActiveTab] = useState<'tmdb' | 'kitaplar'>(initialTab);

  // TMDB filters
  const [tmdbFilter, setTmdbFilter] = useState<'all' | 'movie' | 'tv'>(initialTmdbFilter);
  const [tmdbSort, setTmdbSort] = useState<'popular' | 'top_rated' | 'trending' | 'now_playing'>(initialTmdbSort);
  const [tmdbPage, setTmdbPage] = useState(initialTmdbPage);
  const [tmdbHasMore, setTmdbHasMore] = useState(tmdbCacheData?.hasMore ?? true);
  const [tmdbLoadingMore, setTmdbLoadingMore] = useState(false);
  const tmdbLoadingRef = useRef(false);
  const tmdbDataLoadedRef = useRef(hasCache && tmdbCacheData !== null);

  // Kitap filters
  const [bookLang, setBookLang] = useState<string>(initialBookLang);
  const [bookStartIndex, setBookStartIndex] = useState(initialBookStartIndex);
  const [bookHasMore, setBookHasMore] = useState(bookCacheData?.hasMore ?? true);
  const [bookLoadingMore, setBookLoadingMore] = useState(false);
  const [bookDataLoaded, setBookDataLoaded] = useState(hasCache && bookCacheData !== null);
  
  // Arama için ayrı state'ler (infinite scroll)
  const [searchStartIndex, setSearchStartIndex] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(true);
  const searchSeenIds = useRef(new Set<string>());
  
  // Dil seçenekleri - Sadece güvenilir çalışan diller
  // Google Books API'nin langRestrict parametresi bazı dillerde hatalı sonuç veriyor
  const bookLanguages = [
    { value: '', label: '🌍 Tüm Diller' },
    { value: 'tr', label: '🇹🇷 Türkçe' },
    { value: 'en', label: '🇬🇧 İngilizce' },
  ];
  
  // Görüntülenen kitap ID'lerini takip et (güçlü duplicate kontrolü)
  const seenBookIds = useRef(new Set<string>());
  // Son istenen startIndex ve queryIndex'i takip et (duplicate request önleme)
  const lastRequestedKey = useRef<string>('');
  
  // ============================================
  // GOOGLE BOOKS API STRATEJİSİ - JSON CONFIG
  // ============================================
  // Sorgular bookQueries.json dosyasından okunuyor
  const turkishPublishers = bookQueriesConfig.turkishPublishers;
  const turkishAuthorQueries = bookQueriesConfig.turkishAuthors;
  const internationalPublishers = bookQueriesConfig.internationalPublishers;
  const universalGenreQueries = bookQueriesConfig.universalGenres;
  
  // Aktif sorgu listesi - dil seçimine göre (useMemo ile cache'le)
  const allCategoryQueries = useMemo(() => {
    if (bookLang === 'tr') {
      return [...turkishPublishers, ...turkishAuthorQueries, ...universalGenreQueries];
    }
    if (bookLang === 'en') {
      return [...internationalPublishers, ...universalGenreQueries];
    }
    // Tüm diller - TR ve EN sorgularını karışık (interleaved) sırala
    // Böylece hem Türkçe hem İngilizce kitaplar dengeli gelir
    const trQueries = [...turkishPublishers, ...turkishAuthorQueries];
    const enQueries = [...internationalPublishers, ...universalGenreQueries];
    const interleaved: string[] = [];
    const maxLen = Math.max(trQueries.length, enQueries.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < trQueries.length) interleaved.push(trQueries[i]);
      if (i < enQueries.length) interleaved.push(enQueries[i]);
    }
    return interleaved;
  }, [bookLang, turkishPublishers, turkishAuthorQueries, internationalPublishers, universalGenreQueries]);
  const [allQueryIndex, setAllQueryIndex] = useState(initialQueryIndex);
  
  // Kitap kategori filtreleri - JSON'dan oku
  const bookCategories = Object.entries(bookQueriesConfig.categories).map(([value, data]) => ({
    value,
    label: data.labelTr,
    queryEn: data.queryEn,
    queryTr: data.queryTr,
  }));
  const [bookCategory, setBookCategory] = useState(initialBookCategory);

  // Advanced filter states
  const [minYear, setMinYear] = useState<number | null>(initialMinYear);
  const [maxYear, setMaxYear] = useState<number | null>(initialMaxYear);
  const [minPuan, setMinPuan] = useState<number | null>(initialMinPuan);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [appliedFilters, setAppliedFilters] = useState({ 
    minYear: initialMinYear, 
    maxYear: initialMaxYear, 
    minPuan: initialMinPuan,
    genres: [] as number[]
  });
  
  // Filter modal state
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  // Keşfet sayfası ek verileri (gerçek API'lerden)
  const [populerListeler, setPopulerListeler] = useState<PopulerListe[]>([]);
  const [onerilenKullanicilar, setOnerilenKullanicilar] = useState<OnerilenKullanici[]>([]);
  
  // Takip edilen kullanıcı ID'leri
  const [takipEdilenIds, setTakipEdilenIds] = useState<Set<string>>(new Set());
  const [takipLoading, setTakipLoading] = useState<string | null>(null);

  // Data states - cache'den veya boş başlat
  const [tmdbResults, setTmdbResults] = useState<TmdbFilm[]>(tmdbCacheData?.results || []);
  const [bookResults, setBookResults] = useState<GoogleBook[]>(bookCacheData?.results || []);
  
  // Scroll restore flag - sadece bir kez yapılsın
  const scrollRestoredRef = useRef(false);
  
  // Cache varsa seenIds'i restore et
  useEffect(() => {
    if (bookCacheData?.seenIds) {
      bookCacheData.seenIds.forEach(id => seenBookIds.current.add(id));
    }
  }, []); // Sadece mount'ta çalış
  
  // Cache'den gelen scroll pozisyonunu kullan - veriler yüklendikten sonra
  useEffect(() => {
    // Zaten restore edildiyse tekrar yapma
    if (scrollRestoredRef.current) return;
    
    // Cache'den veri geldiyse ve sonuçlar varsa scroll'u restore et
    const shouldRestoreScroll = hasCache && (
      (activeTab === 'tmdb' && tmdbResults.length > 0) ||
      (activeTab === 'kitaplar' && bookResults.length > 0)
    );
    
    if (shouldRestoreScroll) {
      const savedScroll = getScrollCache(activeTab);
      if (savedScroll && savedScroll > 0) {
        scrollRestoredRef.current = true; // Flag'i işaretle
        // DOM'un tam oluşması için biraz bekle, animasyonsuz scroll
        const timer = setTimeout(() => {
          window.scrollTo(0, savedScroll);
          console.log(`📜 Scroll restore: ${savedScroll}px`);
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [hasCache, activeTab, tmdbResults.length, bookResults.length]); // Sonuçlar değişince kontrol et

  // Component unmount olurken cache'le
  useEffect(() => {
    return () => {
      // Scroll pozisyonunu kaydet
      setScrollCache(window.scrollY, activeTab);
      
      // TMDB sonuçlarını cache'le
      if (tmdbResults.length > 0) {
        setTmdbCache(tmdbResults, tmdbPage, tmdbHasMore, tmdbFilter, tmdbSort);
      }
      
      // Kitap sonuçlarını cache'le
      if (bookResults.length > 0) {
        setBookCache(
          bookResults, 
          bookStartIndex, 
          allQueryIndex, 
          bookHasMore, 
          bookCategory, 
          bookLang,
          Array.from(seenBookIds.current)
        );
      }
    };
  }, [activeTab, tmdbResults, tmdbPage, tmdbHasMore, tmdbFilter, tmdbSort, bookResults, bookStartIndex, allQueryIndex, bookHasMore, bookCategory, bookLang]);

  // Keşfet verilerini cache'den yükle
  useEffect(() => {
    const cachedExploreData = getExploreDataCache();
    if (cachedExploreData) {
      setPopulerListeler(cachedExploreData.populerListeler);
      setOnerilenKullanicilar(cachedExploreData.onerilenKullanicilar);
    }
  }, []); // Sadece mount'ta çalış

  // Loading states
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  const resetSearchState = useCallback(() => {
    setSearchStartIndex(0);
    setSearchHasMore(true);
    searchSeenIds.current.clear();

    seenBookIds.current.clear();
    setBookResults(prev => (prev.length ? [] : prev));
    setBookStartIndex(0);
    setAllQueryIndex(0);
    setBookHasMore(true);
    setBookDataLoaded(false);
    setBookLoadingMore(false);
    lastRequestedKey.current = '';

    setTmdbResults(prev => (prev.length ? [] : prev));
    setTmdbPage(1);
    setTmdbHasMore(true);
    setTmdbLoadingMore(false);
    tmdbDataLoadedRef.current = false;

    setLoading(false);
  }, []);

  // Filter helper - filtre uygulama (hem TMDB hem Kitaplar için)
  const applyFilters = () => {
    // Filtreler değişmediyse hiçbir şey yapma
    const filtersChanged = 
      appliedFilters.minYear !== minYear ||
      appliedFilters.maxYear !== maxYear ||
      appliedFilters.minPuan !== minPuan ||
      JSON.stringify(appliedFilters.genres) !== JSON.stringify(selectedGenres);
    
    if (!filtersChanged) {
      console.log('📋 Filtreler değişmedi, işlem atlanıyor');
      return;
    }
    
    setAppliedFilters({ minYear, maxYear, minPuan, genres: selectedGenres });
    // TMDB için
    setTmdbPage(1);
    setTmdbResults([]);
    setTmdbHasMore(true);
    clearTmdbCache(); // Cache temizle
    // Kitaplar için
    setBookStartIndex(0);
    setAllQueryIndex(0);
    setBookResults([]);
    seenBookIds.current.clear();
    lastRequestedKey.current = ''; // Cache key'i sıfırla
    setBookHasMore(true);
    setBookDataLoaded(false);
    clearBookCache(); // Cache temizle
  };

  const resetFilters = () => {
    setMinYear(null);
    setMaxYear(null);
    setMinPuan(null);
    setSelectedGenres([]);
    setAppliedFilters({ minYear: null, maxYear: null, minPuan: null, genres: [] });
    // TMDB için
    setTmdbPage(1);
    setTmdbResults([]);
    setTmdbHasMore(true);
    clearTmdbCache(); // Cache temizle
    // Kitaplar için
    setBookStartIndex(0);
    setAllQueryIndex(0);
    setBookResults([]);
    seenBookIds.current.clear();
    setBookHasMore(true);
    setBookDataLoaded(false);
    clearBookCache(); // Cache temizle
  };

  // TMDB filter/sort değiştiğinde state'leri sıfırla
  const handleTmdbFilterChange = (filter: 'all' | 'movie' | 'tv') => {
    if (filter === tmdbFilter) return;
    setTmdbFilter(filter);
    setTmdbPage(1);
    setTmdbResults([]);
    setTmdbHasMore(true);
    clearTmdbCache(); // Cache temizle
  };

  const handleTmdbSortChange = (sort: 'popular' | 'top_rated' | 'trending' | 'now_playing') => {
    if (sort === tmdbSort) return;
    setTmdbSort(sort);
    setTmdbPage(1);
    setTmdbResults([]);
    setTmdbHasMore(true);
    clearTmdbCache(); // Cache temizle
  };

  // Kitap kategori değiştiğinde state'leri sıfırla
  const handleBookCategoryChange = (category: string) => {
    if (category === bookCategory) return;
    setBookCategory(category);
    setBookStartIndex(0);
    setAllQueryIndex(0); // Harf/kelime rotasyonunu sıfırla
    setBookResults([]);
    seenBookIds.current.clear(); // Görüntülenen ID'leri temizle
    lastRequestedKey.current = ''; // Request tracker'ı sıfırla
    setBookHasMore(true);
    setBookDataLoaded(false);
    clearBookCache(); // Cache temizle
  };
  
  // Kitap dil değiştiğinde state'leri sıfırla
  const handleBookLangChange = (lang: string) => {
    if (lang === bookLang) return;
    setBookLang(lang);
    setBookStartIndex(0);
    setAllQueryIndex(0);
    setBookResults([]);
    seenBookIds.current.clear();
    lastRequestedKey.current = ''; // Request tracker'ı sıfırla
    setBookHasMore(true);
    setBookDataLoaded(false);
    clearBookCache(); // Cache temizle
  };

  // Puan filtresi değiştiğinde - "Tümü" seçilirse hemen uygula
  const handleMinPuanChange = (puan: number | null) => {
    setMinPuan(puan);
    
    // "Tümü" (null) seçildiğinde hemen filtreyi kaldır ve verileri yeniden yükle
    if (puan === null && appliedFilters.minPuan !== null) {
      setAppliedFilters(prev => ({ ...prev, minPuan: null }));
      // Kitaplar için state'leri sıfırla
      setBookStartIndex(0);
      setAllQueryIndex(0);
      setBookResults([]);
      seenBookIds.current.clear();
      lastRequestedKey.current = '';
      setBookHasMore(true);
      setBookDataLoaded(false);
      clearBookCache(); // Cache temizle
    }
  };

  // Rate limit retry sayacı (maksimum 3 deneme)
  const rateLimitRetryCount = useRef(0);
  const MAX_RATE_LIMIT_RETRIES = 3;

  // TMDB verilerini yükle - useRef ile fonksiyon referansını sabit tut
  const tmdbParamsRef = useRef({ tmdbFilter, tmdbSort, appliedFilters, searchQuery });
  tmdbParamsRef.current = { tmdbFilter, tmdbSort, appliedFilters, searchQuery };
  
  const tmdbResultsRef = useRef<TmdbFilm[]>([]);
  tmdbResultsRef.current = tmdbResults;

  // Arama fonksiyonu - ilk sayfa için
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      resetSearchState();
      return;
    }

    // Arama değiştiğinde state'leri sıfırla
    setSearchStartIndex(0);
    setSearchHasMore(true);
    searchSeenIds.current.clear();
    setLoading(true);
    
    try {
      if (activeTab === 'tmdb') {
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
        // API'ye her zaman relevance gönder
        const langParam = bookLang || undefined;
        const response = await externalApi.searchBooks(searchQuery, 0, 40, 'relevance', langParam);
        let results = response.items || [];
        
        // HTML taglarını tüm açıklamalardan temizle
        results = results.map((book: GoogleBook) => ({
          ...book,
          aciklama: stripHtmlTags(book.aciklama),
          description: stripHtmlTags(book.description),
        }));
        
        // Kalite filtresi - kapağı olmayanları çıkar
        results = results.filter((book: GoogleBook) => {
          const hasCover = book.posterUrl || book.thumbnail;
          if (!hasCover) return false;
          const title = book.baslik || book.title;
          if (!title || title.trim().length < 2) return false;
          return true;
        });
        
        // CLIENT-SIDE DİL FİLTRELEMESİ (arama için de)
        if (bookLang) {
          results = results.filter((book: GoogleBook) => {
            const bookLanguage = book.dil || book.language || '';
            return bookLanguage === bookLang;
          });
        }
        
        // Yıl filtresi uygula (appliedFilters)
        // Aralıktaki kitaplar + tarihi bilinmeyenler gösterilsin, aralık dışındakiler çıkarılsın
        if (appliedFilters.minYear || appliedFilters.maxYear) {
          const minY = appliedFilters.minYear ? parseInt(String(appliedFilters.minYear), 10) : 0;
          const maxY = appliedFilters.maxYear ? parseInt(String(appliedFilters.maxYear), 10) : 9999;
          
          console.log(`📅 Yıl filtresi: ${minY} - ${maxY}`);
          
          const inRange: GoogleBook[] = [];
          const noDate: GoogleBook[] = [];
          
          results.forEach((book: GoogleBook) => {
            const year = parseYearFromDate(book.yayinTarihi || book.publishedDate);
            console.log(`  - "${book.baslik || book.title}": yıl=${year}`);
            if (year === 0) {
              noDate.push(book); // Tarihi bilinmeyenler en sona
            } else if (year >= minY && year <= maxY) {
              inRange.push(book); // Aralıktakiler
            }
            // Aralık dışındakiler çıkarılıyor (dahil edilmiyor)
          });
          
          console.log(`  ✅ Aralıkta: ${inRange.length}, Tarihsiz: ${noDate.length}`);
          
          // Önce aralıktakiler, sonra tarihi bilinmeyenler
          results = [...inRange, ...noDate];
        }
        
        // Puan filtresi uygula (kitaplar için ortalamaPuan/averageRating)
        // Saga puanı varsa onu kullan, yoksa Google Books puanını kullan (5 üzerinden 10'a çevir)
        if (appliedFilters.minPuan) {
          results = results.filter((book: GoogleBook) => {
            // Saga puanı zaten 10 üzerinden
            if (book.ortalamaPuan && book.ortalamaPuan > 0) {
              return book.ortalamaPuan >= appliedFilters.minPuan!;
            }
            // Google Books puanı 5 üzerinden, 10'a çevir
            const googleRating = book.averageRating || 0;
            const rating10 = googleRating * 2;
            return rating10 >= appliedFilters.minPuan!;
          });
        }
        
        // Duplicate kontrolü
        results = results.filter((book: GoogleBook) => {
          if (searchSeenIds.current.has(book.id)) return false;
          searchSeenIds.current.add(book.id);
          return true;
        });
        
        setBookResults(results);
        // API'den sonuç geldiyse ve limit (1000) aşılmadıysa devam et
        // Google Books API maksimum startIndex=1000 destekler
        setSearchHasMore(true); // İlk sayfada her zaman devam et
      }
    } catch (err) {
      console.error('Arama hatası:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeTab, tmdbFilter, appliedFilters.minYear, appliedFilters.maxYear, appliedFilters.minPuan, bookLang, resetSearchState]);

  const handleSearchClear = useCallback(() => {
    if (!searchQuery.trim()) return;
    previousSearchValue.current = '';
    setSearchQuery('');
    resetSearchState();
  }, [searchQuery, resetSearchState]);

  // Arama için daha fazla sonuç yükle (infinite scroll)
  const loadMoreSearchResults = useCallback(async () => {
    if (!searchQuery.trim() || !searchHasMore || bookLoadingMore) return;
    
    const newStartIndex = searchStartIndex + 40;
    setBookLoadingMore(true);
    
    try {
      const langParam = bookLang || undefined;
      const response = await externalApi.searchBooks(searchQuery, newStartIndex, 40, 'relevance', langParam);
      let results = response.items || [];
      
      // HTML taglarını temizle
      results = results.map((book: GoogleBook) => ({
        ...book,
        aciklama: stripHtmlTags(book.aciklama),
        description: stripHtmlTags(book.description),
      }));
      
      // Kalite filtresi
      results = results.filter((book: GoogleBook) => {
        const hasCover = book.posterUrl || book.thumbnail;
        if (!hasCover) return false;
        const title = book.baslik || book.title;
        if (!title || title.trim().length < 2) return false;
        return true;
      });
      
      // CLIENT-SIDE DİL FİLTRELEMESİ
      if (bookLang) {
        results = results.filter((book: GoogleBook) => {
          const bookLanguage = book.dil || book.language || '';
          return bookLanguage === bookLang;
        });
      }
      
      // Yıl filtresi uygula (appliedFilters)
      // Aralıktaki kitaplar + tarihi bilinmeyenler gösterilsin, aralık dışındakiler çıkarılsın
      if (appliedFilters.minYear || appliedFilters.maxYear) {
        const minY = appliedFilters.minYear ? parseInt(String(appliedFilters.minYear), 10) : 0;
        const maxY = appliedFilters.maxYear ? parseInt(String(appliedFilters.maxYear), 10) : 9999;
        
        const inRange: GoogleBook[] = [];
        const noDate: GoogleBook[] = [];
        
        results.forEach((book: GoogleBook) => {
          const year = parseYearFromDate(book.yayinTarihi || book.publishedDate);
          if (year === 0) {
            noDate.push(book);
          } else if (year >= minY && year <= maxY) {
            inRange.push(book);
          }
        });
        
        results = [...inRange, ...noDate];
      }
      
      // Puan filtresi uygula
      // Saga puanı varsa onu kullan, yoksa Google Books puanını kullan (5 üzerinden 10'a çevir)
      if (appliedFilters.minPuan) {
        results = results.filter((book: GoogleBook) => {
          // Saga puanı zaten 10 üzerinden
          if (book.ortalamaPuan && book.ortalamaPuan > 0) {
            return book.ortalamaPuan >= appliedFilters.minPuan!;
          }
          // Google Books puanı 5 üzerinden, 10'a çevir
          const googleRating = book.averageRating || 0;
          const rating10 = googleRating * 2;
          return rating10 >= appliedFilters.minPuan!;
        });
      }
      
      // Duplicate kontrolü
      const uniqueResults = results.filter((book: GoogleBook) => {
        if (searchSeenIds.current.has(book.id)) return false;
        searchSeenIds.current.add(book.id);
        return true;
      });
      
      if (uniqueResults.length > 0) {
        // Yeni sonuçları ekle
        setBookResults(prev => {
          // Ek duplicate kontrolü - prev'de zaten varsa ekleme
          const existingIds = new Set(prev.map(b => b.id));
          const trulyUnique = uniqueResults.filter(b => !existingIds.has(b.id));
          if (trulyUnique.length === 0) return prev; // Değişiklik yoksa aynı referansı döndür
          
          return [...prev, ...trulyUnique];
        });
        setSearchStartIndex(newStartIndex);
      }
      
      // API'den hiç sonuç gelmediyse veya startIndex 960'ı geçtiyse (API limiti 1000) dur
      // response.items boş geldiyse artık sonuç yok demektir
      const apiHasMore = results.length > 0 && newStartIndex < 960;
      setSearchHasMore(apiHasMore);
      
      console.log(`🔍 Arama: startIndex=${newStartIndex}, sonuç=${results.length}, unique=${uniqueResults.length}, hasMore=${apiHasMore}`);
    } catch (err) {
      console.error('Daha fazla arama sonucu yükleme hatası:', err);
      setSearchHasMore(false);
    } finally {
      setBookLoadingMore(false);
    }
  }, [searchQuery, searchStartIndex, searchHasMore, bookLoadingMore, bookLang, appliedFilters.minYear, appliedFilters.maxYear, appliedFilters.minPuan]);

  // TMDB verileri yükle (tab, filtre, sort veya sayfa değişince)
  // Filter/sort değişince reset
  useEffect(() => {
    tmdbDataLoadedRef.current = false;
  }, [tmdbFilter, tmdbSort, appliedFilters]);
  
  useEffect(() => {
    if (activeTab !== 'tmdb') return;
    if (searchQuery.trim().length >= 2) return; // Arama varsa bu effect çalışmaz
    
    // Zaten yükleme yapılıyorsa atla
    if (tmdbLoadingRef.current) return;
    
    const isFirstPage = tmdbPage === 1;
    
    // Cache'den veri geldiyse ve ilk sayfaysa tekrar yükleme
    if (isFirstPage && hasCache && tmdbResults.length > 0) {
      console.log('🎬 Cache\'den TMDB verisi kullanılıyor, API çağrısı atlanıyor');
      tmdbDataLoadedRef.current = true;
      return;
    }
    
    // SADECE ilk sayfa için: zaten yüklüyse atla
    if (isFirstPage && tmdbDataLoadedRef.current && tmdbResultsRef.current.length > 0) return;
    
    const loadData = async () => {
      const currentResults = tmdbResultsRef.current;
      const { tmdbFilter: filter, tmdbSort: sort, appliedFilters: filters } = tmdbParamsRef.current;
      
      tmdbLoadingRef.current = true;
      if (isFirstPage) {
        setLoading(true);
      } else {
        setTmdbLoadingMore(true);
      }
      
      try {
        let results: TmdbFilm[] = [];
        
        if (sort === 'popular') {
          if (filter === 'movie') {
            results = await externalApi.getTmdbPopular(tmdbPage);
          } else if (filter === 'tv') {
            results = await externalApi.getTmdbPopularTv(tmdbPage);
          } else {
            const [movies, tv] = await Promise.all([
              externalApi.getTmdbPopular(tmdbPage),
              externalApi.getTmdbPopularTv(tmdbPage),
            ]);
            results = [...movies, ...tv].sort((a, b) => (b.puan || 0) - (a.puan || 0));
          }
        } else if (sort === 'top_rated') {
          if (filter === 'movie') {
            results = await externalApi.getTmdbTopRated(tmdbPage);
          } else if (filter === 'tv') {
            results = await externalApi.getTmdbTopRatedTv(tmdbPage);
          } else {
            const [movies, tv] = await Promise.all([
              externalApi.getTmdbTopRated(tmdbPage),
              externalApi.getTmdbTopRatedTv(tmdbPage),
            ]);
            results = [...movies, ...tv].sort((a, b) => (b.puan || 0) - (a.puan || 0));
          }
        } else if (sort === 'trending') {
          const mediaType = filter === 'movie' ? 'movie' : filter === 'tv' ? 'tv' : 'all';
          results = await externalApi.getTmdbTrending(mediaType, 'week', tmdbPage);
        } else if (sort === 'now_playing') {
          if (filter === 'movie') {
            results = await externalApi.getTmdbNowPlaying(tmdbPage);
          } else if (filter === 'tv') {
            results = await externalApi.getTmdbOnTheAir(tmdbPage);
          } else {
            const [movies, tv] = await Promise.all([
              externalApi.getTmdbNowPlaying(tmdbPage),
              externalApi.getTmdbOnTheAir(tmdbPage),
            ]);
            results = [...movies, ...tv];
          }
        }
        
        // Filtreleri uygula (yıl, puan ve tür)
        if (filters.minYear || filters.maxYear || filters.minPuan || filters.genres.length > 0) {
          // Seçilen türler için tüm eşleşen ID'leri topla (film ve dizi için)
          const expandedGenreIds = new Set<number>();
          filters.genres.forEach(genreId => {
            const mappedIds = GENRE_MAPPING[genreId] || [genreId];
            mappedIds.forEach(id => expandedGenreIds.add(id));
          });
          
          results = results.filter(item => {
            const year = item.yayinTarihi ? parseInt(item.yayinTarihi.split('-')[0]) : null;
            if (filters.minYear && (!year || year < filters.minYear)) return false;
            if (filters.maxYear && (!year || year > filters.maxYear)) return false;
            // Puan filtresi: Saga puanı varsa onu kullan, yoksa TMDB puanını kullan
            if (filters.minPuan) {
              const effectiveRating = (item.sagaOrtalamaPuan && item.sagaOrtalamaPuan > 0) 
                ? item.sagaOrtalamaPuan 
                : (item.puan || 0);
              if (effectiveRating < filters.minPuan) return false;
            }
            if (filters.genres.length > 0) {
              const itemGenres = item.turIds || [];
              // İçeriğin türlerinden herhangi biri genişletilmiş tür listesinde var mı?
              const hasMatchingGenre = itemGenres.some(itemGenreId => expandedGenreIds.has(itemGenreId));
              if (!hasMatchingGenre) return false;
            }
            return true;
          });
        }
        
        // Duplicate'leri filtrele (aynı ID + mediaType kombinasyonu)
        const existingIds = new Set(currentResults.map(r => `${r.mediaType}-${r.id}`));
        const uniqueNewResults = results.filter(r => !existingIds.has(`${r.mediaType}-${r.id}`));
        
        const merged = isFirstPage ? results : [...currentResults, ...uniqueNewResults];
        setTmdbResults(merged);
        
        // TMDB genelde sayfa başına 20 sonuç döndürür
        // API'den sonuç geldiyse daha fazla veri var demektir
        setTmdbHasMore(results.length > 0);
        
        if (isFirstPage) {
          tmdbDataLoadedRef.current = true;
        }
      } catch (err) {
        console.error('TMDB veri yükleme hatası:', err);
      } finally {
        if (isFirstPage) {
          setLoading(false);
        } else {
          setTmdbLoadingMore(false);
        }
        tmdbLoadingRef.current = false;
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tmdbFilter, tmdbSort, tmdbPage, appliedFilters, searchQuery]);

  // Scroll state'lerini ref'te tut (stale closure önleme)
  const tmdbScrollStateRef = useRef({ loading: false, tmdbLoadingMore: false, tmdbHasMore: true });
  tmdbScrollStateRef.current = { loading, tmdbLoadingMore, tmdbHasMore };

  // Scroll ile TMDB için sonsuz kaydırma (throttled)
  const tmdbScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (activeTab !== 'tmdb') return;

    const handleScroll = () => {
      const { loading: isLoading, tmdbLoadingMore: isLoadingMore, tmdbHasMore: hasMore } = tmdbScrollStateRef.current;
      
      // Yükleme yapılıyorsa veya daha fazla veri yoksa atla
      if (isLoading || isLoadingMore || !hasMore || tmdbLoadingRef.current) return;
      if (tmdbScrollTimeoutRef.current) return; // Throttle: bekleyen timeout varsa atla
      
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.body.offsetHeight - 400;
      if (scrollPosition >= threshold) {
        tmdbScrollTimeoutRef.current = setTimeout(() => {
          setTmdbPage(prev => prev + 1);
          tmdbScrollTimeoutRef.current = null;
        }, 300);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (tmdbScrollTimeoutRef.current) {
        clearTimeout(tmdbScrollTimeoutRef.current);
      }
    };
  }, [activeTab]); // Sadece tab değişince re-attach

  // IntersectionObserver ref'i - sonsuz kaydırma için
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  
  // IntersectionObserver ile TMDB sonsuz kaydırma
  useEffect(() => {
    if (activeTab !== 'tmdb') return;
    if (!loadMoreTriggerRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !loading && !tmdbLoadingMore && tmdbHasMore && !tmdbLoadingRef.current) {
          console.log('🎬 TMDB: IntersectionObserver tetiklendi, sayfa yükleniyor...');
          setTmdbPage(prev => prev + 1);
        }
      },
      { 
        rootMargin: '600px', // 600px önceden tetikle
        threshold: 0 
      }
    );
    
    observer.observe(loadMoreTriggerRef.current);
    
    return () => observer.disconnect();
  }, [activeTab, loading, tmdbLoadingMore, tmdbHasMore]);

  // Scroll ile Kitaplar için sonsuz kaydırma (throttled)
  const bookScrollStateRef = useRef({ 
    loading: false, 
    bookLoadingMore: false, 
    bookHasMore: true, 
    bookDataLoaded: false,
    searchQuery: '',
    searchHasMore: true
  });
  bookScrollStateRef.current = { loading, bookLoadingMore, bookHasMore, bookDataLoaded, searchQuery, searchHasMore };
  
  // loadMoreSearchResults'ı ref'te tut (stale closure önleme)
  const loadMoreSearchResultsRef = useRef(loadMoreSearchResults);
  loadMoreSearchResultsRef.current = loadMoreSearchResults;
  
  // IntersectionObserver ile Kitaplar sonsuz kaydırma
  useEffect(() => {
    if (activeTab !== 'kitaplar') return;
    if (!loadMoreTriggerRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        const { 
          loading: isLoading, 
          bookLoadingMore: isLoadingMore, 
          bookHasMore: hasMore, 
          bookDataLoaded: dataLoaded,
          searchQuery: query,
          searchHasMore: searchMore
        } = bookScrollStateRef.current;
        
        if (!entry.isIntersecting || isLoading || isLoadingMore) return;
        
        // Arama varsa loadMoreSearchResults kullan
        if (query.trim().length >= 2) {
          if (searchMore) {
            console.log('📚 Kitap Arama: IntersectionObserver tetiklendi');
            loadMoreSearchResultsRef.current();
          }
        } else {
          // Keşfet modu
          if (!hasMore || !dataLoaded) return;
          console.log('📚 Kitap Keşfet: IntersectionObserver tetiklendi');
          setBookStartIndex(prev => prev + 40);
        }
      },
      { 
        rootMargin: '800px', // 800px önceden tetikle (kitaplar daha yavaş yükleniyor)
        threshold: 0 
      }
    );
    
    observer.observe(loadMoreTriggerRef.current);
    
    return () => observer.disconnect();
  }, [activeTab]);

  // Kitaplar için varsayılan veri yükle (tab değişince veya kategori/sıralama değişince)
  useEffect(() => {
    const loadBooksData = async () => {
      if (activeTab !== 'kitaplar') return;
      
      // Arama varsa zaten handleSearch çalışacak
      if (searchQuery.trim().length >= 2) return;
      
      // ============================================
      // PUAN FİLTRESİ AKTİFSE VERİTABANINDAN ÇEK
      // ============================================
      if (appliedFilters.minPuan) {
        // İlk sayfa kontrolü
        const isFirstDbPage = bookStartIndex === 0;
        
        // Cache'den veri geldiyse ve ilk sayfaysa tekrar yükleme
        if (isFirstDbPage && hasCache && bookResults.length > 0) {
          console.log('📚 Puan filtresi: Cache\'den veri kullanılıyor, API çağrısı atlanıyor');
          setBookDataLoaded(true);
          return;
        }
        
        if (isFirstDbPage) {
          setLoading(true);
          seenBookIds.current.clear();
        } else {
          setBookLoadingMore(true);
        }
        
        try {
          const sayfa = Math.floor(bookStartIndex / 40) + 1;
          console.log(`📚 Veritabanından puanlı kitaplar çekiliyor: minPuan=${appliedFilters.minPuan}, sayfa=${sayfa}`);
          
          const response = await icerikApi.filtrele({
            tur: 'kitap',
            minPuan: appliedFilters.minPuan,
            sayfa,
            limit: 40
          });
          
          // Veritabanı sonuçlarını GoogleBook formatına çevir
          // Puanlar zaten 10 üzerinden, dönüşüm yapmıyoruz
          const dbResults: GoogleBook[] = response.data.map((item) => ({
            id: `db-${item.id}`,
            baslik: item.baslik,
            title: item.baslik,
            yazarlar: [],
            authors: [],
            aciklama: item.aciklama || '',
            description: item.aciklama || '',
            posterUrl: item.posterUrl || '',
            thumbnail: item.posterUrl || '',
            yayinTarihi: item.yayinTarihi?.toString().slice(0, 10) || '',
            publishedDate: item.yayinTarihi?.toString().slice(0, 10) || '',
            ortalamaPuan: item.ortalamaPuan ? Number(item.ortalamaPuan) : undefined,
            averageRating: item.ortalamaPuan ? Number(item.ortalamaPuan) : undefined,
            dil: 'tr',
            language: 'tr',
          }));
          
          // Duplicate kontrolü
          const uniqueResults = dbResults.filter((book: GoogleBook) => {
            if (seenBookIds.current.has(book.id)) return false;
            seenBookIds.current.add(book.id);
            return true;
          });
          
          if (isFirstDbPage) {
            setBookResults(uniqueResults);
          } else {
            setBookResults(prev => [...prev, ...uniqueResults]);
          }
          
          setBookHasMore(response.toplamSayfa > sayfa);
          setBookDataLoaded(true);
          
          console.log(`📚 Veritabanından ${uniqueResults.length} kitap geldi, toplam sayfa: ${response.toplamSayfa}`);
        } catch (err) {
          console.error('Veritabanı kitap yükleme hatası:', err);
          setBookHasMore(false);
        } finally {
          setLoading(false);
          setBookLoadingMore(false);
        }
        
        return; // Veritabanından çektik, Google Books API'yi çağırma
      }
      
      // ============================================
      // PUAN FİLTRESİ YOKSA GOOGLE BOOKS API
      // ============================================
      
      // İlk sayfa kontrolü
      const isFirstPage = bookStartIndex === 0 && allQueryIndex === 0;
      
      // Cache'den veri geldiyse ve ilk sayfaysa tekrar yükleme
      if (isFirstPage && hasCache && bookResults.length > 0) {
        console.log('📚 Cache\'den veri kullanılıyor, API çağrısı atlanıyor');
        setBookDataLoaded(true);
        return;
      }
      
      // Duplicate request kontrolü - aynı startIndex+queryIndex kombinasyonu için tekrar istek yapma
      const requestKey = `${bookStartIndex}-${allQueryIndex}`;
      if (lastRequestedKey.current === requestKey) {
        console.log(`⏭️ Duplicate request engellendi: ${requestKey}`);
        return;
      }
      lastRequestedKey.current = requestKey;
      
      // İlk yükleme kontrolü (sadece en baştaki sorgu)
      const isVeryFirstLoad = bookStartIndex === 0 && allQueryIndex === 0;
      
      if (isVeryFirstLoad) {
        setLoading(true);
        seenBookIds.current.clear(); // İlk sayfada ID setini temizle
      } else if (bookStartIndex === 0) {
        // Yeni sorguya geçildi ama ilk yükleme değil - loading devam etsin
      } else {
        setBookLoadingMore(true);
      }
      
      try {
        // Seçili kategorinin arama sorgusunu al - dile göre farklı sorgu
        let searchTerm: string;
        if (bookCategory === 'all') {
          // "Tümü" için harf/kelime rotasyonu kullan
          searchTerm = allCategoryQueries[allQueryIndex] || 'a';
        } else {
          const selectedCategory = bookCategories.find(c => c.value === bookCategory);
          // Dile göre uygun sorguyu seç
          if (bookLang === 'tr') {
            searchTerm = selectedCategory?.queryTr || 'roman';
          } else if (bookLang === 'en') {
            searchTerm = selectedCategory?.queryEn || 'subject:fiction';
          } else {
            // Tüm diller - startIndex'e göre TR/EN sorgusunu dönüşümlü kullan
            // İlk sayfa ve çift sayılı sayfalar için TR, tek sayılı sayfalar için EN
            const pageNumber = Math.floor(bookStartIndex / 40);
            if (pageNumber % 2 === 0) {
              searchTerm = selectedCategory?.queryTr || 'roman';
            } else {
              searchTerm = selectedCategory?.queryEn || 'subject:fiction';
            }
          }
        }
        
        console.log(`📚 Kitap arama: "${searchTerm}", startIndex: ${bookStartIndex}, queryIndex: ${allQueryIndex}, lang: ${bookLang || 'all'}`);
        
        // Dil filtresi (boş ise tüm diller) - q parametresinden BAĞIMSIZ langRestrict
        const langParam = bookLang || undefined;
        // Ticari kitaplar için paid-ebooks filtresi (daha kaliteli sonuçlar)
        // Not: Bazı dillerde paid-ebooks çok az sonuç verebilir, bu yüzden opsiyonel
        const filterParam = undefined; // 'paid-ebooks' çok kısıtlayıcı olabilir
        
        const response = await externalApi.searchBooks(searchTerm, bookStartIndex, 40, 'relevance', langParam, filterParam);
        
        // Başarılı istek - rate limit sayacını sıfırla
        rateLimitRetryCount.current = 0;
        
        let results = response.items || [];
        
        // ============================================
        // CLIENT-SIDE KALİTE FİLTRELEMESİ + HTML TEMİZLEME
        // ============================================
        // Resmi, açıklaması veya yazarı olmayan "çöp" kitapları filtrele
        // HTML taglarını temizle (Google Books bazen <b>, <p>, <i> döndürüyor)
        results = results.filter((book: GoogleBook) => {
          // Kapak resmi olmalı (posterUrl veya thumbnail)
          const hasCover = book.posterUrl || book.thumbnail;
          if (!hasCover) return false;
          // Başlık olmalı
          const title = book.baslik || book.title;
          if (!title || title.trim().length < 2) return false;
          // Yazar veya açıklama olmalı (en az biri)
          const hasAuthor = (book.yazarlar && book.yazarlar.length > 0) || (book.authors && book.authors.length > 0);
          // Açıklamayı HTML'den temizle ve kontrol et
          const rawDescription = book.aciklama || book.description || '';
          const cleanDescription = stripHtmlTags(rawDescription);
          const hasDescription = cleanDescription.length > 20;
          if (!hasAuthor && !hasDescription) return false;
          return true;
        });
        
        // HTML taglarını tüm açıklamalardan temizle
        results = results.map((book: GoogleBook) => ({
          ...book,
          aciklama: stripHtmlTags(book.aciklama),
          description: stripHtmlTags(book.description),
        }));
        
        // CLIENT-SIDE DİL FİLTRELEMESİ (langRestrict API'de her zaman çalışmıyor)
        if (bookLang) {
          const beforeFilter = results.length;
          results = results.filter((book: GoogleBook) => {
            const bookLanguage = book.dil || book.language || '';
            return bookLanguage === bookLang;
          });
          console.log(`🌍 Dil filtresi (${bookLang}): ${beforeFilter} -> ${results.length} kitap`);
        }
        
        // Sonuç gelmedi veya API limiti (1000) - sonraki sorguya geç
        if (results.length === 0 || bookStartIndex >= 960) {
          if (bookCategory === 'all' && allQueryIndex < allCategoryQueries.length - 1) {
            // Sonraki harfe/kelimeye geç
            console.log(`🔄 Sonraki sorguya geçiliyor: ${allCategoryQueries[allQueryIndex + 1]}`);
            setAllQueryIndex(prev => prev + 1);
            setBookStartIndex(0);
            // Loading state'leri temizle ki scroll handler çalışsın
            setBookLoadingMore(false);
            setLoading(false);
            return; // useEffect tekrar tetiklenecek
          } else if (bookCategory !== 'all' && bookStartIndex < 960 && results.length === 0) {
            // Belirli kategori seçiliyken sonuç gelmezse devam et
            console.log(`⏩ Kategori aramasında sonuç yok, devam: startIndex ${bookStartIndex} -> ${bookStartIndex + 40}`);
            setBookStartIndex(prev => prev + 40);
            setBookLoadingMore(false);
            setLoading(false);
            return;
          } else {
            // Gerçekten sonuç kalmadı
            setBookHasMore(false);
          }
        }
        
        // Güçlü duplicate kontrolü - useRef ile kalıcı set
        let uniqueNewResults = results.filter((r: GoogleBook) => {
          if (seenBookIds.current.has(r.id)) {
            return false;
          }
          seenBookIds.current.add(r.id);
          return true;
        });
        
        // Yıl filtresi uygula (appliedFilters'tan)
        // Aralıktaki kitaplar + tarihi bilinmeyenler gösterilsin, aralık dışındakiler çıkarılsın
        if (appliedFilters.minYear || appliedFilters.maxYear) {
          const minY = appliedFilters.minYear ? parseInt(String(appliedFilters.minYear), 10) : 0;
          const maxY = appliedFilters.maxYear ? parseInt(String(appliedFilters.maxYear), 10) : 9999;
          
          const inRange: GoogleBook[] = [];
          const noDate: GoogleBook[] = [];
          
          uniqueNewResults.forEach((book: GoogleBook) => {
            const year = parseYearFromDate(book.yayinTarihi || book.publishedDate);
            if (year === 0) {
              noDate.push(book);
            } else if (year >= minY && year <= maxY) {
              inRange.push(book);
            }
            // Aralık dışındakiler çıkarılıyor
          });
          
          uniqueNewResults = [...inRange, ...noDate];
        }
        
        // Puan filtresi uygula (kitaplar için - Saga puanı varsa onu, yoksa Google puanını kullan)
        if (appliedFilters.minPuan) {
          uniqueNewResults = uniqueNewResults.filter((book: GoogleBook) => {
            // Saga puanı zaten 10 üzerinden
            if (book.ortalamaPuan && book.ortalamaPuan > 0) {
              return book.ortalamaPuan >= appliedFilters.minPuan!;
            }
            // Google Books puanı 5 üzerinden, 10'a çevir
            const googleRating = book.averageRating || 0;
            const rating10 = googleRating * 2;
            return rating10 >= appliedFilters.minPuan!;
          });
        }
        
        // "Tümü" kategorisinde sonuçları karıştır (shuffle)
        if (bookCategory === 'all' && uniqueNewResults.length > 0) {
          for (let i = uniqueNewResults.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [uniqueNewResults[i], uniqueNewResults[j]] = [uniqueNewResults[j], uniqueNewResults[i]];
          }
        }
        
        // Callback form kullanarak stale closure sorununu önle
        // İlk yükleme: 36 kitaba ulaşana kadar sorgular devam eder
        const isInitialLoading = bookStartIndex === 0; // Bu sorgunun ilk sayfası mı?
        
        if (isInitialLoading) {
          setBookResults(prev => {
            const merged = [...prev, ...uniqueNewResults];
            const totalCount = merged.length;
            
            // İlk yüklemede minimum 36 kitap gelene kadar devam et
            const MIN_INITIAL_BOOKS = 36;
            if (totalCount < MIN_INITIAL_BOOKS && bookCategory === 'all' && allQueryIndex < allCategoryQueries.length - 1) {
              console.log(`📚 İlk yükleme: ${totalCount} kitap var, ${MIN_INITIAL_BOOKS} olana kadar devam ediliyor (sorgu ${allQueryIndex + 1})`);
              // Sonraki sorguya geç
              setTimeout(() => {
                setAllQueryIndex(prevIdx => prevIdx + 1);
              }, 0);
            } else if (totalCount >= MIN_INITIAL_BOOKS) {
              // Yeterli kitap var, loading'i kapat
              setBookDataLoaded(true);
              setLoading(false);
            }
            
            return merged;
          });
        } else {
          setBookResults(prev => {
            // Duplicate kontrolü - prev array'inde olan ID'leri filtrele
            const existingIds = new Set(prev.map(b => b.id));
            const trulyNew = uniqueNewResults.filter(b => !existingIds.has(b.id));
            
            // Scroll ile yüklemede sonuç olmadıysa ve "Tümü" kategorisindeyse sonraki sorguya geç
            if (trulyNew.length === 0 && bookCategory === 'all' && allQueryIndex < allCategoryQueries.length - 1) {
              console.log(`🔄 Scroll: Sonuç yok, sonraki sorguya geçiliyor: ${allQueryIndex + 1}`);
              setAllQueryIndex(prevIdx => prevIdx + 1);
              setBookStartIndex(0);
            }
            
            return [...prev, ...trulyNew];
          });
        }
        
        // "Tümü" kategorisinde her zaman devam et (rotasyon var)
        if (bookCategory === 'all') {
          setBookHasMore(allQueryIndex < allCategoryQueries.length - 1 || results.length > 0);
        } else {
          setBookHasMore(results.length > 0);
        }
        
        // Tüm sorgular bittiyse loading'i kapat
        if (allQueryIndex >= allCategoryQueries.length - 1) {
          setBookDataLoaded(true);
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error('Kitap yükleme hatası:', err);
        
        // Rate limit kontrolü (429 hatası)
        const isRateLimited = err instanceof Error && 
          (err.message.includes('429') || err.message.includes('rate') || err.message.includes('limit'));
        
        if (isRateLimited) {
          rateLimitRetryCount.current += 1;
          console.warn(`⚠️ Rate limit! Deneme: ${rateLimitRetryCount.current}/${MAX_RATE_LIMIT_RETRIES}`);
          
          if (rateLimitRetryCount.current >= MAX_RATE_LIMIT_RETRIES) {
            console.error('❌ Rate limit aşıldı, yükleme durduruluyor');
            setBookHasMore(false);
            setLoading(false);
            setBookLoadingMore(false);
            return;
          }
        }
        
        // Hata durumunda sonraki sorguya geç (rate limit değilse veya limit aşılmadıysa)
        if (bookCategory === 'all' && allQueryIndex < allCategoryQueries.length - 1) {
          setAllQueryIndex(prev => prev + 1);
          setBookStartIndex(0);
        } else {
          setBookHasMore(false);
          setLoading(false);
          setBookLoadingMore(false);
        }
      } finally {
        // Scroll durumunda (startIndex > 0) loading'i kapat
        if (bookStartIndex > 0) {
          setBookLoadingMore(false);
        }
      }
    };
    
    loadBooksData();
    // bookDataLoaded'ı dependency'den çıkardık çünkü infinite scroll'u engelliyordu
    // bookStartIndex veya allQueryIndex değişince her zaman yeni veri çekmeli
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, bookCategory, bookLang, searchQuery, bookStartIndex, allQueryIndex, appliedFilters.minYear, appliedFilters.maxYear, appliedFilters.minPuan]);

  // Arama tetikle
  useEffect(() => {
    const trimmed = searchQuery.trim();
    const prevTrimmed = previousSearchValue.current.trim();

    if (trimmed.length < 2) {
      if (prevTrimmed.length >= 2) {
        resetSearchState();
      }
      previousSearchValue.current = searchQuery;
      return;
    }

    previousSearchValue.current = searchQuery;
    const timer = setTimeout(() => {
      handleSearch();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch, resetSearchState]);

  // URL params güncelle - tüm filtreler dahil
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    params.set('tab', activeTab);
    
    // TMDB filtreleri
    if (tmdbFilter !== 'all') params.set('tmdbFilter', tmdbFilter);
    if (tmdbSort !== 'popular') params.set('tmdbSort', tmdbSort);
    
    // Kitap filtreleri
    if (bookLang) params.set('bookLang', bookLang);
    if (bookCategory !== 'all') params.set('bookCategory', bookCategory);
    
    // Yıl filtreleri
    if (appliedFilters.minYear) params.set('minYear', appliedFilters.minYear.toString());
    if (appliedFilters.maxYear) params.set('maxYear', appliedFilters.maxYear.toString());
    if (appliedFilters.minPuan) params.set('minPuan', appliedFilters.minPuan.toString());
    
    setSearchParams(params, { replace: true });
  }, [searchQuery, activeTab, tmdbFilter, tmdbSort, bookLang, bookCategory, appliedFilters.minYear, appliedFilters.maxYear, appliedFilters.minPuan, setSearchParams]);

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
      // İçerik detayına yönlendir - normalizeContentType ile tur'u düzelt
      const tur = normalizeContentType(icerik.tur || (type === 'tv' ? 'dizi' : type));
      navigate(`/icerik/${tur}/${icerik.id}`);
    } catch (err) {
      console.error('Import hatası:', err);
    } finally {
      setImporting(null);
    }
  };

  return (
    <>
    <div className="explore-page">
      {/* Main Content */}
      <main className="explore-content">
        {/* Search Section */}
        <section className="search-section">
          <div className="search-container">
            <div className="search-input-wrapper">
              <span className="search-icon">
                <Search size={22} />
              </span>
              <input
                type="text"
                className="search-input"
                placeholder="Film, dizi, kitap ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                className={`search-clear ${searchQuery ? 'visible' : ''}`}
                onClick={handleSearchClear}
              >
                <X size={16} />
              </button>
            </div>
            <button 
              className={`filter-toggle-btn ${filterModalOpen ? 'active' : ''}`}
              onClick={() => setFilterModalOpen(!filterModalOpen)}
              title="Filtreler"
            >
              <SlidersHorizontal size={20} />
              <span>Filtreler</span>
            </button>
          </div>
        </section>

        {/* Category Section */}
        <section className="category-section">
          <div className="section-header">
            <h2 className="section-title">Kategoriler</h2>
          </div>
          <div className="category-tabs">
            <button
              className={`category-tab ${activeTab === 'tmdb' && tmdbFilter === 'all' ? 'active' : ''}`}
              onClick={() => { setActiveTab('tmdb'); handleTmdbFilterChange('all'); }}
            >
              <Layers size={18} />
              Tümü
            </button>
            <button
              className={`category-tab ${activeTab === 'tmdb' && tmdbFilter === 'movie' ? 'active' : ''}`}
              onClick={() => { setActiveTab('tmdb'); handleTmdbFilterChange('movie'); }}
            >
              <Film size={18} />
              Filmler
            </button>
            <button
              className={`category-tab ${activeTab === 'tmdb' && tmdbFilter === 'tv' ? 'active' : ''}`}
              onClick={() => { setActiveTab('tmdb'); handleTmdbFilterChange('tv'); }}
            >
              <Tv size={18} />
              Diziler
            </button>
            <button
              className={`category-tab ${activeTab === 'kitaplar' ? 'active' : ''}`}
              onClick={() => setActiveTab('kitaplar')}
            >
              <BookOpen size={18} />
              Kitaplar
            </button>
          </div>
        </section>

        {/* ========================================
           FEATURED SECTION - Öne Çıkanlar (Arama yokken)
        ======================================== */}
        {!searchQuery && !loading && activeTab === 'tmdb' && tmdbResults.length > 0 && (
          <section className="featured-section">
            <div className="section-header">
              <h2 className="section-title">Öne Çıkanlar</h2>
            </div>
            <div className="featured-slider">
              {tmdbResults.slice(0, 4).map((film) => {
                const mediaType = film.mediaType === 'tv' ? 'tv' : 'film';
                // Backdrop tercih et, yoksa poster kullan
                const backdropUrl = film.arkaplanUrl || 
                                   (film.posterPath ? `https://image.tmdb.org/t/p/w780${film.posterPath}` : undefined) ||
                                   film.posterUrl;
                const title = film.baslik || film.title;
                const rating = film.puan || film.voteAverage;
                const year = (film.yayinTarihi || film.releaseDate)?.split('-')[0];
                const currentYear = new Date().getFullYear().toString();
                const badge = mediaType === 'tv' ? 'Dizi' : (year === currentYear || year === (parseInt(currentYear)-1).toString() ? 'Yeni' : 'Film');
                
                return (
                  <div 
                    key={`featured-${mediaType}-${film.id}`}
                    className="featured-card"
                    onClick={() => handleImport(film.id, mediaType)}
                  >
                    {backdropUrl && <img src={backdropUrl} alt={title} />}
                    <div className="featured-overlay">
                      <span className="featured-badge">{badge}</span>
                      <h3 className="featured-title">{title}</h3>
                      <div className="featured-meta">
                        {rating && rating > 0 && (
                          <span className="featured-rating tmdb">
                            <span className="rating-label">TMDB</span>
                            <Star size={14} />
                            {rating.toFixed(1)}
                          </span>
                        )}
                        <span className="featured-rating saga">
                          <span className="rating-label">SAGA</span>
                          <Star size={14} />
                          {film.sagaOrtalamaPuan && film.sagaOrtalamaPuan > 0 ? film.sagaOrtalamaPuan.toFixed(1) : '—'}
                        </span>
                        {year && <span>{year}</span>}
                      </div>
                    </div>
                    {importing === film.id && (
                      <div className="content-import-overlay" style={{opacity: 1}}>
                        <Loader2 size={24} className="animate-spin" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ========================================
           GENRE SECTION - Türlere Göz At (Arama yokken)
        ======================================== */}
        {!searchQuery && !loading && activeTab === 'tmdb' && (
          <section className="genre-section">
            <div className="section-header">
              <h2 className="section-title">Türlere Göz At</h2>
            </div>
            <div className="genre-grid">
              {[
                { id: 28, name: 'Aksiyon', icon: Swords },
                { id: 10749, name: 'Romantik', icon: Heart },
                { id: 27, name: 'Korku', icon: Ghost },
                { id: 35, name: 'Komedi', icon: Laugh },
                { id: 878, name: 'Bilim Kurgu', icon: Rocket },
                { id: 14, name: 'Fantastik', icon: Wand2 },
              ].map((genre) => {
                const IconComponent = genre.icon;
                return (
                  <div 
                    key={genre.id} 
                    className="genre-card" 
                    onClick={() => { 
                      setSelectedGenres([genre.id]); 
                      applyFilters(); 
                    }}
                  >
                    <div className="genre-content">
                      <IconComponent className="genre-icon" size={24} />
                      <span className="genre-name">{genre.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ========================================
           RECOMMENDATIONS - Sana Özel (Sadece giriş yapmış kullanıcılar için)
        ======================================== */}
        {!searchQuery && !loading && activeTab === 'tmdb' && tmdbResults.length > 4 && user && (
          <section className="recommendations-section">
            <div className="rec-header">
              <div className="rec-icon">
                <Sparkles size={22} />
              </div>
              <div className="rec-text">
                <h3>Sana Özel</h3>
                <p>İzleme geçmişine göre öneriler</p>
              </div>
            </div>
            <ContentGrid className="content-grid--horizontal">
              {tmdbResults
                .filter((film) => {
                  // Kullanıcının zaten izlediği/kütüphanesinde olan içerikleri filtrele
                  if (film.sagaIcerikId && userWatchedIds.has(String(film.sagaIcerikId))) {
                    return false;
                  }
                  return true;
                })
                .slice(4, 12)
                .map((film) => {
                const mediaType = film.mediaType === 'tv' ? 'tv' : 'film';
                const matchPercent = calculateMatchPercentage(film, userPreferences, tmdbResults);
                const cardData = tmdbToCardData(film);
                cardData.matchPercentage = matchPercent;
                
                return (
                  <ContentCard
                    key={`rec-${mediaType}-${film.id}`}
                    data={cardData}
                    size="lg"
                    showBadge={true}
                    showRatings={true}
                    showMatch={true}
                    showImportOverlay={!film.sagaIcerikId}
                    importing={importing === film.id}
                    onImport={() => handleImport(film.id, mediaType)}
                  />
                );
              })}
            </ContentGrid>
          </section>
        )}

        {/* ========================================
           POPULAR LISTS - Popüler Listeler (Gerçek API'den)
        ======================================== */}
        {!searchQuery && !loading && activeTab === 'tmdb' && populerListeler.length > 0 && (
          <section className="lists-section">
            <div className="section-header">
              <h2 className="section-title">Popüler Listeler</h2>
              <button className="section-link" onClick={() => navigate('/listelerim')}>
                Tümünü Gör
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="lists-slider">
              {populerListeler.map((liste) => (
                <div 
                  key={liste.id} 
                  className="list-card" 
                  onClick={() => navigate(`/liste/${liste.id}`)}
                >
                  <div className="list-covers">
                    {liste.kapakGorselleri.slice(0, 3).map((url, i) => (
                      <img key={i} src={url} alt="" />
                    ))}
                    {liste.kapakGorselleri.length === 0 && (
                      <div className="list-cover-placeholder">
                        <Film size={24} />
                      </div>
                    )}
                  </div>
                  <div className="list-info">
                    <h4 className="list-title">
                      {liste.ad}
                      {liste.onaylandi && <BadgeCheck size={16} className="verified" />}
                    </h4>
                    <div className="list-meta">
                      <span><Film size={14} /> {liste.icerikSayisi} içerik</span>
                      {liste.begeniSayisi > 0 && <span><Heart size={14} /> {liste.begeniSayisi}</span>}
                    </div>
                    <div className="list-author">
                      {liste.kullaniciAvatar ? (
                        <img src={liste.kullaniciAvatar} alt="" className="list-author-avatar" />
                      ) : (
                        <span className="list-author-avatar">{liste.kullaniciAdi[0].toUpperCase()}</span>
                      )}
                      <span className="list-author-name">@{liste.kullaniciAdi}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================
           PEOPLE SECTION - Keşfet: Kişiler (Gerçek API'den)
        ======================================== */}
        {!searchQuery && !loading && activeTab === 'tmdb' && onerilenKullanicilar.length > 0 && (
          <section className="people-section">
            <div className="section-header">
              <h2 className="section-title">Keşfet: Kişiler</h2>
            </div>
            <div className="people-slider">
              {onerilenKullanicilar.map((kisi) => (
                <div 
                  key={kisi.id} 
                  className="person-card"
                  onClick={() => navigate(`/profil/${kisi.kullaniciAdi}`)}
                >
                  <div className="person-avatar">
                    {kisi.avatarUrl ? (
                      <img src={kisi.avatarUrl} alt={kisi.kullaniciAdi} />
                    ) : (
                      <div className="person-avatar-placeholder">
                        <User size={32} />
                      </div>
                    )}
                  </div>
                  <h5 className="person-name">{kisi.goruntulemeAdi || kisi.kullaniciAdi}</h5>
                  <span className="person-username">@{kisi.kullaniciAdi}</span>
                  <span className="person-reason">{kisi.oneriNedeni}</span>
                  <button 
                    className={`person-follow ${takipEdilenIds.has(kisi.id) ? 'following' : ''}`}
                    disabled={takipLoading === kisi.id}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (takipEdilenIds.has(kisi.id)) {
                        // Takibi bırak
                        setTakipLoading(kisi.id);
                        try {
                          await kullaniciApi.takipBirak(kisi.id);
                          setTakipEdilenIds(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(kisi.id);
                            return newSet;
                          });
                        } catch (err) {
                          console.error('Takipten çıkılamadı:', err);
                        } finally {
                          setTakipLoading(null);
                        }
                      } else {
                        // Takip et
                        setTakipLoading(kisi.id);
                        try {
                          await kullaniciApi.takipEt(kisi.id);
                          setTakipEdilenIds(prev => new Set([...prev, kisi.id]));
                        } catch (err) {
                          console.error('Takip edilemedi:', err);
                        } finally {
                          setTakipLoading(null);
                        }
                      }
                    }}
                  >
                    {takipLoading === kisi.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : takipEdilenIds.has(kisi.id) ? (
                      'Takipten Çık'
                    ) : (
                      'Takip Et'
                    )}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Loading State */}
        {loading && (
          <div className="content-grid">
            {[...Array(12)].map((_, i) => (
              <ContentSkeleton key={i} />
            ))}
          </div>
        )}

        {/* TMDB Results */}
        {!loading && activeTab === 'tmdb' && (
          <>
            {/* Trending Section */}
            {tmdbResults.length > 0 && (
              <section className="trending-section">
                <div className="section-header">
                  <h2 className="section-title">
                    {searchQuery ? `"${searchQuery}" Sonuçları` : 'Trend'}
                  </h2>
                </div>
                <ContentGrid className="content-grid--horizontal">
                  {tmdbResults.slice(0, 8).map((film, index) => {
                    const mediaType = film.mediaType === 'tv' ? 'tv' : 'film';
                    return (
                      <ContentCard
                        key={`${mediaType}-${film.id}`}
                        data={tmdbToCardData(film)}
                        size="lg"
                        showBadge={true}
                        showRatings={true}
                        showImportOverlay={!film.sagaIcerikId}
                        importing={importing === film.id}
                        onImport={() => handleImport(film.id, mediaType)}
                        rank={index + 1}
                      />
                    );
                  })}
                </ContentGrid>
              </section>
            )}

            {/* More Results Grid */}
            {tmdbResults.length > 8 && (
              <section className="trending-section">
                <div className="section-header">
                  <h2 className="section-title">Daha Fazla</h2>
                </div>
                <ContentGrid>
                  {tmdbResults.slice(8).map((film) => {
                    const mediaType = film.mediaType === 'tv' ? 'tv' : 'film';
                    return (
                      <ContentCard
                        key={`${mediaType}-${film.id}`}
                        data={tmdbToCardData(film)}
                        showImportOverlay={!film.sagaIcerikId}
                        onImport={() => handleImport(film.id, mediaType)}
                        importing={importing === film.id}
                      />
                    );
                  })}
                </ContentGrid>
              </section>
            )}

            {/* Empty State */}
            {tmdbResults.length === 0 && searchQuery.trim().length >= 2 && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Film size={80} />
                </div>
                <h3 className="empty-state-title">Sonuç Bulunamadı</h3>
                <p className="empty-state-text">"{searchQuery}" için TMDB'de sonuç bulunamadı.</p>
              </div>
            )}

            {tmdbLoadingMore && (
              <div className="loading-spinner">
                <Loader2 size={32} />
              </div>
            )}
            
            {/* IntersectionObserver trigger - TMDB */}
            {activeTab === 'tmdb' && tmdbHasMore && !loading && (
              <div ref={loadMoreTriggerRef} className="load-more-trigger" />
            )}
          </>
        )}

        {/* Kitap Results */}
        {!loading && activeTab === 'kitaplar' && (
          <>
            {bookResults.length > 0 && (
              <section className="trending-section">
                <div className="section-header">
                  <h2 className="section-title">
                    {searchQuery ? `"${searchQuery}" Sonuçları` : 'Kitaplar'}
                  </h2>
                </div>
                <ContentGrid>
                  {bookResults.map((book) => {
                    const isDbBook = book.id.startsWith('db-');
                    const dbId = isDbBook ? parseInt(book.id.replace('db-', '')) : undefined;
                    
                    return (
                      <ContentCard
                        key={book.id}
                        data={bookToCardData(book, dbId)}
                        showImportOverlay={!dbId}
                        onImport={() => handleImport(book.id, 'kitap')}
                        importing={importing === book.id}
                      />
                    );
                  })}
                </ContentGrid>
              </section>
            )}

            {/* Empty State */}
            {bookResults.length === 0 && searchQuery.trim().length >= 2 && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <BookOpen size={80} />
                </div>
                <h3 className="empty-state-title">Sonuç Bulunamadı</h3>
                <p className="empty-state-text">"{searchQuery}" için kitap bulunamadı.</p>
              </div>
            )}

            {bookLoadingMore && (
              <div className="loading-spinner">
                <Loader2 size={32} />
              </div>
            )}
            
            {/* IntersectionObserver trigger - Kitaplar */}
            {activeTab === 'kitaplar' && bookHasMore && !loading && (
              <div ref={loadMoreTriggerRef} className="load-more-trigger" />
            )}
          </>
        )}
      </main>
    </div>

    {/* Filter Sidebar - explore-page dışında render edilmeli */}
    <FilterPanel
      isOpen={filterModalOpen}
      onClose={() => setFilterModalOpen(false)}
      activeTab={activeTab}
      tmdbFilter={tmdbFilter}
      onTmdbFilterChange={handleTmdbFilterChange}
      tmdbSort={tmdbSort}
      onTmdbSortChange={handleTmdbSortChange}
      bookCategory={bookCategory}
      bookCategories={bookCategories}
      onBookCategoryChange={handleBookCategoryChange}
      bookLang={bookLang}
      bookLanguages={bookLanguages}
      onBookLangChange={handleBookLangChange}
      minYear={minYear}
      maxYear={maxYear}
      minPuan={minPuan}
      selectedGenres={selectedGenres}
      onMinYearChange={setMinYear}
      onMaxYearChange={setMaxYear}
      onMinPuanChange={handleMinPuanChange}
      onGenresChange={setSelectedGenres}
      onApply={applyFilters}
      onReset={resetFilters}
    />
    </>
  );
}
