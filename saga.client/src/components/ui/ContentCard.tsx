import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, BookOpen, Tv, Star, Loader2, Play, CheckCircle, Clock, AlertTriangle, BookMarked } from 'lucide-react';
import { icerikApi } from '../../services/api';
import './ContentCard.css';

// ============================================
// TYPES
// ============================================

export type ContentType = 'film' | 'kitap' | 'tv' | 'dizi';
export type CardSize = 'sm' | 'md' | 'lg';
// Backend enum değerleri: izlendi, izlenecek, okundu, okunacak, devam_ediyor
export type LibraryStatus = 'izlendi' | 'izlenecek' | 'okundu' | 'okunacak' | 'devam_ediyor' | 'izleniyor' | 'tamamlandi' | 'beklemede' | 'birakti' | 'okunuyor';

// ============================================
// NORMALIZE TYPE HELPER
// Backend'den "Film", "Dizi", "Kitap", "TV", "movie" gibi
// değerler gelir, bunları lowercase ContentType'a çevirir
// ============================================

export function normalizeContentType(tur?: string | null): ContentType {
  if (!tur) return 'film';
  const lower = tur.toLowerCase().trim();
  
  // Dizi varyasyonları (tv önce kontrol - movie'den önce)
  if (lower === 'dizi' || lower === 'tv' || lower === 'series' || lower === 'tv series' || lower === 'tvseries') {
    return 'dizi';
  }
  
  // Kitap varyasyonları
  if (lower === 'kitap' || lower === 'book' || lower === 'books') {
    return 'kitap';
  }
  
  // Film varyasyonları - movie, film vs hepsi film
  if (lower === 'film' || lower === 'movie' || lower === 'movies') {
    return 'film';
  }
  
  // Default film
  return 'film';
}

export interface ContentCardData {
  id: string | number;
  title: string;
  posterUrl?: string;
  type: ContentType;
  year?: string;
  genres?: string[];
  authors?: string[]; // Kitaplar için
  
  // Rating bilgileri
  tmdbRating?: number;
  googleRating?: number;
  sagaRating?: number;
  
  // İçerik detayları
  duration?: number; // Film süresi (dakika)
  seasonCount?: number; // Dizi sezon sayısı
  episodeCount?: number; // Dizi bölüm sayısı
  pageCount?: number; // Kitap sayfa sayısı
  
  // Veritabanı bilgisi
  dbId?: number; // Eğer içerik veritabanında varsa
  
  // Kütüphane durumu
  libraryStatus?: LibraryStatus;
  
  // Match percentage (Sana Özel için)
  matchPercentage?: number;
  
  // Trending rank (Popüler içerikler için)
  rank?: number;
  
  // Harici API'den mi geldi
  isExternal?: boolean;
}

export interface ContentCardProps {
  data: ContentCardData;
  size?: CardSize;
  showImportOverlay?: boolean;
  onImport?: () => void;
  importing?: boolean;
  onClick?: () => void;
  showRatings?: boolean;
  showBadge?: boolean;
  showStatus?: boolean;
  showMatch?: boolean;
  rank?: number; // Trending rank to display
  className?: string;
}

// ============================================
// SAGA RATING CACHE
// ============================================

interface SagaRatingCacheEntry {
  saga?: number;
  harici?: number;
  updatedAt: number;
}

const sagaRatingsCache = new Map<number, SagaRatingCacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

// Rating update event handler
interface SagaRatingUpdateDetail {
  icerikId: number;
  newRating?: number;
  newAverage?: number;
}

function applySagaRatingUpdate(detail: SagaRatingUpdateDetail) {
  const existing = sagaRatingsCache.get(detail.icerikId);
  if (existing) {
    sagaRatingsCache.set(detail.icerikId, {
      ...existing,
      saga: detail.newAverage ?? existing.saga,
      updatedAt: Date.now(),
    });
  }
}

// ============================================
// CONTENT CARD COMPONENT
// ============================================

export function ContentCard({
  data,
  size = 'md',
  showImportOverlay = false,
  onImport,
  importing = false,
  onClick,
  showRatings = true,
  showBadge = true,
  showStatus = false,
  showMatch = false,
  rank,
  className = '',
}: ContentCardProps) {
  const navigate = useNavigate();
  const [dbRatings, setDbRatings] = useState<SagaRatingCacheEntry | undefined>(
    () => data.dbId ? sagaRatingsCache.get(data.dbId) : undefined
  );

  // Veritabanı rating'lerini yükle
  useEffect(() => {
    if (!data.dbId) {
      setDbRatings(undefined);
      return;
    }

    const cached = sagaRatingsCache.get(data.dbId);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL) {
      setDbRatings(cached);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const detail = await icerikApi.getById(data.dbId!);
        const payload: SagaRatingCacheEntry = {
          saga: detail.ortalamaPuan ?? undefined,
          harici: detail.hariciPuan ?? undefined,
          updatedAt: Date.now(),
        };
        sagaRatingsCache.set(data.dbId!, payload);
        if (!cancelled) {
          setDbRatings(payload);
        }
      } catch (error) {
        console.error('Saga rating fetch failed', error);
      }
    })();

    return () => { cancelled = true; };
  }, [data.dbId]);

  // Rating update event listener
  useEffect(() => {
    if (!data.dbId) return;

    const handleSagaRatingUpdate = (event: Event) => {
      const detail = (event as CustomEvent<SagaRatingUpdateDetail>).detail;
      if (!detail || detail.icerikId !== data.dbId) return;
      applySagaRatingUpdate(detail);
      setDbRatings(sagaRatingsCache.get(data.dbId!));
    };

    window.addEventListener('saga-rating-updated', handleSagaRatingUpdate as EventListener);
    return () => window.removeEventListener('saga-rating-updated', handleSagaRatingUpdate as EventListener);
  }, [data.dbId]);

  // Click handler
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (data.dbId) {
      navigate(`/icerik/${data.dbId}`);
    } else if (showImportOverlay && onImport && !importing) {
      onImport();
    }
  };

  // Normalize the type for consistent display
  const normalizedType = normalizeContentType(data.type);

  // Type badge text
  const getBadgeText = () => {
    switch (normalizedType) {
      case 'dizi':
        return 'Dizi';
      case 'kitap':
        return 'Kitap';
      case 'film':
      default:
        return 'Film';
    }
  };

  // Type badge class
  const getBadgeClass = () => {
    switch (normalizedType) {
      case 'dizi':
        return 'content-card__badge--dizi';
      case 'kitap':
        return 'content-card__badge--kitap';
      case 'film':
      default:
        return 'content-card__badge--film';
    }
  };

  // Status icon
  const getStatusIcon = () => {
    switch (data.libraryStatus) {
      case 'izleniyor':
      case 'okunuyor':
      case 'devam_ediyor':
        return <Play size={12} />;
      case 'tamamlandi':
      case 'izlendi':
      case 'okundu':
        return <CheckCircle size={12} />;
      case 'beklemede':
      case 'izlenecek':
      case 'okunacak':
        return <Clock size={12} />;
      case 'birakti':
        return <AlertTriangle size={12} />;
      default:
        return <BookMarked size={12} />;
    }
  };

  // Status class
  const getStatusClass = () => {
    switch (data.libraryStatus) {
      case 'izleniyor':
      case 'okunuyor':
      case 'devam_ediyor':
        return 'content-card__status--izleniyor';
      case 'tamamlandi':
      case 'izlendi':
      case 'okundu':
        return 'content-card__status--tamamlandi';
      case 'beklemede':
      case 'izlenecek':
      case 'okunacak':
        return 'content-card__status--beklemede';
      case 'birakti':
        return 'content-card__status--birakti';
      default:
        return '';
    }
  };

  // Status text - içerik türüne göre doğru metin
  const getStatusText = () => {
    const isKitap = normalizedType === 'kitap';
    
    switch (data.libraryStatus) {
      case 'izleniyor':
        return isKitap ? 'Okunuyor' : 'İzleniyor';
      case 'devam_ediyor':
        return isKitap ? 'Okunuyor' : 'İzleniyor';
      case 'okunuyor':
        return 'Okunuyor';
      case 'tamamlandi':
        return isKitap ? 'Okundu' : 'İzlendi';
      case 'izlendi':
        return isKitap ? 'Okundu' : 'İzlendi';
      case 'okundu':
        return 'Okundu';
      case 'beklemede':
        return 'Beklemede';
      case 'izlenecek':
        return isKitap ? 'Okunacak' : 'İzlenecek';
      case 'okunacak':
        return 'Okunacak';
      case 'birakti':
        return 'Bırakıldı';
      default:
        return '';
    }
  };

  // Poster placeholder icon
  const getPlaceholderIcon = () => {
    switch (normalizedType) {
      case 'dizi':
        return <Tv />;
      case 'kitap':
        return <BookOpen />;
      case 'film':
      default:
        return <Film />;
    }
  };

  // Calculate displayed ratings - SAGA öncelikli, yoksa harici
  const primaryRating = normalizedType === 'kitap'
    ? (dbRatings?.harici ?? data.googleRating)
    : (dbRatings?.harici ?? data.tmdbRating);
  
  const sagaRating = dbRatings?.saga ?? data.sagaRating;
  
  // SAGA puanı varsa sadece onu göster, yoksa harici puanı göster
  const displayRating = (sagaRating !== undefined && sagaRating > 0) ? sagaRating : primaryRating;
  const isSagaRating = sagaRating !== undefined && sagaRating > 0;

  return (
    <div
      className={`content-card ${size !== 'md' ? `size-${size}` : ''} ${className}`}
      onClick={handleClick}
    >
      <div className="content-card__poster">
        {data.posterUrl ? (
          <img src={data.posterUrl} alt={data.title} />
        ) : (
          <div className="content-card__poster-placeholder">
            {getPlaceholderIcon()}
          </div>
        )}

        {/* Trending Rank */}
        {rank !== undefined && (
          <span className="content-card__rank">{rank}</span>
        )}

        {/* Type Badge */}
        {showBadge && (
          <span className={`content-card__badge ${getBadgeClass()}`}>
            {getBadgeText()}
          </span>
        )}

        {/* Library Status */}
        {showStatus && data.libraryStatus && (
          <div className={`content-card__status ${getStatusClass()}`}>
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </div>
        )}

        {/* Match Percentage */}
        {showMatch && data.matchPercentage !== undefined && (
          <div className="content-card__match">
            %{data.matchPercentage} Eşleşme
          </div>
        )}

        {/* Import Overlay */}
        {showImportOverlay && !data.dbId && (
          <div className="content-card__overlay">
            <button
              className="content-card__overlay-btn"
              onClick={(e) => {
                e.stopPropagation();
                onImport?.();
              }}
              disabled={importing}
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : 'Ekle'}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="content-card__footer">
        <h3 className="content-card__title">{data.title}</h3>
        
        {/* Rating - SAGA varsa SAGA, yoksa harici */}
        {showRatings && displayRating !== undefined && displayRating > 0 && (
          <div className="content-card__ratings">
            <div className={`content-card__rating ${isSagaRating ? 'content-card__rating--saga' : ''}`}>
              <Star size={12} />
              <span className="content-card__rating-value">{displayRating.toFixed(1)}</span>
            </div>
          </div>
        )}
        
        <div className="content-card__meta">
          {data.year && <span className="content-card__year">{data.year}</span>}
          
          {/* Süre/Sezon-Bölüm/Sayfa bilgisi */}
          {data.duration && normalizedType === 'film' && (
            <span className="content-card__duration">
              {Math.floor(data.duration / 60)}s {data.duration % 60}dk
            </span>
          )}
          
          {normalizedType === 'dizi' && data.seasonCount && (
            <span className="content-card__season-info">
              {data.seasonCount} Sezon
              {data.episodeCount && ` · ${data.episodeCount} Bölüm`}
            </span>
          )}
          
          {normalizedType === 'kitap' && data.pageCount && (
            <span className="content-card__page-count">
              {data.pageCount} sayfa
            </span>
          )}
        </div>
        {/* Genres or Authors */}
        {(data.genres?.length || data.authors?.length) && (
          <div className="content-card__genres">
            {data.authors?.length ? (
              <span className="content-card__author">{data.authors.slice(0, 1).join(', ')}</span>
            ) : (
              data.genres?.slice(0, 2).map((genre, i) => (
                <span key={i} className="content-card__genre-tag">{genre}</span>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CONTENT CARD SKELETON
// ============================================

export function ContentCardSkeleton({ size = 'md' }: { size?: CardSize }) {
  return (
    <div className={`content-card content-card--skeleton ${size !== 'md' ? `size-${size}` : ''}`}>
      <div className="content-card__poster" />
      <div className="content-card__footer">
        <div className="content-card__title" />
        <div className="content-card__meta" />
      </div>
    </div>
  );
}

// ============================================
// CONTENT GRID COMPONENT
// ============================================

export interface ContentGridProps {
  children: React.ReactNode;
  size?: CardSize;
  className?: string;
}

export function ContentGrid({ children, size = 'md', className = '' }: ContentGridProps) {
  return (
    <div className={`content-grid ${size !== 'md' ? `size-${size}` : ''} ${className}`}>
      {children}
    </div>
  );
}

// ============================================
// HELPER: Convert API data to ContentCardData
// ============================================

import type { TmdbFilm, GoogleBook, IcerikListItem, KutuphaneDurumu } from '../../services/api';

// TMDB genre mapping
const TMDB_GENRES: Record<number, string> = {
  28: 'Aksiyon', 12: 'Macera', 16: 'Animasyon', 35: 'Komedi',
  80: 'Suç', 99: 'Belgesel', 18: 'Drama', 10751: 'Aile',
  14: 'Fantastik', 36: 'Tarih', 27: 'Korku', 10402: 'Müzik',
  9648: 'Gizem', 10749: 'Romantik', 878: 'Bilim Kurgu',
  10770: 'TV Film', 53: 'Gerilim', 10752: 'Savaş', 37: 'Western',
  10759: 'Aksiyon & Macera', 10762: 'Çocuk', 10763: 'Haber',
  10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Pembe Dizi',
  10767: 'Talk Show', 10768: 'War & Politics'
};

export function tmdbToCardData(film: TmdbFilm, dbId?: number): ContentCardData {
  const posterUrl = film.posterUrl || (film.posterPath
    ? `https://image.tmdb.org/t/p/w500${film.posterPath}`
    : undefined);
  
  const genres = film.turler?.slice(0, 2) ||
    film.turIds?.slice(0, 3).map(id => TMDB_GENRES[id]).filter(Boolean) ||
    [];

  // Tür belirleme: önce mediaType, sonra tur alanı
  let contentType: ContentType = 'film';
  if (film.mediaType === 'tv' || film.tur === 'Dizi' || film.tur === 'dizi' || film.tur === 'TV') {
    contentType = 'dizi';
  } else if (film.tur === 'Kitap' || film.tur === 'kitap') {
    contentType = 'kitap';
  }

  return {
    id: film.id,
    title: film.baslik || film.title || 'Bilinmiyor',
    posterUrl,
    type: contentType,
    year: (film.yayinTarihi || film.releaseDate)?.split('-')[0],
    genres,
    tmdbRating: film.puan || film.voteAverage,
    sagaRating: film.sagaOrtalamaPuan,
    dbId: dbId || film.sagaIcerikId,
    isExternal: !dbId && !film.sagaIcerikId,
  };
}

export function bookToCardData(book: GoogleBook, dbId?: number): ContentCardData {
  const posterUrl = (book.posterUrl || book.thumbnail)?.replace('http://', 'https://');
  const rating = book.averageRating ?? book.ortalamaPuan;

  return {
    id: book.id,
    title: book.baslik || book.title || 'Bilinmiyor',
    posterUrl,
    type: 'kitap',
    year: (book.yayinTarihi || book.publishedDate)?.split('-')[0],
    authors: book.yazarlar || book.authors,
    googleRating: rating ? rating * 2 : undefined, // 5'lik sistemden 10'luk sisteme
    dbId,
    isExternal: !dbId,
  };
}

export function icerikToCardData(icerik: IcerikListItem): ContentCardData {
  const normalizedType = normalizeContentType(icerik.tur);
  
  return {
    id: icerik.id,
    title: icerik.baslik,
    posterUrl: icerik.posterUrl,
    type: normalizedType,
    year: icerik.yayinTarihi?.split('-')[0],
    tmdbRating: icerik.hariciPuan,
    sagaRating: icerik.ortalamaPuan,
    dbId: icerik.id,
    isExternal: false,
    duration: icerik.sure,
    seasonCount: icerik.sezonSayisi,
    episodeCount: icerik.bolumSayisi,
    pageCount: icerik.sayfaSayisi,
    genres: icerik.turler,
    authors: icerik.yazar ? [icerik.yazar] : undefined,
  };
}

export function kutuphaneToCardData(item: KutuphaneDurumu): ContentCardData {
  const baslik = item.baslik || item.icerikAdi || 'Bilinmiyor';
  const posterUrl = item.posterUrl || item.icerik?.posterUrl;
  const tur = item.tur || item.icerikTur || item.icerik?.tur;
  const normalizedType = normalizeContentType(tur);

  return {
    id: item.icerikId,
    title: baslik,
    posterUrl,
    type: normalizedType,
    sagaRating: item.ortalamaPuan || item.icerik?.ortalamaPuan,
    dbId: item.icerikId,
    libraryStatus: (item.durum || item.durumStr) as LibraryStatus,
    isExternal: false,
  };
}

export default ContentCard;
