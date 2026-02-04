// Library sayfası için in-memory cache
// TTL: 5 dakika

import type { KutuphaneDurumu, Liste } from './api';

interface CachedKutuphane {
  data: KutuphaneDurumu[];
  timestamp: number;
}

interface CachedListeler {
  data: Liste[];
  timestamp: number;
}

interface CachedTakipciSayisi {
  count: number;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

// Cache storage
const kutuphaneCache = new Map<string, CachedKutuphane>();
const listelerCache = new Map<string, CachedListeler>();
const takipciSayisiCache = new Map<string, CachedTakipciSayisi>();

// Helper: Cache geçerli mi?
const isCacheValid = (timestamp: number, ttl: number = CACHE_TTL): boolean => {
  return Date.now() - timestamp < ttl;
};

// Kütüphane Cache
export const getKutuphaneCache = (userId: string): KutuphaneDurumu[] | null => {
  const cached = kutuphaneCache.get(userId);
  if (cached && isCacheValid(cached.timestamp)) {
    if (import.meta.env.DEV) console.log(`📦 Kutuphane cache hit: ${userId}`);
    return cached.data;
  }
  return null;
};

export const setKutuphaneCache = (userId: string, data: KutuphaneDurumu[]): void => {
  kutuphaneCache.set(userId, { data, timestamp: Date.now() });
};

export const invalidateKutuphaneCache = (userId: string): void => {
  kutuphaneCache.delete(userId);
};

// Listeler Cache
export const getListelerCache = (userId: string): Liste[] | null => {
  const cached = listelerCache.get(userId);
  if (cached && isCacheValid(cached.timestamp)) {
    if (import.meta.env.DEV) console.log(`📦 Listeler cache hit: ${userId}`);
    return cached.data;
  }
  return null;
};

export const setListelerCache = (userId: string, data: Liste[]): void => {
  listelerCache.set(userId, { data, timestamp: Date.now() });
};

export const invalidateListelerCache = (userId: string): void => {
  listelerCache.delete(userId);
};

export const updateListelerCache = (userId: string, updater: (data: Liste[]) => Liste[]): void => {
  const cached = listelerCache.get(userId);
  if (cached) {
    listelerCache.set(userId, { 
      data: updater(cached.data), 
      timestamp: cached.timestamp 
    });
  }
};

// Takipçi Sayısı Cache
export const getTakipciSayisiCache = (userId: string): number | null => {
  const cached = takipciSayisiCache.get(userId);
  if (cached && isCacheValid(cached.timestamp)) {
    if (import.meta.env.DEV) console.log(`📦 Takipci sayisi cache hit: ${userId}`);
    return cached.count;
  }
  return null;
};

export const setTakipciSayisiCache = (userId: string, count: number): void => {
  takipciSayisiCache.set(userId, { count, timestamp: Date.now() });
};

// Tüm library cache'ini temizle
export const invalidateAllLibraryCache = (userId: string): void => {
  kutuphaneCache.delete(userId);
  listelerCache.delete(userId);
  takipciSayisiCache.delete(userId);
};

// Kütüphaneyi güncelle (item ekle/çıkar/güncelle)
export const updateKutuphaneItem = (
  userId: string, 
  icerikId: number, 
  updater: (item: KutuphaneDurumu | undefined) => KutuphaneDurumu | null
): void => {
  const cached = kutuphaneCache.get(userId);
  if (!cached) return;
  
  const existingIndex = cached.data.findIndex(i => i.icerikId === icerikId);
  const existingItem = existingIndex >= 0 ? cached.data[existingIndex] : undefined;
  const updatedItem = updater(existingItem);
  
  let newData: KutuphaneDurumu[];
  
  if (updatedItem === null) {
    // Item silindi
    newData = cached.data.filter(i => i.icerikId !== icerikId);
  } else if (existingIndex >= 0) {
    // Item güncellendi
    newData = [...cached.data];
    newData[existingIndex] = updatedItem;
  } else {
    // Yeni item eklendi
    newData = [updatedItem, ...cached.data];
  }
  
  kutuphaneCache.set(userId, { data: newData, timestamp: cached.timestamp });
};
