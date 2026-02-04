/**
 * ExplorePage için Global Cache Yönetimi
 * 
 * Bu modül, Keşfet sayfasındaki TMDB ve Kitap sonuçlarını
 * in-memory cache'te tutar. Kullanıcı detay sayfasına gidip
 * geri döndüğünde sonuçlar hızlıca yüklenir.
 */

import type { TmdbFilm, GoogleBook, PopulerListe, OnerilenKullanici } from './api';

// Cache süreleri (ms)
const CACHE_TTL = 10 * 60 * 1000; // 10 dakika
const SCROLL_CACHE_TTL = 5 * 60 * 1000; // 5 dakika

// Cache veri yapıları
interface TmdbCacheEntry {
  results: TmdbFilm[];
  page: number;
  hasMore: boolean;
  filter: 'all' | 'movie' | 'tv';
  sort: 'popular' | 'top_rated' | 'trending' | 'now_playing';
  timestamp: number;
}

interface BookCacheEntry {
  results: GoogleBook[];
  startIndex: number;
  queryIndex: number;
  hasMore: boolean;
  category: string;
  lang: string;
  source: string;
  onlyReadable: boolean;
  timestamp: number;
  seenIds: string[];
}

interface ExploreDataCache {
  populerListeler: PopulerListe[];
  onerilenKullanicilar: OnerilenKullanici[];
  timestamp: number;
}

interface ScrollCache {
  position: number;
  tab: 'tmdb' | 'kitaplar';
  timestamp: number;
}

// In-memory cache nesneleri
let tmdbCache: TmdbCacheEntry | null = null;
let bookCache: BookCacheEntry | null = null;
let exploreDataCache: ExploreDataCache | null = null;
let scrollCache: ScrollCache | null = null;

// ============================================
// TMDB CACHE
// ============================================

export function getTmdbCache(
  filter: 'all' | 'movie' | 'tv',
  sort: 'popular' | 'top_rated' | 'trending' | 'now_playing'
): TmdbCacheEntry | null {
  if (!tmdbCache) return null;
  
  // Aynı filtre ve sıralama mı?
  if (tmdbCache.filter !== filter || tmdbCache.sort !== sort) {
    return null;
  }
  
  // Cache süresi dolmuş mu?
  if (Date.now() - tmdbCache.timestamp > CACHE_TTL) {
    tmdbCache = null;
    return null;
  }
  
  return tmdbCache;
}

export function setTmdbCache(
  results: TmdbFilm[],
  page: number,
  hasMore: boolean,
  filter: 'all' | 'movie' | 'tv',
  sort: 'popular' | 'top_rated' | 'trending' | 'now_playing'
): void {
  tmdbCache = {
    results,
    page,
    hasMore,
    filter,
    sort,
    timestamp: Date.now(),
  };
}

export function appendTmdbCache(newResults: TmdbFilm[], page: number, hasMore: boolean): void {
  if (!tmdbCache) return;
  
  // Duplicate kontrolü
  const existingIds = new Set(tmdbCache.results.map(r => `${r.mediaType}-${r.id}`));
  const uniqueNewResults = newResults.filter(r => !existingIds.has(`${r.mediaType}-${r.id}`));
  
  tmdbCache = {
    ...tmdbCache,
    results: [...tmdbCache.results, ...uniqueNewResults],
    page,
    hasMore,
    timestamp: Date.now(),
  };
}

export function clearTmdbCache(): void {
  tmdbCache = null;
}

// ============================================
// BOOK CACHE
// ============================================

export function getBookCache(category: string, lang: string, source: string, onlyReadable: boolean): BookCacheEntry | null {
  if (!bookCache) return null;
  
  // Aynı kategori ve dil mi?
  if (bookCache.category !== category || bookCache.lang !== lang || bookCache.source !== source || bookCache.onlyReadable !== onlyReadable) {
    return null;
  }
  
  // Cache süresi dolmuş mu?
  if (Date.now() - bookCache.timestamp > CACHE_TTL) {
    bookCache = null;
    return null;
  }
  
  return bookCache;
}

export function setBookCache(
  results: GoogleBook[],
  startIndex: number,
  queryIndex: number,
  hasMore: boolean,
  category: string,
  lang: string,
  source: string,
  onlyReadable: boolean,
  seenIds: string[]
): void {
  bookCache = {
    results,
    startIndex,
    queryIndex,
    hasMore,
    category,
    lang,
    source,
    onlyReadable,
    timestamp: Date.now(),
    seenIds,
  };
}

export function appendBookCache(
  newResults: GoogleBook[],
  startIndex: number,
  queryIndex: number,
  hasMore: boolean,
  newSeenIds: string[]
): void {
  if (!bookCache) return;
  
  // Duplicate kontrolü
  const existingIds = new Set(bookCache.results.map(b => b.id));
  const uniqueNewResults = newResults.filter(b => !existingIds.has(b.id));
  
  bookCache = {
    ...bookCache,
    results: [...bookCache.results, ...uniqueNewResults],
    startIndex,
    queryIndex,
    hasMore,
    timestamp: Date.now(),
    seenIds: [...new Set([...bookCache.seenIds, ...newSeenIds])],
  };
}

export function clearBookCache(): void {
  bookCache = null;
}

// ============================================
// EXPLORE DATA CACHE (Popüler Listeler, Önerilen Kullanıcılar)
// ============================================

export function getExploreDataCache(): ExploreDataCache | null {
  if (!exploreDataCache) return null;
  
  // Cache süresi dolmuş mu?
  if (Date.now() - exploreDataCache.timestamp > CACHE_TTL) {
    exploreDataCache = null;
    return null;
  }
  
  return exploreDataCache;
}

export function setExploreDataCache(
  populerListeler: PopulerListe[],
  onerilenKullanicilar: OnerilenKullanici[]
): void {
  exploreDataCache = {
    populerListeler,
    onerilenKullanicilar,
    timestamp: Date.now(),
  };
}

// ============================================
// SCROLL POSITION CACHE
// ============================================

export function getScrollCache(tab: 'tmdb' | 'kitaplar'): number | null {
  if (!scrollCache) return null;
  
  // Aynı tab mı?
  if (scrollCache.tab !== tab) {
    return null;
  }
  
  // Cache süresi dolmuş mu?
  if (Date.now() - scrollCache.timestamp > SCROLL_CACHE_TTL) {
    scrollCache = null;
    return null;
  }
  
  return scrollCache.position;
}

export function setScrollCache(position: number, tab: 'tmdb' | 'kitaplar'): void {
  scrollCache = {
    position,
    tab,
    timestamp: Date.now(),
  };
}

export function clearScrollCache(): void {
  scrollCache = null;
}

// ============================================
// GENEL CACHE TEMİZLEME
// ============================================

export function clearAllExploreCache(): void {
  tmdbCache = null;
  bookCache = null;
  exploreDataCache = null;
  scrollCache = null;
}

// Debug için cache durumunu görüntüle
export function getExploreCacheStatus(): {
  tmdb: boolean;
  book: boolean;
  exploreData: boolean;
  scroll: boolean;
} {
  return {
    tmdb: tmdbCache !== null,
    book: bookCache !== null,
    exploreData: exploreDataCache !== null,
    scroll: scrollCache !== null,
  };
}
