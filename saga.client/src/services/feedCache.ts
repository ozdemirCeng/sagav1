// Feed sayfası için in-memory cache
// TTL: 2 dakika (feed daha sık güncellenmeli)

import type { Aktivite } from './api';

interface CachedFeed {
  data: Aktivite[];
  toplamSayfa: number;
  timestamp: number;
}

const CACHE_TTL = 2 * 60 * 1000; // 2 dakika (feed daha dinamik)

// Cache storage - tab bazlı
const feedCache = new Map<string, CachedFeed>();

// Helper: Cache geçerli mi?
const isCacheValid = (timestamp: number, ttl: number = CACHE_TTL): boolean => {
  return Date.now() - timestamp < ttl;
};

// Feed Cache Key oluştur (tab + userId)
const getCacheKey = (tab: string, userId?: string): string => {
  return `${tab}_${userId || 'anon'}`;
};

// Feed Cache Get
export const getFeedCache = (tab: string, userId?: string): CachedFeed | null => {
  const key = getCacheKey(tab, userId);
  const cached = feedCache.get(key);
  if (cached && isCacheValid(cached.timestamp)) {
    if (import.meta.env.DEV) console.log(`📦 Feed cache hit: ${key}`);
    return cached;
  }
  return null;
};

// Feed Cache Set
export const setFeedCache = (tab: string, data: Aktivite[], toplamSayfa: number, userId?: string): void => {
  const key = getCacheKey(tab, userId);
  feedCache.set(key, { data, toplamSayfa, timestamp: Date.now() });
};

// Feed Cache Invalidate
export const invalidateFeedCache = (tab?: string, userId?: string): void => {
  if (tab) {
    const key = getCacheKey(tab, userId);
    feedCache.delete(key);
  } else {
    // Tüm feed cache'ini temizle
    feedCache.clear();
  }
};

// Aktivite ekle (cache güncelle)
export const addToFeedCache = (tab: string, aktivite: Aktivite, userId?: string): void => {
  const key = getCacheKey(tab, userId);
  const cached = feedCache.get(key);
  if (cached) {
    feedCache.set(key, {
      ...cached,
      data: [aktivite, ...cached.data],
      timestamp: cached.timestamp
    });
  }
};

// Aktivite sil (cache güncelle)
export const removeFromFeedCache = (aktiviteId: number): void => {
  feedCache.forEach((cached, key) => {
    const filtered = cached.data.filter(a => a.id !== aktiviteId);
    if (filtered.length !== cached.data.length) {
      feedCache.set(key, { ...cached, data: filtered });
    }
  });
};

// Aktivite güncelle (beğeni vb.)
export const updateFeedCacheItem = (aktiviteId: number, updater: (item: Aktivite) => Aktivite): void => {
  feedCache.forEach((cached, key) => {
    const updated = cached.data.map(a => a.id === aktiviteId ? updater(a) : a);
    feedCache.set(key, { ...cached, data: updated });
  });
};
