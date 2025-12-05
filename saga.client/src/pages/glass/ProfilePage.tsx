import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { kullaniciApi, aktiviteApi, kutuphaneApi, listeApi } from '../../services/api';
import type { ListeIcerik, Aktivite } from '../../services/api';
import { supabase } from '../../services/supabase';
import { ContentCard, ContentGrid } from '../../components/ui';
import type { ContentCardData, LibraryStatus } from '../../components/ui/ContentCard';
import { FeedActivityCard } from './FeedPage';
import {
  getProfileCache, setProfileCache, invalidateProfileCache,
  getFollowDataCache, setFollowDataCache,
  getActivitiesCache, setActivitiesCache,
  getLibraryCache, setLibraryCache,
  getListsCache, setListsCache,
  getMyFollowingCache, setMyFollowingCache, updateMyFollowingCache
} from '../../services/profileCache';
import './ProfilePage.css';
import './FeedPage.css'; // Activity card stilleri için

// Icons
const BookmarkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const FilmIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="17" x2="22" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" />
  </svg>
);

const TvIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
    <polyline points="17 2 12 7 7 2" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const StarIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const UserPlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

const UserCheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <polyline points="17 11 19 13 23 9" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const GridViewIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const ListViewIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const MapPinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// Tab Type
type ProfileTab = 'aktivite' | 'izlediklerim' | 'kutuphane' | 'listelerim';

// Types
interface KullaniciProfilDto {
  id: string;
  kullaniciAdi: string;
  goruntulemeAdi?: string;
  biyografi?: string;
  avatarUrl?: string;
  konum?: string;
  websitesi?: string;
  olusturulmaZamani?: string;
  takipEdenSayisi?: number;
  takipEdilenSayisi?: number;
  onayliMi?: boolean;
  takipEdiyorMu?: boolean;
  // Alias'lar - eski kod uyumluluğu için
  ad?: string;
  bio?: string;
  kayitTarihi?: string;
  takipciSayisi?: number;
}

interface KutuphaneItemDto {
  id?: number;
  icerikId: number;
  baslik?: string;
  posterUrl?: string;
  icerikTipiStr?: string;
  tur?: string;
  durum: string;
  ilerleme?: number;
}

interface ListeDto {
  id: number;
  ad: string;
  aciklama?: string;
  icerikSayisi?: number;
  icerikler?: ListeIcerik[];
}

interface TakipKullaniciDto {
  id: string;
  kullaniciAdi: string;
  goruntulemeAdi?: string;
  avatarUrl?: string;
  takipEdenSayisi?: number;
  takipEdiyorMu?: boolean;
}

const ProfilePage: React.FC = () => {
  const { kullaniciAdi } = useParams<{ kullaniciAdi: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [profil, setProfil] = useState<KullaniciProfilDto | null>(null);
  const [aktiviteler, setAktiviteler] = useState<Aktivite[]>([]);
  const [kutuphane, setKutuphane] = useState<KutuphaneItemDto[]>([]);
  const [listeler, setListeler] = useState<ListeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('aktivite');
  const [followLoading, setFollowLoading] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    ad: '',
    bio: '',
    konum: '',
    websitesi: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Create List Modal State
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [listForm, setListForm] = useState({
    ad: '',
    aciklama: '',
  });
  const [createListLoading, setCreateListLoading] = useState(false);

  // Edit List Modal State
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [editingList, setEditingList] = useState<ListeDto | null>(null);
  const [editListForm, setEditListForm] = useState({
    ad: '',
    aciklama: '',
  });
  const [editListLoading, setEditListLoading] = useState(false);

  // Selected List View State
  const [selectedList, setSelectedList] = useState<ListeDto | null>(null);
  const [selectedListContents, setSelectedListContents] = useState<ListeIcerik[]>([]);
  const [selectedListLoading, setSelectedListLoading] = useState(false);
  const [listViewMode, setListViewMode] = useState<'list' | 'grid'>('list');

  // Takipçi/Takip Edilen Modal State
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followers, setFollowers] = useState<TakipKullaniciDto[]>([]);
  const [following, setFollowing] = useState<TakipKullaniciDto[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  
  // Modal içi takip durumu - kullanıcının takip ettiği kişilerin ID'leri
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(() => {
    // Cache'den başlangıç değeri al
    return getMyFollowingCache() || new Set();
  });
  const [modalFollowLoading, setModalFollowLoading] = useState<string | null>(null);
  
  // Çift yükleme önleme
  const isDataLoadedRef = useRef(false);
  const currentProfilIdRef = useRef<string | null>(null);

  const isOwnProfile = user?.kullaniciAdi === kullaniciAdi;

  // Fetch Profile Data (cache destekli)
  const fetchProfil = useCallback(async (forceRefresh = false) => {
    if (!kullaniciAdi) return;

    // Cache kontrol
    if (!forceRefresh) {
      const cachedProfile = getProfileCache(kullaniciAdi);
      if (cachedProfile) {
        setProfil({
          ...cachedProfile,
          ad: cachedProfile.goruntulemeAdi,
          bio: cachedProfile.biyografi,
          kayitTarihi: cachedProfile.olusturulmaZamani,
          takipciSayisi: cachedProfile.takipEdenSayisi,
        });
        setEditForm({
          ad: cachedProfile.goruntulemeAdi || '',
          bio: cachedProfile.biyografi || '',
          konum: '',
          websitesi: '',
        });
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      const response = await kullaniciApi.getProfil(kullaniciAdi);
      
      // Cache'e kaydet
      setProfileCache(kullaniciAdi, response);
      
      // Backend property adlarını frontend'e map et
      setProfil({
        ...response,
        ad: response.goruntulemeAdi,
        bio: response.biyografi,
        kayitTarihi: response.olusturulmaZamani,
        takipciSayisi: response.takipEdenSayisi,
      });

      // Initialize edit form
      setEditForm({
        ad: response.goruntulemeAdi || '',
        bio: response.biyografi || '',
        konum: '',
        websitesi: '',
      });
    } catch (error) {
      console.error('Profil yüklenirken hata:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [kullaniciAdi, navigate]);

  // Aktiviteler (cache destekli)
  const fetchAktiviteler = useCallback(async (profilId: string, forceRefresh = false) => {
    if (!profilId) return;
    
    if (!forceRefresh) {
      const cached = getActivitiesCache(profilId);
      if (cached) {
        setAktiviteler(cached);
        return;
      }
    }
    
    try {
      const response = await aktiviteApi.getKullaniciAktiviteleri(profilId, { sayfaBoyutu: 20 });
      const data = response.data || [];
      setActivitiesCache(profilId, data);
      setAktiviteler(data);
    } catch (error) {
      console.error('Aktiviteler yüklenirken hata:', error);
    }
  }, []);

  // Kütüphane (cache destekli)
  const fetchKutuphane = useCallback(async (profilId: string, forceRefresh = false) => {
    if (!profilId) return;
    
    if (!forceRefresh) {
      const cached = getLibraryCache(profilId);
      if (cached) {
        setKutuphane(cached);
        return;
      }
    }
    
    try {
      const response = await kutuphaneApi.getKullanicininKutuphanesi(profilId, { sayfaBoyutu: 50 });
      const data = response.data || [];
      setLibraryCache(profilId, data);
      setKutuphane(data);
    } catch (error) {
      console.error('Kütüphane yüklenirken hata:', error);
    }
  }, []);

  // Listeler (cache destekli)
  const fetchListeler = useCallback(async (profilId: string, forceRefresh = false) => {
    if (!profilId) return;
    
    if (!forceRefresh) {
      const cached = getListsCache(profilId);
      if (cached) {
        setListeler(cached);
        return;
      }
    }
    
    try {
      const response = await listeApi.getKullaniciListeleri(profilId);
      const data = response || [];
      setListsCache(profilId, data);
      setListeler(data);
    } catch (error) {
      console.error('Listeler yüklenirken hata:', error);
    }
  }, []);

  // İlk yükleme - sadece bir kez çalışacak
  useEffect(() => {
    // Sayfa yüklendiğinde en üste scroll et
    window.scrollTo(0, 0);
    
    // Profil değişti mi kontrol et
    if (kullaniciAdi && kullaniciAdi !== currentProfilIdRef.current) {
      currentProfilIdRef.current = kullaniciAdi;
      isDataLoadedRef.current = false;
    }
    
    if (!isDataLoadedRef.current) {
      isDataLoadedRef.current = true;
      fetchProfil();
    }
  }, [kullaniciAdi, fetchProfil]);

  // Profil verisi yüklendiğinde diğer verileri yükle (cache destekli)
  useEffect(() => {
    if (!profil?.id) return;
    
    // Paralel olarak yükle
    fetchAktiviteler(profil.id);
    fetchKutuphane(profil.id);
    fetchListeler(profil.id);
    
    // Takipçi/Takip edilen verilerini önceden yükle (modal için) - cache kontrollü
    const prefetchFollowData = async () => {
      // Cache kontrol
      const cachedFollowData = getFollowDataCache(profil.id);
      const cachedMyFollowing = getMyFollowingCache();
      
      if (cachedFollowData && cachedMyFollowing) {
        setFollowers(cachedFollowData.followers);
        setFollowing(cachedFollowData.following);
        setMyFollowingIds(cachedMyFollowing);
        return;
      }
      
      try {
        const [takipciler, takipEdilenler, benimTakipEttiklerim] = await Promise.all([
          cachedFollowData ? Promise.resolve(cachedFollowData.followers) : kullaniciApi.getTakipciler(profil.id).catch(() => []),
          cachedFollowData ? Promise.resolve(cachedFollowData.following) : kullaniciApi.getTakipEdilenler(profil.id).catch(() => []),
          cachedMyFollowing ? Promise.resolve([]) : (user?.id ? kullaniciApi.getTakipEdilenler(user.id).catch(() => []) : Promise.resolve([]))
        ]);
        
        if (!cachedFollowData) {
          setFollowDataCache(profil.id, takipciler, takipEdilenler);
        }
        
        setFollowers(takipciler);
        setFollowing(takipEdilenler);
        
        if (!cachedMyFollowing && benimTakipEttiklerim.length > 0) {
          const ids = new Set(benimTakipEttiklerim.map(k => k.id));
          setMyFollowingCache(ids);
          setMyFollowingIds(ids);
        }
      } catch (error) {
        console.error('Takip verileri yüklenirken hata:', error);
      }
    };
    
    prefetchFollowData();
  }, [profil?.id, fetchAktiviteler, fetchKutuphane, fetchListeler, user?.id]);

  // Follow/Unfollow
  const handleToggleFollow = async () => {
    if (!profil || !user) return;

    try {
      setFollowLoading(true);
      await kullaniciApi.takipEt(profil.id);
      // Cache'i invalidate et ve yeniden yükle
      invalidateProfileCache(kullaniciAdi!);
      await fetchProfil(true);
    } catch (error) {
      console.error('Takip işlemi hatası:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  // Takipçileri modalı aç (veriler zaten yüklü)
  const handleOpenFollowers = async () => {
    if (!profil) return;
    setShowFollowersModal(true);
    
    // Veriler yoksa yükle (ilk açılış veya refresh)
    if (followers.length === 0 && profil.takipciSayisi && profil.takipciSayisi > 0) {
      setFollowersLoading(true);
      try {
        const [takipciler, benimTakipEttiklerim] = await Promise.all([
          kullaniciApi.getTakipciler(profil.id),
          user?.id && myFollowingIds.size === 0 
            ? kullaniciApi.getTakipEdilenler(user.id).catch(() => []) 
            : Promise.resolve([])
        ]);
        setFollowers(takipciler);
        if (benimTakipEttiklerim.length > 0) {
          setMyFollowingIds(new Set(benimTakipEttiklerim.map(k => k.id)));
        }
      } catch (error) {
        console.error('Takipçiler yüklenirken hata:', error);
      } finally {
        setFollowersLoading(false);
      }
    }
  };

  // Takip edilenler modalı aç (veriler zaten yüklü)
  const handleOpenFollowing = async () => {
    if (!profil) return;
    setShowFollowingModal(true);
    
    // Veriler yoksa yükle (ilk açılış veya refresh)
    if (following.length === 0 && profil.takipEdilenSayisi && profil.takipEdilenSayisi > 0) {
      setFollowingLoading(true);
      try {
        const [takipEdilenler, benimTakipEttiklerim] = await Promise.all([
          kullaniciApi.getTakipEdilenler(profil.id),
          user?.id && myFollowingIds.size === 0 
            ? kullaniciApi.getTakipEdilenler(user.id).catch(() => []) 
            : Promise.resolve([])
        ]);
        setFollowing(takipEdilenler);
        if (benimTakipEttiklerim.length > 0) {
          setMyFollowingIds(new Set(benimTakipEttiklerim.map(k => k.id)));
        }
      } catch (error) {
        console.error('Takip edilenler yüklenirken hata:', error);
      } finally {
        setFollowingLoading(false);
      }
    }
  };

  // Modal içinden takip et/bırak
  const handleFollowFromModal = async (userId: string) => {
    if (modalFollowLoading) return;
    
    const isCurrentlyFollowing = myFollowingIds.has(userId);
    setModalFollowLoading(userId);
    
    try {
      await kullaniciApi.takipEt(userId); // toggle endpoint
      
      // Local state güncelle
      setMyFollowingIds(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyFollowing) {
          newSet.delete(userId);
        } else {
          newSet.add(userId);
        }
        // Cache'i de güncelle
        updateMyFollowingCache(userId, !isCurrentlyFollowing);
        return newSet;
      });
      
      // Eğer kendi profilimizin takip ettikleri listesindeyse ve takipten çıktıysak
      if (isCurrentlyFollowing && isOwnProfile && showFollowingModal) {
        setFollowing(prev => prev.filter(u => u.id !== userId));
        // Profil takip sayısını güncelle (modal kapatmadan)
        setProfil(prev => prev ? { ...prev, takipEdilenSayisi: (prev.takipEdilenSayisi || 1) - 1 } : prev);
      } else if (isOwnProfile) {
        // Kendi profilimizde sayıyı güncelle
        setProfil(prev => prev ? { 
          ...prev, 
          takipEdilenSayisi: isCurrentlyFollowing 
            ? (prev.takipEdilenSayisi || 1) - 1 
            : (prev.takipEdilenSayisi || 0) + 1 
        } : prev);
      }
    } catch (error) {
      console.error('Takip işlemi hatası:', error);
    } finally {
      setModalFollowLoading(null);
    }
  };

  // Takipçiyi çıkar (kendi takipçilerinden)
  const handleRemoveFollower = async (userId: string) => {
    try {
      await kullaniciApi.takipciCikar(userId);
      // Listeden kaldır
      setFollowers(prev => prev.filter(u => u.id !== userId));
      // Takipçi sayısını güncelle
      setProfil(prev => prev ? { ...prev, takipciSayisi: (prev.takipciSayisi || 1) - 1 } : prev);
    } catch (error) {
      console.error('Takipçi çıkarma hatası:', error);
    }
  };

  // Edit Profile
  const handleUpdateProfile = async () => {
    try {
      setEditLoading(true);
      await kullaniciApi.updateProfil({
        goruntulemeAdi: editForm.ad || undefined,
        biyografi: editForm.bio, // Boş string de gönderilmeli (biyografi silme için)
      });
      await fetchProfil();
      setShowEditModal(false);
    } catch (error) {
      console.error('Profil güncelleme hatası:', error);
    } finally {
      setEditLoading(false);
    }
  };

  // Avatar Upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setAvatarUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await kullaniciApi.updateProfil({ avatarUrl: urlData.publicUrl });
      await fetchProfil();
    } catch (error) {
      console.error('Avatar yükleme hatası:', error);
    } finally {
      setAvatarUploading(false);
    }
  };

  // Create List
  const handleCreateList = async () => {
    if (!listForm.ad.trim()) return;

    try {
      setCreateListLoading(true);
      await listeApi.create({
        ad: listForm.ad,
        aciklama: listForm.aciklama || undefined,
        herkeseAcik: true,
      });
      if (profil?.id) await fetchListeler(profil.id, true);
      setShowCreateListModal(false);
      setListForm({ ad: '', aciklama: '' });
    } catch (error) {
      console.error('Liste oluşturma hatası:', error);
    } finally {
      setCreateListLoading(false);
    }
  };

  // Edit List - Open Modal
  const handleOpenEditListModal = (liste: ListeDto, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingList(liste);
    setEditListForm({
      ad: liste.ad,
      aciklama: liste.aciklama || '',
    });
    setShowEditListModal(true);
  };

  // Edit List - Save
  const handleUpdateList = async () => {
    if (!editingList || !editListForm.ad.trim()) return;

    try {
      setEditListLoading(true);
      await listeApi.update(editingList.id, {
        ad: editListForm.ad,
        aciklama: editListForm.aciklama || undefined,
      });
      if (profil?.id) await fetchListeler(profil.id, true);
      
      // Eğer selectedList güncellenen liste ise, onu da güncelle
      if (selectedList?.id === editingList.id) {
        setSelectedList(prev => prev ? { ...prev, ad: editListForm.ad, aciklama: editListForm.aciklama } : null);
      }
      
      setShowEditListModal(false);
      setEditingList(null);
      setEditListForm({ ad: '', aciklama: '' });
    } catch (error) {
      console.error('Liste güncelleme hatası:', error);
    } finally {
      setEditListLoading(false);
    }
  };

  // Open List View
  const handleOpenList = async (liste: ListeDto) => {
    setSelectedList(liste);
    setSelectedListLoading(true);
    
    try {
      const response = await listeApi.getById(liste.id);
      const contents = response.icerikler || [];
      setSelectedListContents(contents);
      
      // Sync icerikSayisi with actual content count
      if (contents.length !== liste.icerikSayisi) {
        setListeler(prev => prev.map(l => 
          l.id === liste.id ? { ...l, icerikSayisi: contents.length } : l
        ));
        setSelectedList(prev => prev ? { ...prev, icerikSayisi: contents.length } : null);
      }
    } catch (error) {
      console.error('Liste içerikleri yüklenirken hata:', error);
      setSelectedListContents([]);
    } finally {
      setSelectedListLoading(false);
    }
  };

  // Close List View
  const handleCloseListView = () => {
    // Update listeler with correct count before closing
    if (selectedList) {
      const actualCount = selectedListContents.length;
      setListeler(prev => prev.map(l => 
        l.id === selectedList.id ? { ...l, icerikSayisi: actualCount } : l
      ));
      
      // Update cache as well
      if (profil?.id) {
        const updatedListeler = listeler.map(l => 
          l.id === selectedList.id ? { ...l, icerikSayisi: actualCount } : l
        );
        setListsCache(profil.id, updatedListeler);
      }
    }
    
    setSelectedList(null);
    setSelectedListContents([]);
  };

  // Remove Content from List
  const handleRemoveFromList = async (icerikId: number) => {
    if (!selectedList) return;
    
    try {
      await listeApi.removeIcerik(selectedList.id, icerikId);
      setSelectedListContents(prev => prev.filter(i => i.icerikId !== icerikId));
      
      // Update list count in both listeler and selectedList
      const newCount = (selectedList.icerikSayisi || 1) - 1;
      setListeler(prev => prev.map(l => 
        l.id === selectedList.id 
          ? { ...l, icerikSayisi: newCount }
          : l
      ));
      setSelectedList(prev => prev ? { ...prev, icerikSayisi: newCount } : null);
    } catch (error) {
      console.error('İçerik listeden çıkarılırken hata:', error);
    }
  };

  // Move Content Up in List
  const handleMoveUp = async (index: number) => {
    if (!selectedList || index === 0) return;
    
    const newContents = [...selectedListContents];
    const item = newContents[index];
    const prevItem = newContents[index - 1];
    
    // Swap positions
    newContents[index] = prevItem;
    newContents[index - 1] = item;
    
    setSelectedListContents(newContents);
    
    // Update on server
    try {
      await listeApi.updateIcerik(selectedList.id, item.icerikId, { sira: index });
      await listeApi.updateIcerik(selectedList.id, prevItem.icerikId, { sira: index + 1 });
    } catch (error) {
      console.error('Sıralama güncellenirken hata:', error);
      // Revert on error
      setSelectedListContents(selectedListContents);
    }
  };

  // Move Content Down in List
  const handleMoveDown = async (index: number) => {
    if (!selectedList || index === selectedListContents.length - 1) return;
    
    const newContents = [...selectedListContents];
    const item = newContents[index];
    const nextItem = newContents[index + 1];
    
    // Swap positions
    newContents[index] = nextItem;
    newContents[index + 1] = item;
    
    setSelectedListContents(newContents);
    
    // Update on server
    try {
      await listeApi.updateIcerik(selectedList.id, item.icerikId, { sira: index + 2 });
      await listeApi.updateIcerik(selectedList.id, nextItem.icerikId, { sira: index + 1 });
    } catch (error) {
      console.error('Sıralama güncellenirken hata:', error);
      // Revert on error
      setSelectedListContents(selectedListContents);
    }
  };

  // Stats calculations - tur alanı backend'den geliyor (Film, Dizi, Kitap)
  const filmCount = kutuphane.filter((item) => {
    const tur = (item.tur || item.icerikTipiStr || '').toLowerCase();
    return tur === 'film';
  }).length;
  
  const diziCount = kutuphane.filter((item) => {
    const tur = (item.tur || item.icerikTipiStr || '').toLowerCase();
    return tur === 'dizi' || tur === 'tv';
  }).length;
  
  const kitapCount = kutuphane.filter((item) => {
    const tur = (item.tur || item.icerikTipiStr || '').toLowerCase();
    return tur === 'kitap';
  }).length;

  // Filter library by status
  const izlediklerim = kutuphane.filter((item) => 
    item.durum === 'Tamamlandı' || item.durum === 'izlendi' || item.durum === 'okundu'
  );

  // Filtrelenmiş aktiviteler (takip ve içerik bilgisi olmayan aktiviteler hariç)
  const filteredAktiviteler = useMemo(() => {
    return aktiviteler.filter((akt) => {
      const tur = (akt.aktiviteTuru || akt.aktiviteTipiStr || '').toLowerCase();
      if (tur === 'takip' || tur === 'takipetme') return false;
      if (!akt.veri?.baslik) return false;
      return true;
    });
  }, [aktiviteler]);

  // Dynamic achievements based on user stats
  const achievements = useMemo(() => {
    const totalContent = kutuphane.length;
    const totalAktivite = filteredAktiviteler.length;
    
    return [
      { 
        icon: '🎬', 
        name: 'Film Tutkunu', 
        desc: `${filmCount} film`,
        tier: filmCount >= 100 ? 'gold' : filmCount >= 50 ? 'silver' : filmCount >= 10 ? 'bronze' : 'locked'
      },
      { 
        icon: '📺', 
        name: 'Dizi Kolik', 
        desc: `${diziCount} dizi`,
        tier: diziCount >= 50 ? 'gold' : diziCount >= 25 ? 'silver' : diziCount >= 5 ? 'bronze' : 'locked'
      },
      { 
        icon: '📖', 
        name: 'Kitap Kurdu', 
        desc: `${kitapCount} kitap`,
        tier: kitapCount >= 50 ? 'gold' : kitapCount >= 25 ? 'silver' : kitapCount >= 5 ? 'bronze' : 'locked'
      },
      { 
        icon: '🏆', 
        name: 'Koleksiyoner', 
        desc: `${totalContent} içerik`,
        tier: totalContent >= 200 ? 'gold' : totalContent >= 100 ? 'silver' : totalContent >= 25 ? 'bronze' : 'locked'
      },
      { 
        icon: '⭐', 
        name: 'Eleştirmen', 
        desc: `${totalAktivite} aktivite`,
        tier: totalAktivite >= 100 ? 'gold' : totalAktivite >= 50 ? 'silver' : totalAktivite >= 10 ? 'bronze' : 'locked'
      },
      { 
        icon: '🔥', 
        name: 'İlk Adım', 
        desc: 'Üye oldu',
        tier: profil ? 'gold' : 'locked'
      },
    ];
  }, [filmCount, diziCount, kitapCount, kutuphane.length, filteredAktiviteler.length, profil]);

  // Dynamic genre distribution (placeholder - would need genre data from API)
  const genres = useMemo(() => {
    // Şimdilik kütüphane içerik tipine göre dağılım gösterelim
    const total = kutuphane.length || 1;
    const filmPercent = Math.round((filmCount / total) * 100);
    const diziPercent = Math.round((diziCount / total) * 100);
    const kitapPercent = Math.round((kitapCount / total) * 100);
    
    return [
      { name: 'Film', percent: filmPercent, class: 'film' },
      { name: 'Dizi', percent: diziPercent, class: 'dizi' },
      { name: 'Kitap', percent: kitapPercent, class: 'kitap' },
    ].filter(g => g.percent > 0).sort((a, b) => b.percent - a.percent);
  }, [filmCount, diziCount, kitapCount, kutuphane.length]);

  if (authLoading || loading) {
    return (
      <div className="profile-page">
        <div className="profile-hero">
          <div className="profile-cover skeleton" />
          <div className="profile-info">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar skeleton" />
            </div>
            <div style={{ height: 28, width: 150 }} className="skeleton" />
            <div style={{ height: 18, width: 100, marginTop: 8 }} className="skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (!profil) {
    return (
      <div className="profile-page">
        <div className="empty-state">
          <div className="empty-state-icon">
            <UserIcon />
          </div>
          <h3>Kullanıcı bulunamadı</h3>
          <p>Aradığınız kullanıcı mevcut değil veya silinmiş olabilir.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Hero Section */}
      <section className="profile-hero">
        <div className="profile-cover" />

        <div className="profile-info">
          {/* Avatar */}
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar">
              {profil.avatarUrl ? (
                <img src={profil.avatarUrl} alt={profil.ad || profil.kullaniciAdi} />
              ) : (
                <span className="profile-avatar-letter">
                  {(profil.ad || profil.kullaniciAdi).charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {profil.onayliMi && (
              <div className="profile-badge">
                <VerifiedIcon />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="profile-details">
            <h1 className="profile-name">{profil.ad || profil.kullaniciAdi}</h1>
            <p className="profile-username">@{profil.kullaniciAdi}</p>

            {profil.bio && <p className="profile-bio">{profil.bio}</p>}

            <div className="profile-meta">
              {profil.konum && (
                <span className="profile-meta-item">
                  <MapPinIcon />
                  {profil.konum}
                </span>
              )}
              {profil.kayitTarihi && (
                <span className="profile-meta-item">
                  <CalendarIcon />
                  {new Date(profil.kayitTarihi).toLocaleDateString('tr-TR', {
                    month: 'long',
                    year: 'numeric',
                  })}{' '}
                  tarihinden beri
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="profile-stats">
            <div className="profile-stat clickable" onClick={handleOpenFollowers}>
              <div className="stat-value">{profil.takipciSayisi || 0}</div>
              <div className="stat-label">Takipçi</div>
            </div>
            <div className="profile-stat clickable" onClick={handleOpenFollowing}>
              <div className="stat-value">{profil.takipEdilenSayisi || 0}</div>
              <div className="stat-label">Takip</div>
            </div>
            <div className="profile-stat">
              <div className="stat-value">{kutuphane.length}</div>
              <div className="stat-label">İçerik</div>
            </div>
            <div className="profile-stat">
              <div className="stat-value">{listeler.length}</div>
              <div className="stat-label">Liste</div>
            </div>
          </div>

          {/* Actions */}
          <div className="profile-actions">
            {isOwnProfile ? (
              <button
                className="profile-btn profile-btn-primary"
                onClick={() => setShowEditModal(true)}
              >
                <EditIcon />
                Profili Düzenle
              </button>
            ) : (
              <button
                className="profile-btn profile-btn-primary"
                onClick={handleToggleFollow}
                disabled={followLoading}
              >
                {followLoading ? (
                  <span className="spinner" />
                ) : profil.takipEdiyorMu ? (
                  <>
                    <UserCheckIcon />
                    Takip Ediliyor
                  </>
                ) : (
                  <>
                    <UserPlusIcon />
                    Takip Et
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="profile-main-content">
        {/* Watch Stats */}
        <section className="watch-stats">
          <div className="watch-stat-card">
            <div className="watch-stat-icon films">
              <FilmIcon />
            </div>
            <div className="watch-stat-value">{filmCount}</div>
            <div className="watch-stat-label">Film</div>
          </div>
          <div className="watch-stat-card">
            <div className="watch-stat-icon series">
              <TvIcon />
            </div>
            <div className="watch-stat-value">{diziCount}</div>
            <div className="watch-stat-label">Dizi</div>
          </div>
          <div className="watch-stat-card">
            <div className="watch-stat-icon books">
              <BookIcon />
            </div>
            <div className="watch-stat-value">{kitapCount}</div>
            <div className="watch-stat-label">Kitap</div>
          </div>
        </section>

        {/* Achievements */}
        <section className="profile-section">
          <div className="section-header">
            <h2 className="section-title">Rozetler</h2>
            <button className="section-link">
              Tümü <ChevronRightIcon />
            </button>
          </div>
          <div className="achievements-grid">
            {achievements.map((ach, idx) => (
              <div key={idx} className="achievement-card">
                <div className={`achievement-icon ${ach.tier}`}>{ach.icon}</div>
                <div className="achievement-name">{ach.name}</div>
                <div className="achievement-desc">{ach.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Genre Chart */}
        <section className="profile-section">
          <div className="section-header">
            <h2 className="section-title">Tür Dağılımı</h2>
          </div>
          <div className="genre-chart">
            <div className="genre-bars">
              {genres.map((genre, idx) => (
                <div key={idx} className="genre-bar-item">
                  <span className="genre-bar-label">{genre.name}</span>
                  <div className="genre-bar-wrapper">
                    <div
                      className={`genre-bar-fill ${genre.class}`}
                      style={{ width: `${genre.percent}%` }}
                    />
                  </div>
                  <span className="genre-bar-value">{genre.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="profile-tabs">
          <button
            className={`profile-tab ${activeTab === 'aktivite' ? 'active' : ''}`}
            onClick={() => setActiveTab('aktivite')}
          >
            <ClockIcon />
            Aktivite
            <span className="tab-count">{filteredAktiviteler.length}</span>
          </button>
          <button
            className={`profile-tab ${activeTab === 'izlediklerim' ? 'active' : ''}`}
            onClick={() => setActiveTab('izlediklerim')}
          >
            <StarIcon filled />
            İzlediklerim
            <span className="tab-count">{izlediklerim.length}</span>
          </button>
          <button
            className={`profile-tab ${activeTab === 'kutuphane' ? 'active' : ''}`}
            onClick={() => setActiveTab('kutuphane')}
          >
            <BookmarkIcon />
            Kütüphane
            <span className="tab-count">{kutuphane.length}</span>
          </button>
          <button
            className={`profile-tab ${activeTab === 'listelerim' ? 'active' : ''}`}
            onClick={() => setActiveTab('listelerim')}
          >
            <ListIcon />
            Listelerim
            <span className="tab-count">{listeler.length}</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'aktivite' && (
          <section className="profile-section feed-page">
            {filteredAktiviteler.length > 0 ? (
              <div className="profile-activity-feed activity-feed">
                {filteredAktiviteler.map((akt, index) => (
                  <FeedActivityCard
                    key={akt.id}
                    aktivite={akt}
                    isLoggedIn={!!user}
                    index={index}
                    currentUserName={user?.kullaniciAdi}
                    onDelete={(id) => setAktiviteler(prev => prev.filter(a => a.id !== id))}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <ClockIcon />
                </div>
                <h3>Henüz aktivite yok</h3>
                <p>Film ve dizileri izlemeye başlayın!</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'izlediklerim' && (
          <section className="profile-section">
            {izlediklerim.length > 0 ? (
              <ContentGrid>
                {izlediklerim.map((item) => {
                  const itemTur = (item.tur || item.icerikTipiStr || 'film').toLowerCase();
                  const cardData: ContentCardData = {
                    id: item.icerikId,
                    title: item.baslik || 'Bilinmiyor',
                    posterUrl: item.posterUrl?.startsWith('http') 
                      ? item.posterUrl 
                      : item.posterUrl 
                        ? `https://image.tmdb.org/t/p/w342${item.posterUrl}`
                        : undefined,
                    type: (itemTur === 'dizi' ? 'tv' : itemTur) as 'film' | 'kitap' | 'tv',
                    dbId: item.icerikId,
                    libraryStatus: item.durum as LibraryStatus,
                  };
                  return (
                    <ContentCard
                      key={item.id}
                      data={cardData}
                      showStatus={true}
                      showBadge={true}
                      showRatings={true}
                    />
                  );
                })}
              </ContentGrid>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <StarIcon filled />
                </div>
                <h3>Henüz içerik izlenmemiş</h3>
                <p>İzlediğiniz içerikleri işaretleyin!</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'kutuphane' && (
          <section className="profile-section">
            {kutuphane.length > 0 ? (
              <ContentGrid>
                {kutuphane.map((item) => {
                  const itemTur = (item.tur || item.icerikTipiStr || 'film').toLowerCase();
                  const cardData: ContentCardData = {
                    id: item.icerikId,
                    title: item.baslik || 'Bilinmiyor',
                    posterUrl: item.posterUrl?.startsWith('http') 
                      ? item.posterUrl 
                      : item.posterUrl 
                        ? `https://image.tmdb.org/t/p/w342${item.posterUrl}`
                        : undefined,
                    type: (itemTur === 'dizi' ? 'tv' : itemTur) as 'film' | 'kitap' | 'tv',
                    dbId: item.icerikId,
                    libraryStatus: item.durum as LibraryStatus,
                  };
                  return (
                    <ContentCard
                      key={item.id}
                      data={cardData}
                      showStatus={true}
                      showBadge={true}
                      showRatings={true}
                    />
                  );
                })}
              </ContentGrid>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <BookmarkIcon />
                </div>
                <h3>Kütüphane boş</h3>
                <p>İçerikleri kütüphanenize ekleyin!</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'listelerim' && (
          <section className="profile-section">
            {/* Selected List Full View */}
            {selectedList ? (
              <div className="selected-list-view">
                <div className="selected-list-header">
                  <button 
                    className="back-to-lists-btn"
                    onClick={handleCloseListView}
                  >
                    <ChevronLeftIcon />
                    <span>Listeler</span>
                  </button>
                  <div className="selected-list-info">
                    <h3>{selectedList.ad}</h3>
                    {selectedList.aciklama && (
                      <p>{selectedList.aciklama}</p>
                    )}
                  </div>
                  <div className="selected-list-actions">
                    {isOwnProfile && (
                      <button 
                        className="selected-list-edit-btn"
                        onClick={(e) => handleOpenEditListModal(selectedList, e)}
                        title="Listeyi düzenle"
                      >
                        <EditIcon />
                        <span>Düzenle</span>
                      </button>
                    )}
                    <div className="view-mode-toggle">
                      <button 
                        className={`view-mode-btn ${listViewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setListViewMode('list')}
                        title="Liste görünümü"
                      >
                        <ListViewIcon />
                      </button>
                      <button 
                        className={`view-mode-btn ${listViewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setListViewMode('grid')}
                        title="Poster görünümü"
                      >
                        <GridViewIcon />
                      </button>
                    </div>
                    <div className="selected-list-meta">
                      {selectedListContents.length} içerik
                    </div>
                  </div>
                </div>

                {selectedListLoading ? (
                  <div className="list-content-loading">
                    <div className="loading-spinner"></div>
                    <span>İçerikler yükleniyor...</span>
                  </div>
                ) : selectedListContents.length > 0 ? (
                  listViewMode === 'list' ? (
                    /* Liste Görünümü */
                    <div className="selected-list-contents">
                      {selectedListContents.map((icerik, index) => (
                        <div key={icerik.icerikId} className="selected-list-item">
                          {isOwnProfile && (
                            <div className="selected-list-item-reorder">
                              <button 
                                className="reorder-btn"
                                onClick={() => handleMoveUp(index)}
                                disabled={index === 0}
                                title="Yukarı taşı"
                              >
                                <ArrowUpIcon />
                              </button>
                              <button 
                                className="reorder-btn"
                                onClick={() => handleMoveDown(index)}
                                disabled={index === selectedListContents.length - 1}
                                title="Aşağı taşı"
                              >
                                <ArrowDownIcon />
                              </button>
                            </div>
                          )}
                          <div className="selected-list-item-order">{index + 1}</div>
                          <div 
                            className="selected-list-item-poster"
                            onClick={() => navigate(`/icerik/${icerik.icerikId}`)}
                          >
                            {icerik.posterUrl ? (
                              <img src={icerik.posterUrl} alt={icerik.baslik} />
                            ) : (
                              <div className="poster-placeholder">
                                <FilmIcon />
                              </div>
                            )}
                          </div>
                          <div 
                            className="selected-list-item-info"
                            onClick={() => navigate(`/icerik/${icerik.icerikId}`)}
                          >
                            <div className="selected-list-item-title">{icerik.baslik}</div>
                            <div className="selected-list-item-meta">
                              <span className="item-type">{icerik.tur}</span>
                              {icerik.ortalamaPuan > 0 && (
                                <span className="item-rating">
                                  <StarIcon filled />
                                  {icerik.ortalamaPuan.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                          {isOwnProfile && (
                            <button 
                              className="selected-list-item-remove"
                              onClick={() => handleRemoveFromList(icerik.icerikId)}
                              title="Listeden çıkar"
                            >
                              <CloseIcon />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Poster Grid Görünümü */
                    <div className="selected-list-grid">
                      {selectedListContents.map((icerik, index) => (
                        <div key={icerik.icerikId} className="selected-grid-item">
                          <div 
                            className="selected-grid-poster"
                            onClick={() => navigate(`/icerik/${icerik.icerikId}`)}
                          >
                            {icerik.posterUrl ? (
                              <img src={icerik.posterUrl} alt={icerik.baslik} />
                            ) : (
                              <div className="poster-placeholder">
                                <FilmIcon />
                              </div>
                            )}
                            <div className="selected-grid-order">{index + 1}</div>
                            {icerik.ortalamaPuan > 0 && (
                              <div className="selected-grid-rating">
                                <StarIcon filled />
                                {icerik.ortalamaPuan.toFixed(1)}
                              </div>
                            )}
                          </div>
                          <div className="selected-grid-info">
                            <div className="selected-grid-title">{icerik.baslik}</div>
                            <div className="selected-grid-type">{icerik.tur}</div>
                          </div>
                          {isOwnProfile && (
                            <button 
                              className="selected-grid-remove"
                              onClick={() => handleRemoveFromList(icerik.icerikId)}
                              title="Listeden çıkar"
                            >
                              <CloseIcon />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <ListIcon />
                    </div>
                    <h3>Liste boş</h3>
                    <p>Bu listede henüz içerik yok</p>
                  </div>
                )}
              </div>
            ) : (
              /* Lists Grid View */
              <>
                {isOwnProfile && (
                  <button
                    className="profile-btn profile-btn-secondary"
                    onClick={() => setShowCreateListModal(true)}
                    style={{ marginBottom: 16, width: '100%' }}
                  >
                    <PlusIcon />
                    Yeni Liste Oluştur
                  </button>
                )}

                {listeler.length > 0 ? (
                  <div className="lists-grid">
                    {listeler.map((liste) => (
                      <div
                        key={liste.id}
                        className="list-card"
                        onClick={() => handleOpenList(liste)}
                      >
                        <div className="list-card-header">
                          <div className="list-card-icon">
                            <ListIcon />
                          </div>
                          <div className="list-card-title-wrapper">
                            <div className="list-card-title">{liste.ad}</div>
                            <div className="list-card-meta">
                              <span>{liste.icerikSayisi || 0} içerik</span>
                            </div>
                          </div>
                          {isOwnProfile && (
                            <button 
                              className="list-card-edit-btn"
                              onClick={(e) => handleOpenEditListModal(liste, e)}
                              title="Listeyi düzenle"
                            >
                              <EditIcon />
                            </button>
                          )}
                          <div className="list-card-arrow">
                            <ChevronRightIcon />
                          </div>
                        </div>
                        {liste.aciklama && (
                          <div className="list-card-desc">{liste.aciklama}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <ListIcon />
                    </div>
                    <h3>Henüz liste yok</h3>
                    <p>Favori içeriklerinizi listeleyin!</p>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Profili Düzenle</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className="edit-avatar-section">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <div
                className="edit-avatar"
                onClick={() => fileInputRef.current?.click()}
              >
                {profil.avatarUrl ? (
                  <img src={profil.avatarUrl} alt="Avatar" />
                ) : (
                  <span className="profile-avatar-letter">
                    {(profil.ad || profil.kullaniciAdi).charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="edit-avatar-overlay">
                  {avatarUploading ? <span className="spinner" /> : <CameraIcon />}
                </div>
              </div>
              <button
                className="edit-avatar-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Fotoğrafı Değiştir
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Ad</label>
              <input
                type="text"
                className="form-input"
                value={editForm.ad}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, ad: e.target.value }))
                }
                placeholder="Adınız"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Biyografi</label>
              <textarea
                className="form-input form-textarea"
                value={editForm.bio}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, bio: e.target.value }))
                }
                placeholder="Kendinizden bahsedin..."
                maxLength={200}
              />
              <div className="form-char-count">{editForm.bio.length}/200</div>
            </div>

            <div className="form-group">
              <label className="form-label">Konum</label>
              <input
                type="text"
                className="form-input"
                value={editForm.konum}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, konum: e.target.value }))
                }
                placeholder="Şehir, Ülke"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Website</label>
              <input
                type="text"
                className="form-input"
                value={editForm.websitesi}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, websitesi: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <div className="modal-actions">
              <button
                className="profile-btn profile-btn-secondary"
                onClick={() => setShowEditModal(false)}
              >
                İptal
              </button>
              <button
                className="profile-btn profile-btn-primary"
                onClick={handleUpdateProfile}
                disabled={editLoading}
              >
                {editLoading ? <span className="spinner" /> : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create List Modal */}
      {showCreateListModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowCreateListModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Yeni Liste</h2>
              <button
                className="modal-close"
                onClick={() => setShowCreateListModal(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Liste Adı</label>
              <input
                type="text"
                className="form-input"
                value={listForm.ad}
                onChange={(e) =>
                  setListForm((prev) => ({ ...prev, ad: e.target.value }))
                }
                placeholder="Liste adı girin"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Açıklama (İsteğe bağlı)</label>
              <textarea
                className="form-input form-textarea"
                value={listForm.aciklama}
                onChange={(e) =>
                  setListForm((prev) => ({ ...prev, aciklama: e.target.value }))
                }
                placeholder="Liste hakkında kısa bir açıklama..."
                maxLength={200}
              />
              <div className="form-char-count">{listForm.aciklama.length}/200</div>
            </div>

            <div className="modal-actions">
              <button
                className="profile-btn profile-btn-secondary"
                onClick={() => setShowCreateListModal(false)}
              >
                İptal
              </button>
              <button
                className="profile-btn profile-btn-primary"
                onClick={handleCreateList}
                disabled={createListLoading || !listForm.ad.trim()}
              >
                {createListLoading ? <span className="spinner" /> : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit List Modal */}
      {showEditListModal && editingList && (
        <div
          className="modal-backdrop"
          onClick={() => setShowEditListModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Listeyi Düzenle</h2>
              <button
                className="modal-close"
                onClick={() => setShowEditListModal(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Liste Adı</label>
              <input
                type="text"
                className="form-input"
                value={editListForm.ad}
                onChange={(e) =>
                  setEditListForm((prev) => ({ ...prev, ad: e.target.value }))
                }
                placeholder="Liste adı girin"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Açıklama (İsteğe bağlı)</label>
              <textarea
                className="form-input form-textarea"
                value={editListForm.aciklama}
                onChange={(e) =>
                  setEditListForm((prev) => ({ ...prev, aciklama: e.target.value }))
                }
                placeholder="Liste hakkında kısa bir açıklama..."
                maxLength={200}
              />
              <div className="form-char-count">{editListForm.aciklama.length}/200</div>
            </div>

            <div className="modal-actions">
              <button
                className="profile-btn profile-btn-secondary"
                onClick={() => setShowEditListModal(false)}
              >
                İptal
              </button>
              <button
                className="profile-btn profile-btn-primary"
                onClick={handleUpdateList}
                disabled={editListLoading || !editListForm.ad.trim()}
              >
                {editListLoading ? <span className="spinner" /> : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Takipçiler Modal */}
      {showFollowersModal && (
        <div className="modal-overlay" onClick={() => setShowFollowersModal(false)}>
          <div className="modal-content followers-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Takipçiler ({profil?.takipciSayisi || followers.length})</h2>
              <button className="modal-close" onClick={() => setShowFollowersModal(false)}>
                <XIcon />
              </button>
            </div>
            <div className="followers-list">
              {followersLoading && followers.length === 0 ? (
                <div className="followers-loading">
                  <span className="spinner" />
                  <span>Yükleniyor...</span>
                </div>
              ) : followers.length === 0 ? (
                <div className="followers-empty">
                  <UserIcon />
                  <span>Henüz takipçi yok</span>
                </div>
              ) : (
                followers.map((follower) => (
                  <div key={follower.id} className="follower-item">
                    <div 
                      className="follower-info"
                      onClick={() => {
                        setShowFollowersModal(false);
                        navigate(`/profil/${follower.kullaniciAdi}`);
                      }}
                    >
                      <div className="follower-avatar">
                        {follower.avatarUrl ? (
                          <img src={follower.avatarUrl} alt={follower.kullaniciAdi} />
                        ) : (
                          <UserIcon />
                        )}
                      </div>
                      <div className="follower-details">
                        <span className="follower-name">{follower.goruntulemeAdi || follower.kullaniciAdi}</span>
                        <span className="follower-username">@{follower.kullaniciAdi}</span>
                        {/* Başka profilde ortak takipçi göstergesi */}
                        {!isOwnProfile && myFollowingIds.has(follower.id) && (
                          <span className="follower-mutual">Ortak takip</span>
                        )}
                      </div>
                    </div>
                    <div className="follower-actions">
                      {/* Takip et/bırak butonu - kendimiz değilsek göster */}
                      {user && user.id !== follower.id && (
                        <button
                          className={`follower-action-btn text-btn ${myFollowingIds.has(follower.id) ? 'following' : ''}`}
                          disabled={modalFollowLoading === follower.id}
                          onClick={() => handleFollowFromModal(follower.id)}
                        >
                          {modalFollowLoading === follower.id ? (
                            <span className="spinner-small" />
                          ) : myFollowingIds.has(follower.id) ? (
                            'Takipten Çık'
                          ) : isOwnProfile ? (
                            'Geri Takip Et'
                          ) : (
                            'Takip Et'
                          )}
                        </button>
                      )}
                      {/* Kendi profilimizse takipçiyi çıkarma butonu */}
                      {isOwnProfile && (
                        <button
                          className="follower-action-btn text-btn remove"
                          onClick={() => handleRemoveFollower(follower.id)}
                        >
                          Takipçiden Çıkar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Takip Edilenler Modal */}
      {showFollowingModal && (
        <div className="modal-overlay" onClick={() => setShowFollowingModal(false)}>
          <div className="modal-content followers-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Takip Edilenler ({profil?.takipEdilenSayisi || following.length})</h2>
              <button className="modal-close" onClick={() => setShowFollowingModal(false)}>
                <XIcon />
              </button>
            </div>
            <div className="followers-list">
              {followingLoading && following.length === 0 ? (
                <div className="followers-loading">
                  <span className="spinner" />
                  <span>Yükleniyor...</span>
                </div>
              ) : following.length === 0 ? (
                <div className="followers-empty">
                  <UserIcon />
                  <span>Henüz kimse takip edilmiyor</span>
                </div>
              ) : (
                following.map((followedUser) => (
                  <div key={followedUser.id} className="follower-item">
                    <div 
                      className="follower-info"
                      onClick={() => {
                        setShowFollowingModal(false);
                        navigate(`/profil/${followedUser.kullaniciAdi}`);
                      }}
                    >
                      <div className="follower-avatar">
                        {followedUser.avatarUrl ? (
                          <img src={followedUser.avatarUrl} alt={followedUser.kullaniciAdi} />
                        ) : (
                          <UserIcon />
                        )}
                      </div>
                      <div className="follower-details">
                        <span className="follower-name">{followedUser.goruntulemeAdi || followedUser.kullaniciAdi}</span>
                        <span className="follower-username">@{followedUser.kullaniciAdi}</span>
                        {/* Başka profilde ortak takip göstergesi */}
                        {!isOwnProfile && myFollowingIds.has(followedUser.id) && (
                          <span className="follower-mutual">Ortak takip</span>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <button
                        className="follower-action-btn text-btn unfollow"
                        disabled={modalFollowLoading === followedUser.id}
                        onClick={() => handleFollowFromModal(followedUser.id)}
                      >
                        {modalFollowLoading === followedUser.id ? (
                          <span className="spinner-small" />
                        ) : (
                          'Takibi Bırak'
                        )}
                      </button>
                    )}
                    {!isOwnProfile && user && user.id !== followedUser.id && (
                      <button
                        className={`follower-action-btn text-btn ${myFollowingIds.has(followedUser.id) ? 'following' : ''}`}
                        disabled={modalFollowLoading === followedUser.id}
                        onClick={() => handleFollowFromModal(followedUser.id)}
                      >
                        {modalFollowLoading === followedUser.id ? (
                          <span className="spinner-small" />
                        ) : myFollowingIds.has(followedUser.id) ? (
                          'Takipten Çık'
                        ) : (
                          'Takip Et'
                        )}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
