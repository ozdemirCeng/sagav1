/**
 * DetailPage için in-memory cache modülü
 * İçerik detaylarını cache'leyerek gereksiz API çağrılarını önler
 */

import type { Icerik, IcerikListItem, Yorum, Liste, Aktivite } from './api';

interface DetailCacheData {
  icerik: Icerik;
  yorumlar: Yorum[];
  listeler: Liste[];
  similarContent: IcerikListItem[];
  aktiviteler: Aktivite[];
  kullaniciListeleri: Liste[];
  icerikListeIds: number[];
  timestamp: number;
}

const CACHE_TTL = 3 * 60 * 1000; // 3 dakika
const cache = new Map<number, DetailCacheData>();

/**
 * Cache'den içerik detaylarını getir
 */
export function getDetailCache(icerikId: number): DetailCacheData | null {
  const cached = cache.get(icerikId);
  if (!cached) return null;

  // TTL kontrolü
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(icerikId);
    return null;
  }

  return cached;
}

/**
 * İçerik detaylarını cache'e kaydet
 */
export function setDetailCache(icerikId: number, data: Omit<DetailCacheData, 'timestamp'>): void {
  cache.set(icerikId, {
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * Belirli bir içeriğin cache'ini geçersiz kıl
 */
export function invalidateDetailCache(icerikId: number): void {
  cache.delete(icerikId);
}

/**
 * Tüm cache'i temizle
 */
export function clearDetailCache(): void {
  cache.clear();
}

/**
 * Cache'deki içeriği güncelle (partial update)
 */
export function updateDetailCache(icerikId: number, updates: Partial<Omit<DetailCacheData, 'timestamp'>>): void {
  const cached = cache.get(icerikId);
  if (cached) {
    cache.set(icerikId, {
      ...cached,
      ...updates,
      timestamp: cached.timestamp, // Timestamp'i koru
    });
  }
}

/**
 * Cache'deki yorumları güncelle
 */
export function updateCachedYorumlar(icerikId: number, yorumlar: Yorum[]): void {
  const cached = cache.get(icerikId);
  if (cached) {
    cache.set(icerikId, {
      ...cached,
      yorumlar,
    });
  }
}

/**
 * Cache'deki listeIds'i güncelle
 */
export function updateCachedListeIds(icerikId: number, icerikListeIds: number[]): void {
  const cached = cache.get(icerikId);
  if (cached) {
    cache.set(icerikId, {
      ...cached,
      icerikListeIds,
    });
  }
}

/**
 * Cache'deki puanı güncelle
 */
export function updateCachedPuan(icerikId: number, icerik: Icerik): void {
  const cached = cache.get(icerikId);
  if (cached) {
    cache.set(icerikId, {
      ...cached,
      icerik,
    });
  }
}
