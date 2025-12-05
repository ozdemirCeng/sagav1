// Profile sayfası için in-memory cache
// TTL: 5 dakika

interface CachedProfile {
  data: any;
  timestamp: number;
}

interface CachedFollowData {
  followers: any[];
  following: any[];
  timestamp: number;
}

interface CachedActivities {
  data: any[];
  timestamp: number;
}

interface CachedLibrary {
  data: any[];
  timestamp: number;
}

interface CachedLists {
  data: any[];
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 dakika
const FOLLOW_CACHE_TTL = 3 * 60 * 1000; // 3 dakika (daha sık değişebilir)

// Cache storage
const profileCache = new Map<string, CachedProfile>();
const followDataCache = new Map<string, CachedFollowData>();
const activitiesCache = new Map<string, CachedActivities>();
const libraryCache = new Map<string, CachedLibrary>();
const listsCache = new Map<string, CachedLists>();

// Helper: Cache geçerli mi?
const isCacheValid = (timestamp: number, ttl: number = CACHE_TTL): boolean => {
  return Date.now() - timestamp < ttl;
};

// Profile Cache
export const getProfileCache = (kullaniciAdi: string): any | null => {
  const cached = profileCache.get(kullaniciAdi);
  if (cached && isCacheValid(cached.timestamp)) {
    console.log(`📦 Profile cache hit: ${kullaniciAdi}`);
    return cached.data;
  }
  return null;
};

export const setProfileCache = (kullaniciAdi: string, data: any): void => {
  profileCache.set(kullaniciAdi, { data, timestamp: Date.now() });
};

export const invalidateProfileCache = (kullaniciAdi: string): void => {
  profileCache.delete(kullaniciAdi);
};

// Follow Data Cache (followers + following)
export const getFollowDataCache = (profilId: string): CachedFollowData | null => {
  const cached = followDataCache.get(profilId);
  if (cached && isCacheValid(cached.timestamp, FOLLOW_CACHE_TTL)) {
    console.log(`📦 Follow data cache hit: ${profilId}`);
    return cached;
  }
  return null;
};

export const setFollowDataCache = (profilId: string, followers: any[], following: any[]): void => {
  followDataCache.set(profilId, { followers, following, timestamp: Date.now() });
};

export const invalidateFollowDataCache = (profilId: string): void => {
  followDataCache.delete(profilId);
};

// Activities Cache
export const getActivitiesCache = (profilId: string): any[] | null => {
  const cached = activitiesCache.get(profilId);
  if (cached && isCacheValid(cached.timestamp)) {
    console.log(`📦 Activities cache hit: ${profilId}`);
    return cached.data;
  }
  return null;
};

export const setActivitiesCache = (profilId: string, data: any[]): void => {
  activitiesCache.set(profilId, { data, timestamp: Date.now() });
};

// Library Cache
export const getLibraryCache = (profilId: string): any[] | null => {
  const cached = libraryCache.get(profilId);
  if (cached && isCacheValid(cached.timestamp)) {
    console.log(`📦 Library cache hit: ${profilId}`);
    return cached.data;
  }
  return null;
};

export const setLibraryCache = (profilId: string, data: any[]): void => {
  libraryCache.set(profilId, { data, timestamp: Date.now() });
};

// Lists Cache
export const getListsCache = (profilId: string): any[] | null => {
  const cached = listsCache.get(profilId);
  if (cached && isCacheValid(cached.timestamp)) {
    console.log(`📦 Lists cache hit: ${profilId}`);
    return cached.data;
  }
  return null;
};

export const setListsCache = (profilId: string, data: any[]): void => {
  listsCache.set(profilId, { data, timestamp: Date.now() });
};

// My Following IDs Cache (kullanıcının takip ettikleri)
let _myFollowingCache: { ids: Set<string>; timestamp: number } | null = null;

export const getMyFollowingCache = (): Set<string> | null => {
  if (_myFollowingCache && isCacheValid(_myFollowingCache.timestamp, FOLLOW_CACHE_TTL)) {
    console.log(`📦 My following cache hit`);
    return _myFollowingCache.ids;
  }
  return null;
};

export const setMyFollowingCache = (ids: Set<string>): void => {
  _myFollowingCache = { ids, timestamp: Date.now() };
};

export const updateMyFollowingCache = (userId: string, isFollowing: boolean): void => {
  if (_myFollowingCache) {
    if (isFollowing) {
      _myFollowingCache.ids.add(userId);
    } else {
      _myFollowingCache.ids.delete(userId);
    }
    _myFollowingCache.timestamp = Date.now();
  }
};

export const invalidateMyFollowingCache = (): void => {
  _myFollowingCache = null;
};

// Tüm cache'i temizle
export const clearAllProfileCache = (): void => {
  profileCache.clear();
  followDataCache.clear();
  activitiesCache.clear();
  libraryCache.clear();
  listsCache.clear();
  _myFollowingCache = null;
  console.log('🗑️ All profile cache cleared');
};

// Belirli bir profil için tüm cache'i temizle
export const clearProfileAllData = (kullaniciAdi: string, profilId?: string): void => {
  profileCache.delete(kullaniciAdi);
  if (profilId) {
    followDataCache.delete(profilId);
    activitiesCache.delete(profilId);
    libraryCache.delete(profilId);
    listsCache.delete(profilId);
  }
  console.log(`🗑️ Profile cache cleared: ${kullaniciAdi}`);
};
