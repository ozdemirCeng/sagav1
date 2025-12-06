import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import { icerikApi, yorumApi, puanlamaApi, kutuphaneApi, listeApi, aktiviteApi } from '../../services/api';
import { getDetailCache, setDetailCache, updateCachedYorumlar, updateCachedListeIds, updateCachedPuan } from '../../services/detailCache';
import type { Icerik, IcerikListItem, Yorum, YorumCreateDto, Liste, Aktivite } from '../../services/api';
import { ContentCard, icerikToCardData } from '../../components/ui';
import { FeedActivityCard } from './FeedPage';
import './DetailPage.css';
import './FeedPage.css'; // FeedActivityCard stilleri için

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}s ${mins}dk` : `${mins}dk`;
}

function formatNumber(num?: number): string {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// ============================================
// STAR RATING COMPONENT (10-star)
// ============================================

interface StarRatingProps {
  value: number;
  onChange?: (val: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function StarRating({ value, onChange, readonly = false }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);

  const handleClick = (star: number) => {
    if (!readonly && onChange) {
      onChange(star);
    }
  };

  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
        <button
          key={star}
          type="button"
          className={`star ${(hoverValue || value) >= star ? 'active' : ''}`}
          onClick={() => handleClick(star)}
          onMouseEnter={() => !readonly && setHoverValue(star)}
          onMouseLeave={() => !readonly && setHoverValue(0)}
          disabled={readonly}
        >
          <span className="material-symbols-rounded">star</span>
        </button>
      ))}
    </div>
  );
}

// ============================================
// MAIN DETAIL PAGE COMPONENT
// ============================================

export default function DetailPage() {
  const { id } = useParams<{ tip: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, requireAuth } = useAuth();

  // Content state
  const [icerik, setIcerik] = useState<Icerik | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User interaction states
  const [kullaniciPuani, setKullaniciPuani] = useState(0);
  const [kutuphaneDurumu, setKutuphaneDurumu] = useState<string | undefined>();
  const [savingRating, setSavingRating] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);

  // Comment states
  const [yorumlar, setYorumlar] = useState<Yorum[]>([]);
  const [yorumText, setYorumText] = useState('');
  const [yorumPuan, setYorumPuan] = useState(0);
  const [spoilerIceriyor, setSpoilerIceriyor] = useState(false);
  const [yorumLoading, setYorumLoading] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<number>>(new Set());
  const [replyingTo, setReplyingTo] = useState<Yorum | null>(null);

  // Tab states
  const [activeTab, setActiveTab] = useState<'yorumlar' | 'listeler' | 'aktiviteler'>('yorumlar');
  const [listeler, setListeler] = useState<Liste[]>([]);
  const [aktiviteler, setAktiviteler] = useState<Aktivite[]>([]);

  // Sidebar states
  const [similarContent, setSimilarContent] = useState<IcerikListItem[]>([]);

  // Liste dropdown state
  const [listeDropdownOpen, setListeDropdownOpen] = useState(false);
  const [kullaniciListeleri, setKullaniciListeleri] = useState<Liste[]>([]);
  const [icerikListeIds, setIcerikListeIds] = useState<number[]>([]);
  const [listeLoading, setListeLoading] = useState(false);

  // UI states
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  // Library dropdown state
  const [libraryDropdownOpen, setLibraryDropdownOpen] = useState(false);

  // Lazy loading ref - çift yüklemeyi önle
  const isDataLoadedRef = useRef(false);
  const currentIdRef = useRef<string | undefined>(undefined);

  // Sayfa açılışında en üste scroll et
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]); // id değişince (yeni içerik) tekrar scroll et

  // Load content with cache
  const loadContent = useCallback(async (forceRefresh = false) => {
    if (!id) return;

    const icerikId = parseInt(id);

    // Cache kontrolü
    if (!forceRefresh) {
      const cached = getDetailCache(icerikId);
      if (cached) {
        // Cache'den yükle
        setIcerik(cached.icerik);
        setYorumlar(cached.yorumlar);
        setListeler(cached.listeler);
        setSimilarContent(cached.similarContent);
        setAktiviteler(cached.aktiviteler);
        setKullaniciListeleri(cached.kullaniciListeleri);
        setIcerikListeIds(cached.icerikListeIds);

        if (cached.icerik.kullaniciPuani) {
          setKullaniciPuani(cached.icerik.kullaniciPuani);
        }
        if (cached.icerik.kullanicininDurumu) {
          setKutuphaneDurumu(cached.icerik.kullanicininDurumu);
        }

        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const [icerikData, yorumlarData] = await Promise.all([
        icerikApi.getById(icerikId),
        yorumApi.getIcerikYorumlari(icerikId, { sayfaBoyutu: 20 }),
      ]);

      console.log('İçerik detayları:', icerikData);
      setIcerik(icerikData);
      setYorumlar(yorumlarData.data);

      // User states
      if (icerikData.kullaniciPuani) {
        setKullaniciPuani(icerikData.kullaniciPuani);
      }
      if (icerikData.kullanicininDurumu) {
        setKutuphaneDurumu(icerikData.kullanicininDurumu);
      }

      // Parallel yükleme için değişkenler
      let listsData: Liste[] = [];
      let listIdsList: number[] = [];
      let similarData: IcerikListItem[] = [];
      let userLists: Liste[] = [];
      let contentActivities: Aktivite[] = [];

      // Paralel olarak diğer verileri yükle
      const [listsResult, similarResult, userListsResult, feedResult] = await Promise.allSettled([
        listeApi.getIcerikListeleri(icerikId),
        icerikApi.getSimilar(icerikId, icerikData.tur, 6),
        listeApi.getMyListeler(),
        aktiviteApi.getGenelFeed({ limit: 50 }),
      ]);

      if (listsResult.status === 'fulfilled') {
        listsData = listsResult.value;
        listIdsList = listsData.map((l: Liste) => l.id);
        setListeler(listsData);
        setIcerikListeIds(listIdsList);
      }

      if (similarResult.status === 'fulfilled') {
        similarData = similarResult.value;
        setSimilarContent(similarData);
      }

      if (userListsResult.status === 'fulfilled') {
        userLists = userListsResult.value;
        setKullaniciListeleri(userLists);
      }

      if (feedResult.status === 'fulfilled') {
        contentActivities = feedResult.value.data
          .filter((a: Aktivite) => a.icerikId === icerikId)
          // Yorum aktivitelerini gösterme - zaten yorumlar sekmesinde gösteriliyor
          .filter((a: Aktivite) => {
            const tur = (a.aktiviteTuru || a.aktiviteTipiStr || '').toLowerCase();
            return tur !== 'yorum';
          })
          .slice(0, 10);
        setAktiviteler(contentActivities);
      }

      // Cache'e kaydet
      setDetailCache(icerikId, {
        icerik: icerikData,
        yorumlar: yorumlarData.data,
        listeler: listsData,
        similarContent: similarData,
        aktiviteler: contentActivities,
        kullaniciListeleri: userLists,
        icerikListeIds: listIdsList,
      });

    } catch (err: unknown) {
      console.error('İçerik yükleme hatası:', err);
      const errorMessage = err instanceof Error ? err.message : 'İçerik yüklenirken bir hata oluştu.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // İlk yükleme
  useEffect(() => {
    if (id && id !== currentIdRef.current) {
      currentIdRef.current = id;
      isDataLoadedRef.current = false;
    }

    if (!isDataLoadedRef.current && id) {
      isDataLoadedRef.current = true;
      loadContent();
    }
  }, [id, loadContent]);

  // URL hash'e göre yoruma scroll et
  useEffect(() => {
    if (!loading && yorumlar.length > 0) {
      const hash = location.hash;
      if (hash && hash.startsWith('#yorum-')) {
        // Yorumlar tab'ına geç
        setActiveTab('yorumlar');
        
        // Kısa bir gecikme ile scroll yap (DOM render için)
        setTimeout(() => {
          const elementId = hash.substring(1); // # işaretini kaldır
          const element = document.getElementById(elementId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Vurgulama efekti
            element.classList.add('highlight-comment');
            setTimeout(() => {
              element.classList.remove('highlight-comment');
            }, 3000);
          }
        }, 300);
      }
    }
  }, [loading, yorumlar, location.hash]);

  // Handle rating
  const handleRating = async (puan: number) => {
    if (!requireAuth('puanlamak')) return;
    if (!icerik) return;

    setSavingRating(true);
    try {
      await puanlamaApi.puanla({ icerikId: icerik.id, puan });
      setKullaniciPuani(puan);
      try {
        const refreshed = await icerikApi.getById(icerik.id);
        setIcerik(refreshed);
        // Cache'i güncelle
        updateCachedPuan(icerik.id, refreshed);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('saga-rating-updated', {
            detail: {
              icerikId: refreshed.id,
              saga: refreshed.ortalamaPuan ?? null,
              harici: refreshed.hariciPuan ?? null,
            },
          }));
        }
      } catch (refreshError) {
        console.error('Puan güncellenirken içerik yenileme hatası:', refreshError);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('saga-rating-updated', {
            detail: { icerikId: icerik.id },
          }));
        }
      }
    } catch (err) {
      console.error('Puanlama hatası:', err);
    } finally {
      setSavingRating(false);
    }
  };

  // Handle library status change
  const handleLibraryChange = async (durum: string) => {
    if (!requireAuth('kütüphaneye eklemek')) return;
    if (!icerik) return;

    setSavingLibrary(true);
    try {
      if (durum === 'kaldir') {
        // Kütüphaneden çıkar
        await kutuphaneApi.kaldir(icerik.id);
        setKutuphaneDurumu(undefined);
      } else {
        await kutuphaneApi.durumGuncelle(icerik.id, durum);
        setKutuphaneDurumu(durum);
      }
      setLibraryDropdownOpen(false);
    } catch (err) {
      console.error('Kütüphane hatası:', err);
    } finally {
      setSavingLibrary(false);
    }
  };

  // Handle liste toggle
  const handleListeToggle = async (listeId: number) => {
    if (!requireAuth('listeye eklemek')) return;
    if (!icerik) return;

    setListeLoading(true);
    try {
      let newListeIds: number[];
      if (icerikListeIds.includes(listeId)) {
        await listeApi.removeIcerik(listeId, icerik.id);
        newListeIds = icerikListeIds.filter((id) => id !== listeId);
      } else {
        await listeApi.addIcerik(listeId, icerik.id);
        newListeIds = [...icerikListeIds, listeId];
      }
      setIcerikListeIds(newListeIds);
      // Cache'i güncelle
      updateCachedListeIds(icerik.id, newListeIds);
    } catch (err) {
      console.error('Liste güncelleme hatası:', err);
    } finally {
      setListeLoading(false);
    }
  };

  // Handle comment submit
  const handleCommentSubmit = async () => {
    if (!requireAuth('yorum yapmak')) return;
    if (!icerik || !yorumText.trim()) return;

    setYorumLoading(true);
    try {
      // Yanıtın yanıtı ise ana yoruma bağla
      const ustYorumId = replyingTo?.ustYorumId || replyingTo?.id;
      
      const dto: YorumCreateDto = {
        icerikId: icerik.id,
        icerik: yorumText,
        puan: !replyingTo && yorumPuan > 0 ? yorumPuan : undefined, // Yanıtlarda puan yok
        spoilerIceriyor,
        ustYorumId: ustYorumId, // Yanıt ise üst yorum ID'si (her zaman ana yorum)
      };

      const yeniYorum = await yorumApi.create(dto);
      
      if (replyingTo) {
        // Ana yorumun ID'sini bul
        const anaYorumId = replyingTo.ustYorumId || replyingTo.id;
        
        // Yanıtı ana yorumun yanıtlar listesine ekle
        const updatedYorumlar = yorumlar.map((y) =>
          y.id === anaYorumId
            ? { ...y, yanitlar: [...(y.yanitlar || []), yeniYorum] }
            : y
        );
        setYorumlar(updatedYorumlar);
        updateCachedYorumlar(icerik.id, updatedYorumlar);
        setReplyingTo(null);
      } else {
        // Normal yorum ise başa ekle
        const updatedYorumlar = [yeniYorum, ...yorumlar];
        setYorumlar(updatedYorumlar);
        updateCachedYorumlar(icerik.id, updatedYorumlar);
      }
      
      setYorumText('');
      setYorumPuan(0);
      setSpoilerIceriyor(false);
    } catch (err: unknown) {
      console.error('Yorum hatası:', err);
    } finally {
      setYorumLoading(false);
    }
  };

  // Handle reply button click
  const handleReplyClick = (yorum: Yorum) => {
    if (!requireAuth('yanıtlamak')) return;
    setReplyingTo(yorum);
    // Yorum formuna scroll
    document.getElementById('yorum-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Cancel reply
  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Handle comment like (ana yorumlar ve yanıtlar için)
  const handleLikeComment = async (yorumId: number) => {
    if (!requireAuth('beğenmek')) return;

    // Optimistic update - UI'ı hemen güncelle
    const optimisticUpdate = (begendi: boolean, delta: number) => {
      setYorumlar((prev) =>
        prev.map((y) => {
          if (y.id === yorumId) {
            return { ...y, kullaniciBegendiMi: begendi, begeniSayisi: (y.begeniSayisi || 0) + delta };
          }
          if (y.yanitlar && y.yanitlar.length > 0) {
            const updatedYanitlar = y.yanitlar.map((yanit) =>
              yanit.id === yorumId
                ? { ...yanit, kullaniciBegendiMi: begendi, begeniSayisi: (yanit.begeniSayisi || 0) + delta }
                : yanit
            );
            return { ...y, yanitlar: updatedYanitlar };
          }
          return y;
        })
      );
    };

    // Mevcut durumu bul
    let currentBegendi = false;
    yorumlar.forEach(y => {
      if (y.id === yorumId) currentBegendi = y.kullaniciBegendiMi || false;
      y.yanitlar?.forEach(yanit => {
        if (yanit.id === yorumId) currentBegendi = yanit.kullaniciBegendiMi || false;
      });
    });

    // Hemen güncelle
    optimisticUpdate(!currentBegendi, currentBegendi ? -1 : 1);

    try {
      const result = await yorumApi.toggleBegeni(yorumId);
      // API sonucuyla senkronize et
      setYorumlar((prev) =>
        prev.map((y) => {
          if (y.id === yorumId) {
            return { ...y, kullaniciBegendiMi: result.begendi, begeniSayisi: result.begeniSayisi };
          }
          if (y.yanitlar && y.yanitlar.length > 0) {
            const updatedYanitlar = y.yanitlar.map((yanit) =>
              yanit.id === yorumId
                ? { ...yanit, kullaniciBegendiMi: result.begendi, begeniSayisi: result.begeniSayisi }
                : yanit
            );
            return { ...y, yanitlar: updatedYanitlar };
          }
          return y;
        })
      );
    } catch (err) {
      // Hata durumunda geri al
      optimisticUpdate(currentBegendi, currentBegendi ? 1 : -1);
      console.error('Beğeni hatası:', err);
    }
  };

  // Handle comment delete
  const handleDeleteComment = async (yorumId: number) => {
    if (!window.confirm('Bu yorumu silmek istediğinize emin misiniz?')) return;
    if (!icerik) return;

    try {
      await yorumApi.delete(yorumId);
      const updatedYorumlar = yorumlar.filter((y) => y.id !== yorumId);
      setYorumlar(updatedYorumlar);
      updateCachedYorumlar(icerik.id, updatedYorumlar);
    } catch (err) {
      console.error('Yorum silme hatası:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="detail-page-wrapper">
        {/* Hero Section Skeleton */}
        <section className="detail-hero">
          <div className="hero-backdrop skeleton-shimmer" style={{ background: 'var(--void-surface)' }}></div>
          <div className="hero-overlay"></div>
        </section>

        {/* Main Content Skeleton */}
        <main className="detail-main-content">
          <div className="detail-content-grid">
            {/* LEFT COLUMN - Poster & Actions */}
            <aside className="poster-column">
              <div className="poster-wrapper">
                <div className="skeleton-shimmer" style={{ width: '100%', aspectRatio: '2/3', borderRadius: '20px' }}></div>
              </div>
              
              {/* Action Buttons Skeleton */}
              <div className="poster-actions">
                <div className="skeleton-shimmer" style={{ flex: 1, height: '48px', borderRadius: '12px' }}></div>
                <div className="skeleton-shimmer" style={{ width: '56px', height: '48px', borderRadius: '12px' }}></div>
              </div>

              {/* Quick Stats Skeleton */}
              <div className="quick-stats">
                <div className="stat-item">
                  <div className="skeleton-shimmer" style={{ width: '40px', height: '24px', borderRadius: '6px', margin: '0 auto 4px' }}></div>
                  <div className="skeleton-shimmer" style={{ width: '60px', height: '12px', borderRadius: '4px', margin: '0 auto' }}></div>
                </div>
                <div className="stat-item">
                  <div className="skeleton-shimmer" style={{ width: '40px', height: '24px', borderRadius: '6px', margin: '0 auto 4px' }}></div>
                  <div className="skeleton-shimmer" style={{ width: '60px', height: '12px', borderRadius: '4px', margin: '0 auto' }}></div>
                </div>
                <div className="stat-item">
                  <div className="skeleton-shimmer" style={{ width: '40px', height: '24px', borderRadius: '6px', margin: '0 auto 4px' }}></div>
                  <div className="skeleton-shimmer" style={{ width: '60px', height: '12px', borderRadius: '4px', margin: '0 auto' }}></div>
                </div>
              </div>
            </aside>

            {/* CENTER COLUMN - Main Info */}
            <div className="info-column">
              {/* Content Type Badge Skeleton */}
              <div className="skeleton-shimmer" style={{ width: '80px', height: '28px', borderRadius: '8px', marginBottom: '16px' }}></div>

              {/* Title Skeleton */}
              <div className="skeleton-shimmer" style={{ width: '70%', height: '40px', borderRadius: '8px', marginBottom: '16px' }}></div>

              {/* Meta Info Skeleton */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div className="skeleton-shimmer" style={{ width: '80px', height: '20px', borderRadius: '4px' }}></div>
                <div className="skeleton-shimmer" style={{ width: '100px', height: '20px', borderRadius: '4px' }}></div>
                <div className="skeleton-shimmer" style={{ width: '120px', height: '20px', borderRadius: '4px' }}></div>
              </div>

              {/* Rating Section Skeleton */}
              <div className="rating-section">
                <div className="skeleton-shimmer" style={{ width: '140px', height: '90px', borderRadius: '16px' }}></div>
                <div className="skeleton-shimmer" style={{ width: '140px', height: '90px', borderRadius: '16px' }}></div>
                <div className="skeleton-shimmer" style={{ width: '180px', height: '90px', borderRadius: '16px' }}></div>
              </div>

              {/* Genres Skeleton */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton-shimmer" style={{ width: '70px', height: '32px', borderRadius: '16px' }}></div>
                ))}
              </div>

              {/* Overview Skeleton */}
              <div>
                <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="skeleton-shimmer" style={{ width: '20px', height: '20px', borderRadius: '4px' }}></div>
                  <div className="skeleton-shimmer" style={{ width: '50px', height: '20px', borderRadius: '4px' }}></div>
                </div>
                <div className="skeleton-shimmer" style={{ width: '100%', height: '16px', borderRadius: '4px', marginBottom: '8px' }}></div>
                <div className="skeleton-shimmer" style={{ width: '95%', height: '16px', borderRadius: '4px', marginBottom: '8px' }}></div>
                <div className="skeleton-shimmer" style={{ width: '80%', height: '16px', borderRadius: '4px' }}></div>
              </div>

              {/* Cast Section Skeleton */}
              <div className="cast-section">
                <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="skeleton-shimmer" style={{ width: '20px', height: '20px', borderRadius: '4px' }}></div>
                  <div className="skeleton-shimmer" style={{ width: '100px', height: '20px', borderRadius: '4px' }}></div>
                </div>
                <div className="cast-scroll">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="cast-card">
                      <div className="skeleton-shimmer cast-photo"></div>
                      <div className="skeleton-shimmer" style={{ width: '80%', height: '14px', borderRadius: '4px', marginTop: '8px' }}></div>
                      <div className="skeleton-shimmer" style={{ width: '60%', height: '12px', borderRadius: '4px', marginTop: '4px' }}></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs Skeleton */}
              <div className="tabs-container">
                <div className="tabs-header">
                  <div className="skeleton-shimmer tab-btn" style={{ width: '120px' }}></div>
                  <div className="skeleton-shimmer tab-btn" style={{ width: '110px' }}></div>
                  <div className="skeleton-shimmer tab-btn" style={{ width: '120px' }}></div>
                </div>

                {/* Tab Content Skeleton - Yorumlar style */}
                <div className="tab-content active">
                  {/* Comment Form Skeleton */}
                  <div className="comment-form-card">
                    <div className="comment-form-header">
                      <div className="skeleton-shimmer" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
                      <div className="skeleton-shimmer" style={{ flex: 1, height: '80px', borderRadius: '12px' }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                      <div className="skeleton-shimmer" style={{ width: '100px', height: '40px', borderRadius: '10px' }}></div>
                    </div>
                  </div>

                  {/* Comments List Skeleton */}
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="comment-card">
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div className="skeleton-shimmer" style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }}></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div className="skeleton-shimmer" style={{ width: '100px', height: '16px', borderRadius: '4px' }}></div>
                            <div className="skeleton-shimmer" style={{ width: '60px', height: '14px', borderRadius: '4px' }}></div>
                          </div>
                          <div className="skeleton-shimmer" style={{ width: '100%', height: '14px', borderRadius: '4px', marginBottom: '6px' }}></div>
                          <div className="skeleton-shimmer" style={{ width: '85%', height: '14px', borderRadius: '4px', marginBottom: '12px' }}></div>
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <div className="skeleton-shimmer" style={{ width: '50px', height: '24px', borderRadius: '6px' }}></div>
                            <div className="skeleton-shimmer" style={{ width: '50px', height: '24px', borderRadius: '6px' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error || !icerik) {
    return (
      <div className="detail-main-content" style={{ paddingTop: '150px' }}>
        <div className="sidebar-card" style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--error)', marginBottom: '16px' }}>
            error
          </span>
          <h2 style={{ marginBottom: '8px' }}>İçerik Bulunamadı</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            {error || 'Aradığınız içerik mevcut değil.'}
          </p>
          <button className="action-btn-large primary" onClick={() => navigate(-1)}>
            <span className="material-symbols-rounded">arrow_back</span>
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  const yil = icerik.yayinTarihi?.split('-')[0];
  const backdropUrl = icerik.posterUrl?.replace('/w500/', '/original/') || icerik.posterUrl;

  // Library status options
  const getLibraryStatuses = () => {
    if (icerik.tur === 'Film' || icerik.tur === 'Dizi') {
      return [
        { value: 'devam_ediyor', label: 'İzleniyor', icon: 'play_arrow' },
        { value: 'izlendi', label: 'İzlendi', icon: 'check' },
        { value: 'izlenecek', label: 'İzlenecek', icon: 'visibility' },
        { value: 'kaldir', label: 'Kütüphaneden Çıkar', icon: 'delete', isDanger: true },
      ];
    }
    return [
      { value: 'devam_ediyor', label: 'Okunuyor', icon: 'auto_stories' },
      { value: 'okundu', label: 'Okundu', icon: 'check' },
      { value: 'okunacak', label: 'Okunacak', icon: 'bookmark' },
      { value: 'kaldir', label: 'Kütüphaneden Çıkar', icon: 'delete', isDanger: true },
    ];
  };

  const libraryStatuses = getLibraryStatuses();
  const currentLibraryLabel = libraryStatuses.find((s) => s.value === kutuphaneDurumu)?.label || 'Kütüphaneye Ekle';

  return (
    <div className="detail-page-wrapper">
      {/* Hero Section */}
      <section className="detail-hero">
        <div 
          className="hero-backdrop" 
          style={{ backgroundImage: `url(${backdropUrl})` }}
        ></div>
        <div className="hero-overlay"></div>
        
        {/* Mobile Content Type Badge */}
        <div className="hero-content-badge">
          <span className="material-symbols-rounded">
            {icerik.tur === 'Film' ? 'movie' : icerik.tur === 'Dizi' ? 'tv' : 'menu_book'}
          </span>
          {icerik.tur === 'Film' ? 'FİLM' : icerik.tur === 'Dizi' ? 'DİZİ' : 'KİTAP'}
        </div>
        
        {/* Trailer Button - Only for films and TV shows */}
        {(icerik.tur === 'Film' || icerik.tur === 'Dizi') && (
          <>
            <button className="trailer-btn" title="Fragmanı İzle">
              <span className="material-symbols-rounded">play_arrow</span>
            </button>
            <span className="trailer-text">Fragmanı İzle</span>
          </>
        )}
      </section>

      {/* Main Content */}
      <main className="detail-main-content">
        <div className="detail-content-grid">
          {/* LEFT COLUMN - Poster & Actions */}
          <aside className="poster-column">
            <div className="poster-wrapper">
              {icerik.posterUrl ? (
                <img src={icerik.posterUrl} alt={icerik.baslik} />
              ) : (
                <div style={{ 
                  width: '100%', 
                  aspectRatio: '2/3', 
                  background: 'var(--void-surface)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '64px', color: 'var(--text-muted)' }}>
                    {icerik.tur === 'Film' ? 'movie' : icerik.tur === 'Dizi' ? 'tv' : 'menu_book'}
                  </span>
                </div>
              )}
              {icerik.hariciPuan && icerik.hariciPuan >= 8 && (
                <div className="poster-badge">
                  <span className="material-symbols-rounded">workspace_premium</span>
                  TOP RATED
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="poster-actions">
              {/* Library Dropdown */}
              <div style={{ flex: 1, position: 'relative' }}>
                <button 
                  className={`action-btn-large ${kutuphaneDurumu ? 'primary' : 'secondary'}`}
                  style={{ width: '100%' }}
                  onClick={() => setLibraryDropdownOpen(!libraryDropdownOpen)}
                  disabled={savingLibrary}
                >
                  <span className="material-symbols-rounded">
                    {kutuphaneDurumu ? 'check' : 'add'}
                  </span>
                  {currentLibraryLabel}
                </button>
                
                {libraryDropdownOpen && (
                  <>
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
                      onClick={() => setLibraryDropdownOpen(false)} 
                    />
                    <div className="sidebar-card" style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      right: 0, 
                      marginTop: '8px', 
                      padding: '8px',
                      zIndex: 50 
                    }}>
                      {libraryStatuses
                        .filter(status => status.value !== 'kaldir' || kutuphaneDurumu)
                        .map((status) => (
                        <button
                          key={status.value}
                          onClick={() => handleLibraryChange(status.value)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px',
                            background: kutuphaneDurumu === status.value ? 'rgba(212, 168, 83, 0.15)' : 'transparent',
                            border: 'none',
                            borderRadius: '8px',
                            color: status.isDanger ? '#ef4444' : (kutuphaneDurumu === status.value ? 'var(--gold-primary)' : 'var(--text-primary)'),
                            cursor: 'pointer',
                            fontSize: '14px',
                            textAlign: 'left',
                          }}
                        >
                          <span className="material-symbols-rounded">{status.icon}</span>
                          {status.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Liste Button */}
              <div style={{ position: 'relative', flex: 'none' }}>
                <button 
                  className="action-btn-large secondary"
                  onClick={() => setListeDropdownOpen(!listeDropdownOpen)}
                  title="Listeye Ekle"
                  style={{ width: '56px' }}
                >
                  <span className="material-symbols-rounded">playlist_add</span>
                </button>
                
                {listeDropdownOpen && (
                  <>
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
                      onClick={() => setListeDropdownOpen(false)} 
                    />
                    <div className="sidebar-card liste-dropdown-menu" style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      right: 0,
                      minWidth: 'clamp(160px, 45vw, 220px)', 
                      maxWidth: 'calc(100vw - 24px)',
                      marginTop: '6px', 
                      padding: 'clamp(4px, 1.5vw, 8px)',
                      zIndex: 50 
                    }}>
                      {listeLoading ? (
                        <div style={{ padding: 'clamp(8px, 2vw, 16px)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'clamp(11px, 3vw, 14px)' }}>
                          Yükleniyor...
                        </div>
                      ) : kullaniciListeleri.length === 0 ? (
                        <div style={{ padding: 'clamp(8px, 2vw, 16px)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'clamp(11px, 3vw, 14px)' }}>
                          Henüz listeniz yok
                        </div>
                      ) : (
                        kullaniciListeleri.map((liste) => {
                          const isInList = icerikListeIds.includes(liste.id);
                          return (
                            <button
                              key={liste.id}
                              onClick={() => handleListeToggle(liste.id)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'clamp(4px, 1.5vw, 8px)',
                                padding: 'clamp(8px, 2vw, 12px)',
                                background: isInList ? 'rgba(212, 168, 83, 0.15)' : 'transparent',
                                border: 'none',
                                borderRadius: 'clamp(4px, 1.5vw, 8px)',
                                color: isInList ? 'var(--gold-primary)' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: 'clamp(11px, 3vw, 14px)',
                                textAlign: 'left',
                              }}
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: 'clamp(16px, 4vw, 20px)', fontVariationSettings: isInList ? "'FILL' 1" : "'FILL' 0" }}>
                                {isInList ? 'check_circle' : 'add_circle'}
                              </span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {liste.ad}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="quick-stats">
              <div className="stat-item">
                <div className="stat-value">{formatNumber(icerik.puanlamaSayisi)}</div>
                <div className="stat-label">Puanlama</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatNumber(icerik.yorumSayisi)}</div>
                <div className="stat-label">Yorum</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatNumber(icerik.listeyeEklenmeSayisi)}</div>
                <div className="stat-label">Liste</div>
              </div>
            </div>
          </aside>

          {/* CENTER COLUMN - Main Info */}
          <div className="info-column">
            {/* Content Type Badge */}
            <div className="content-type-badge">
              <span className="material-symbols-rounded">
                {icerik.tur === 'Film' ? 'movie' : icerik.tur === 'Dizi' ? 'tv' : 'menu_book'}
              </span>
              {icerik.tur === 'Film' ? 'Film' : icerik.tur === 'Dizi' ? 'Dizi' : 'Kitap'}
            </div>

            {/* Title */}
            <h1 className="detail-content-title">{icerik.baslik}</h1>

            {/* Meta Info */}
            <div className="detail-content-meta">
              {yil && (
                <>
                  <div className="meta-item">
                    <span className="material-symbols-rounded">calendar_month</span>
                    {yil}
                  </div>
                  <div className="meta-divider"></div>
                </>
              )}
              {icerik.sure && icerik.sure > 0 && (
                <>
                  <div className="meta-item">
                    <span className="material-symbols-rounded">schedule</span>
                    {formatDuration(icerik.sure)}
                  </div>
                  <div className="meta-divider"></div>
                </>
              )}
              {icerik.yonetmen && (
                <div className="meta-item">
                  <span className="material-symbols-rounded">movie_filter</span>
                  {icerik.yonetmen}
                </div>
              )}
              {icerik.yazarlar && icerik.yazarlar.length > 0 && (
                <div className="meta-item">
                  <span className="material-symbols-rounded">edit</span>
                  {icerik.yazarlar.join(', ')}
                </div>
              )}
            </div>

            {/* Rating Section */}
            <div className="rating-section">
              {/* External Rating - TMDB for films/TV, skip for books */}
              {(icerik.tur === 'Film' || icerik.tur === 'Dizi') && icerik.hariciPuan && icerik.hariciPuan > 0 && (
                <div className="rating-box">
                  <div className="rating-source">TMDB</div>
                  <div className="rating-value">
                    <span className="material-symbols-rounded filled">star</span>
                    {icerik.hariciPuan.toFixed(1)}
                  </div>
                  {icerik.hariciOySayisi && icerik.hariciOySayisi > 0 && (
                    <div className="rating-count">{formatNumber(icerik.hariciOySayisi)} oy</div>
                  )}
                </div>
              )}

              {/* SAGA Rating */}
              <div className="rating-box">
                <div className="rating-source">SAGA</div>
                <div className="rating-value">
                  <span className="material-symbols-rounded filled">star</span>
                  {icerik.ortalamaPuan > 0 ? icerik.ortalamaPuan.toFixed(1) : '-'}
                </div>
                <div className="rating-count">{formatNumber(icerik.puanlamaSayisi)} değerlendirme</div>
              </div>

              {/* User Rating */}
              <div className="user-rating-box">
                <div className="user-rating-label">Puanınız</div>
                <StarRating 
                  value={kullaniciPuani} 
                  onChange={handleRating} 
                  readonly={savingRating}
                />
                {kullaniciPuani > 0 && (
                  <div className="user-rating-text">
                    {kullaniciPuani}/10
                  </div>
                )}
              </div>
            </div>

            {/* Genres */}
            {icerik.turler && icerik.turler.length > 0 && (
              <div className="genres">
                {icerik.turler.map((tur, index) => (
                  <span key={index} className="genre-tag">{tur}</span>
                ))}
              </div>
            )}

            {/* Overview */}
            {icerik.aciklama && (
              <div>
                <h3 className="section-title">
                  <span className="material-symbols-rounded">description</span>
                  Özet
                </h3>
                <p className={`overview-text ${!overviewExpanded ? 'expandable' : 'expanded'}`}>
                  {icerik.aciklama}
                </p>
                {icerik.aciklama.length > 400 && (
                  <button 
                    className={`expand-btn ${overviewExpanded ? 'expanded' : ''}`}
                    onClick={() => setOverviewExpanded(!overviewExpanded)}
                  >
                    {overviewExpanded ? 'Daha az göster' : 'Devamını oku'}
                    <span className="material-symbols-rounded">expand_more</span>
                  </button>
                )}
              </div>
            )}

            {/* Cast Section */}
            {icerik.oyuncular && icerik.oyuncular.length > 0 && (
              <div className="cast-section">
                <h3 className="section-title">
                  <span className="material-symbols-rounded">group</span>
                  Oyuncu Kadrosu
                </h3>
                <div className="cast-scroll">
                  {icerik.oyuncular.slice(0, 12).map((oyuncu, index) => (
                    <div key={index} className="cast-card">
                      {oyuncu.profilUrl ? (
                        <img src={oyuncu.profilUrl} alt={oyuncu.ad} className="cast-photo" />
                      ) : (
                        <div className="cast-photo" style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, rgba(212, 168, 83, 0.2), rgba(212, 168, 83, 0.05))'
                        }}>
                          <span style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {oyuncu.ad?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="cast-name">{oyuncu.ad}</div>
                      {oyuncu.karakter && (
                        <div className="cast-role">{oyuncu.karakter}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="tabs-container">
              <div className="tabs-header">
                <button 
                  className={`tab-btn ${activeTab === 'yorumlar' ? 'active' : ''}`}
                  onClick={() => setActiveTab('yorumlar')}
                >
                  <span className="material-symbols-rounded">chat</span>
                  Yorumlar
                  <span className="tab-count">{yorumlar.length}</span>
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'listeler' ? 'active' : ''}`}
                  onClick={() => setActiveTab('listeler')}
                >
                  <span className="material-symbols-rounded">format_list_bulleted</span>
                  Listelerde
                  <span className="tab-count">{listeler.length}</span>
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'aktiviteler' ? 'active' : ''}`}
                  onClick={() => setActiveTab('aktiviteler')}
                >
                  <span className="material-symbols-rounded">history</span>
                  Aktiviteler
                  <span className="tab-count">{aktiviteler.length}</span>
                </button>
              </div>

              {/* Yorumlar Tab */}
              <div className={`tab-content ${activeTab === 'yorumlar' ? 'active' : ''}`}>
                {/* Comment Form */}
                <div className="comment-form-card" id="yorum-form">
                  {/* Yanıt Göstergesi */}
                  {replyingTo && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(212,168,83,0.1)',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      border: '1px solid rgba(212,168,83,0.2)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-rounded" style={{ color: 'var(--gold-primary)', fontSize: '18px' }}>reply</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--gold-primary)' }}>{replyingTo.kullaniciAdi}</strong> adlı kullanıcıya yanıt yazıyorsunuz
                        </span>
                      </div>
                      <button 
                        onClick={cancelReply}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ color: 'var(--text-muted)', fontSize: '18px' }}>close</span>
                      </button>
                    </div>
                  )}
                  
                  <div className="comment-form-header">
                    <div className="comment-form-avatar" style={{
                      background: 'linear-gradient(135deg, var(--gold-primary), var(--gold-dim))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--void)'
                    }}>
                      {user ? user.kullaniciAdi?.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <div className="comment-form-title">{replyingTo ? 'Yanıtınızı yazın' : 'Düşüncelerinizi paylaşın'}</div>
                      <div className="comment-form-subtitle">{replyingTo ? `${replyingTo.kullaniciAdi} adlı kullanıcının yorumuna yanıt verin` : `Bu ${icerik.tur === 'Film' ? 'film' : icerik.tur === 'Dizi' ? 'dizi' : 'kitap'} hakkında ne düşünüyorsunuz?`}</div>
                    </div>
                  </div>

                  <textarea
                    className="comment-textarea"
                    placeholder={replyingTo ? 'Yanıtınızı yazın...' : 'Yorumunuzu yazın...'}
                    value={yorumText}
                    onChange={(e) => setYorumText(e.target.value)}
                    rows={4}
                    style={{
                      backgroundColor: 'rgba(15, 15, 20, 0.9)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--glass-border)'
                    }}
                  />

                  <div className="comment-form-options">
                    <div className="form-options-left">
                      {/* Yanıtlarda puan verme yok */}
                      {!replyingTo && (
                        <div className="form-rating">
                          <span className="form-rating-label">Puan:</span>
                          <div className="form-stars">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                              <button
                                key={star}
                                type="button"
                                className={`star ${yorumPuan >= star ? 'active' : ''}`}
                                onClick={() => setYorumPuan(star)}
                              >
                                <span className="material-symbols-rounded">star</span>
                              </button>
                            ))}
                          </div>
                          {yorumPuan > 0 && <span style={{ marginLeft: '8px', color: 'var(--gold-primary)' }}>{yorumPuan}/10</span>}
                        </div>
                      )}

                      <label className="spoiler-toggle">
                        <input
                          type="checkbox"
                          className="spoiler-checkbox"
                          checked={spoilerIceriyor}
                          onChange={(e) => setSpoilerIceriyor(e.target.checked)}
                        />
                        <span className="spoiler-checkmark">
                          <span className="material-symbols-rounded">check</span>
                        </span>
                        Spoiler içeriyor
                      </label>
                    </div>

                    <button 
                      className="submit-comment-btn"
                      onClick={handleCommentSubmit}
                      disabled={yorumLoading || !yorumText.trim()}
                    >
                      <span className="material-symbols-rounded">send</span>
                      {replyingTo ? 'Yanıtla' : 'Gönder'}
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                {yorumlar.length > 0 ? (
                  <>
                    {(showAllComments ? yorumlar : yorumlar.slice(0, 3)).map((yorum) => (
                      <CommentPreview 
                        key={yorum.id} 
                        yorum={yorum}
                        onLike={handleLikeComment}
                        onDelete={user?.id === yorum.kullaniciId ? handleDeleteComment : undefined}
                        onReply={handleReplyClick}
                        isExpanded={expandedComments.has(yorum.id)}
                        onToggleExpand={() => {
                          setExpandedComments(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(yorum.id)) newSet.delete(yorum.id);
                            else newSet.add(yorum.id);
                            return newSet;
                          });
                        }}
                        isSpoilerRevealed={revealedSpoilers.has(yorum.id)}
                        onToggleSpoiler={() => {
                          setRevealedSpoilers(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(yorum.id)) newSet.delete(yorum.id);
                            else newSet.add(yorum.id);
                            return newSet;
                          });
                        }}
                      />
                    ))}
                    {yorumlar.length > 3 && (
                      <button 
                        className="show-more-btn"
                        onClick={() => setShowAllComments(!showAllComments)}
                      >
                        {showAllComments ? (
                          <>
                            <span className="material-symbols-rounded">expand_less</span>
                            Daha az göster
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-rounded">expand_more</span>
                            Tüm yorumları gör ({yorumlar.length - 3} daha)
                          </>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="sidebar-card" style={{ textAlign: 'center', padding: '40px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--text-muted)', marginBottom: '16px', display: 'block' }}>
                      chat_bubble_outline
                    </span>
                    <p style={{ color: 'var(--text-muted)' }}>Henüz yorum yapılmamış. İlk yorumu siz yapın!</p>
                  </div>
                )}
              </div>

              {/* Listeler Tab */}
              <div className={`tab-content ${activeTab === 'listeler' ? 'active' : ''}`}>
                {listeler.length > 0 ? (
                  listeler.map((liste) => (
                    <ListPreview key={liste.id} liste={liste} />
                  ))
                ) : (
                  <div className="sidebar-card" style={{ textAlign: 'center', padding: '40px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--text-muted)', marginBottom: '16px', display: 'block' }}>
                      playlist_add
                    </span>
                    <p style={{ color: 'var(--text-muted)' }}>Bu içerik henüz hiçbir listede yok.</p>
                  </div>
                )}
              </div>

              {/* Aktiviteler Tab */}
              <div className={`tab-content ${activeTab === 'aktiviteler' ? 'active' : ''}`}>
                {aktiviteler.filter(a => (a.aktiviteTuru || a.aktiviteTipiStr || '').toLowerCase() !== 'yorum').length > 0 ? (
                  <div className="detail-aktiviteler-list">
                    {aktiviteler
                      .filter(a => (a.aktiviteTuru || a.aktiviteTipiStr || '').toLowerCase() !== 'yorum')
                      .map((aktivite, index) => (
                      <FeedActivityCard 
                        key={aktivite.id} 
                        aktivite={aktivite}
                        isLoggedIn={!!user}
                        index={index}
                        currentUserName={user?.kullaniciAdi}
                        compact={true}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="sidebar-card" style={{ textAlign: 'center', padding: '40px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--text-muted)', marginBottom: '16px', display: 'block' }}>
                      history
                    </span>
                    <p style={{ color: 'var(--text-muted)' }}>Henüz aktivite yok.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Sidebar */}
          <aside className="sidebar-column">
            {/* Film Info */}
            <div className="sidebar-card">
              <h4 className="sidebar-title">
                <span className="material-symbols-rounded">info</span>
                Bilgiler
              </h4>
              <div className="info-list">
                {icerik.yayinTarihi && (
                  <div className="info-item">
                    <span className="info-label">Yayın Tarihi</span>
                    <span className="info-value">
                      {new Date(icerik.yayinTarihi).toLocaleDateString('tr-TR', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </span>
                  </div>
                )}
                {icerik.sure && icerik.sure > 0 && (
                  <div className="info-item">
                    <span className="info-label">Süre</span>
                    <span className="info-value">{formatDuration(icerik.sure)}</span>
                  </div>
                )}
                {icerik.yonetmen && (
                  <div className="info-item">
                    <span className="info-label">Yönetmen</span>
                    <span className="info-value">{icerik.yonetmen}</span>
                  </div>
                )}
                {icerik.yazarlar && icerik.yazarlar.length > 0 && (
                  <div className="info-item">
                    <span className="info-label">Yazar</span>
                    <span className="info-value">{icerik.yazarlar.join(', ')}</span>
                  </div>
                )}
                {icerik.sayfaSayisi && icerik.sayfaSayisi > 0 && (
                  <div className="info-item">
                    <span className="info-label">Sayfa Sayısı</span>
                    <span className="info-value">{icerik.sayfaSayisi.toLocaleString('tr-TR')}</span>
                  </div>
                )}
                {icerik.yayinevi && (
                  <div className="info-item">
                    <span className="info-label">Yayınevi</span>
                    <span className="info-value">{icerik.yayinevi}</span>
                  </div>
                )}
                {icerik.isbn && (
                  <div className="info-item">
                    <span className="info-label">ISBN</span>
                    <span className="info-value">{icerik.isbn}</span>
                  </div>
                )}
                {icerik.sezonSayisi && icerik.sezonSayisi > 0 && (
                  <div className="info-item">
                    <span className="info-label">Sezon</span>
                    <span className="info-value">{icerik.sezonSayisi}</span>
                  </div>
                )}
                {icerik.bolumSayisi && icerik.bolumSayisi > 0 && (
                  <div className="info-item">
                    <span className="info-label">Bölüm</span>
                    <span className="info-value">{icerik.bolumSayisi}</span>
                  </div>
                )}
                {icerik.kategoriler && icerik.kategoriler.length > 0 && (
                  <div className="info-item">
                    <span className="info-label">Kategoriler</span>
                    <span className="info-value">{icerik.kategoriler.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* External Links */}
            <div className="sidebar-card">
              <h4 className="sidebar-title">
                <span className="material-symbols-rounded">link</span>
                Bağlantılar
              </h4>
              <div className="external-links">
                {icerik.hariciId && icerik.apiKaynagi === 'tmdb' && (
                  <a 
                    href={`https://www.themoviedb.org/movie/${icerik.hariciId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link link-tmdb"
                  >
                    <span className="material-symbols-rounded">database</span>
                    TMDB
                    <span className="material-symbols-rounded link-icon">open_in_new</span>
                  </a>
                )}
                {/* IMDb & YouTube - Only for films and TV shows */}
                {(icerik.tur === 'Film' || icerik.tur === 'Dizi') && (
                  <>
                    <a 
                      href={`https://www.imdb.com/find?q=${encodeURIComponent(icerik.baslik)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-link link-imdb"
                    >
                      <span className="material-symbols-rounded">movie</span>
                      IMDb
                      <span className="material-symbols-rounded link-icon">open_in_new</span>
                    </a>
                    <a 
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(icerik.baslik + ' trailer')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-link link-youtube"
                    >
                      <span className="material-symbols-rounded">play_circle</span>
                      YouTube
                      <span className="material-symbols-rounded link-icon">open_in_new</span>
                    </a>
                  </>
                )}
                {/* Google Books & Google Search - Only for books */}
                {icerik.tur === 'Kitap' && (
                  <>
                    {icerik.hariciId && (
                      <a 
                        href={`https://books.google.com/books?id=${icerik.hariciId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link link-google-books"
                      >
                        <span className="material-symbols-rounded">menu_book</span>
                        Google Books
                        <span className="material-symbols-rounded link-icon">open_in_new</span>
                      </a>
                    )}
                    <a 
                      href={`https://www.google.com/search?q=${encodeURIComponent(icerik.baslik + (icerik.yonetmen ? ' ' + icerik.yonetmen : '') + ' kitap')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-link link-google"
                    >
                      <span className="material-symbols-rounded">search</span>
                      Google'da Ara
                      <span className="material-symbols-rounded link-icon">open_in_new</span>
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Where to Watch - Only for films and TV shows */}
            {(icerik.tur === 'Film' || icerik.tur === 'Dizi') && (
              <div className="sidebar-card">
                <h4 className="sidebar-title">
                  <span className="material-symbols-rounded">live_tv</span>
                  Nereden İzlenir?
                </h4>
                <div className="providers-list">
                  <a 
                    href={`https://www.netflix.com/search?q=${encodeURIComponent(icerik.baslik)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="provider-badge"
                  >
                    <img src="https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" alt="Netflix" />
                    Netflix
                  </a>
                  <a 
                    href={`https://www.primevideo.com/search?phrase=${encodeURIComponent(icerik.baslik)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="provider-badge"
                  >
                    <img src="https://image.tmdb.org/t/p/original/emthp39XA2YScoYL1p0sdbAH2WA.jpg" alt="Amazon Prime Video" />
                    Prime Video
                  </a>
                  <a 
                    href={`https://www.disneyplus.com/search?q=${encodeURIComponent(icerik.baslik)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="provider-badge"
                  >
                    <img src="https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg" alt="Disney+" />
                    Disney+
                  </a>
                  <a 
                    href={`https://tv.apple.com/search?term=${encodeURIComponent(icerik.baslik)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="provider-badge"
                  >
                    <img src="https://image.tmdb.org/t/p/original/9ghgSC0MA082EL6HLCW3GalykFD.jpg" alt="Apple TV+" />
                    Apple TV
                  </a>
                  <a 
                    href={`https://www.justwatch.com/tr/search?q=${encodeURIComponent(icerik.baslik)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="provider-badge provider-all"
                  >
                    <span className="material-symbols-rounded">search</span>
                    Tümünde Ara
                  </a>
                </div>
              </div>
            )}

            {/* Similar Content */}
            {similarContent.length > 0 && (
              <div className="sidebar-card">
                <h4 className="sidebar-title">
                  <span className="material-symbols-rounded">auto_awesome</span>
                  Benzer İçerikler
                </h4>
                <div className="similar-grid">
                  {similarContent.slice(0, 4).map((item) => (
                    <ContentCard
                      key={item.id}
                      data={icerikToCardData(item)}
                      size="sm"
                      showBadge={true}
                      showRatings={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

// ============================================
// REPLY ITEM COMPONENT (Ana yorumlarla aynı stil)
// ============================================

interface ReplyItemProps {
  yanit: Yorum;
  onLike: (yorumId: number) => void;
  onReply?: (yorum: Yorum) => void;
}

function ReplyItem({ yanit, onLike, onReply }: ReplyItemProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  
  const replyText = yanit.icerik || yanit.icerikOzet || '';
  const isLong = replyText.length > 200;
  
  const tarihStr = formatDistanceToNow(new Date(yanit.olusturulmaZamani), {
    addSuffix: true,
    locale: tr,
  });
  
  return (
    <div className="comment-preview reply-item">
      <div className="comment-header">
        <img 
          src={yanit.kullaniciAvatar || `https://ui-avatars.com/api/?name=${yanit.kullaniciAdi}&background=d4a853&color=030304`}
          alt={yanit.kullaniciAdi}
          className="comment-avatar"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/profil/${yanit.kullaniciAdi}`)}
        />
        <div className="comment-user-info">
          <div 
            className="comment-username" 
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/profil/${yanit.kullaniciAdi}`)}
          >
            {yanit.kullaniciAdi}
          </div>
          <div className="comment-date">{tarihStr}</div>
        </div>
      </div>

      {/* Spoiler veya İçerik */}
      {yanit.spoilerIceriyor && !spoilerRevealed ? (
        <div 
          className="spoiler-warning" 
          onClick={() => setSpoilerRevealed(true)}
          style={{ cursor: 'pointer', marginBottom: '0', marginTop: '8px' }}
        >
          <span className="material-symbols-rounded">warning</span>
          Spoiler içeriyor - görmek için tıklayın
        </div>
      ) : (
        <>
          {yanit.spoilerIceriyor && (
            <button 
              className="spoiler-hide-btn"
              onClick={() => setSpoilerRevealed(false)}
              style={{ marginTop: '8px', marginBottom: '4px' }}
            >
              <span className="material-symbols-rounded">visibility_off</span>
              Spoiler'ı gizle
            </button>
          )}
          <p className={`comment-text ${isLong && !expanded ? 'truncated' : ''}`} style={{ marginTop: yanit.spoilerIceriyor ? '4px' : '8px' }}>
            {isLong && !expanded ? replyText.slice(0, 200) + '...' : replyText}
          </p>
          {isLong && (
            <button 
              className="comment-expand-btn"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Daha az göster' : 'Devamını oku'}
              <span className="material-symbols-rounded">
                {expanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          )}
        </>
      )}

      <div className="comment-actions">
        <button 
          className={`comment-action-btn ${yanit.kullaniciBegendiMi ? 'liked' : ''}`}
          onClick={() => onLike(yanit.id)}
        >
          <span 
            className="material-symbols-rounded" 
            style={{ fontVariationSettings: yanit.kullaniciBegendiMi ? "'FILL' 1" : "'FILL' 0" }}
          >
            favorite
          </span>
          {yanit.begeniSayisi || 0}
        </button>
        <button 
          className="comment-action-btn"
          onClick={() => onReply?.(yanit)}
        >
          <span className="material-symbols-rounded">reply</span>
          Yanıtla
        </button>
      </div>
    </div>
  );
}

// ============================================
// COMMENT PREVIEW COMPONENT
// ============================================

interface CommentPreviewProps {
  yorum: Yorum;
  onLike: (yorumId: number) => void;
  onDelete?: (yorumId: number) => void;
  onReply?: (yorum: Yorum) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isSpoilerRevealed: boolean;
  onToggleSpoiler: () => void;
}

function CommentPreview({ yorum, onLike, onDelete, onReply, isExpanded, onToggleExpand, isSpoilerRevealed, onToggleSpoiler }: CommentPreviewProps) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  
  // Yanıtlar için limit
  const REPLY_LIMIT = 2;
  const hasMoreReplies = (yorum.yanitlar?.length || 0) > REPLY_LIMIT;
  const visibleReplies = showAllReplies 
    ? yorum.yanitlar 
    : yorum.yanitlar?.slice(0, REPLY_LIMIT);
  
  // Önce tam içeriği (icerik), yoksa özeti kullan
  const commentText = yorum.icerik || yorum.icerikOzet || '';
  const isLongComment = commentText.length > 250;

  const tarihStr = formatDistanceToNow(new Date(yorum.olusturulmaZamani), {
    addSuffix: true,
    locale: tr,
  });

  return (
    <div className="comment-preview" id={`yorum-${yorum.id}`}>
      <div className="comment-header">
        <img 
          src={yorum.kullaniciAvatar || `https://ui-avatars.com/api/?name=${yorum.kullaniciAdi}&background=d4a853&color=030304`}
          alt={yorum.kullaniciAdi}
          className="comment-avatar"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/profil/${yorum.kullaniciAdi}`)}
        />
        <div className="comment-user-info">
          <div 
            className="comment-username" 
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/profil/${yorum.kullaniciAdi}`)}
          >
            {yorum.kullaniciAdi}
          </div>
          <div className="comment-date">{tarihStr}</div>
        </div>
        {yorum.puan && (
          <div className="comment-rating">
            <span className="material-symbols-rounded filled">star</span>
            {yorum.puan}
          </div>
        )}
        
        {/* Delete Menu */}
        {onDelete && (
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <span className="material-symbols-rounded">more_horiz</span>
            </button>
            
            {showMenu && (
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
                  onClick={() => setShowMenu(false)} 
                />
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  background: 'var(--void-surface)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  zIndex: 50,
                  minWidth: '120px',
                }}>
                  <button
                    onClick={() => {
                      onDelete(yorum.id);
                      setShowMenu(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--error)',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    <span className="material-symbols-rounded">delete</span>
                    Sil
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Spoiler Warning */}
      {yorum.spoilerIceriyor && !isSpoilerRevealed ? (
        <div 
          className="spoiler-warning" 
          onClick={onToggleSpoiler}
          style={{ cursor: 'pointer', marginBottom: '0' }}
        >
          <span className="material-symbols-rounded">warning</span>
          Spoiler içeriyor - görmek için tıklayın
        </div>
      ) : (
        <>
          {yorum.spoilerIceriyor && (
            <button 
              className="spoiler-hide-btn"
              onClick={onToggleSpoiler}
            >
              <span className="material-symbols-rounded">visibility_off</span>
              Spoiler'ı gizle
            </button>
          )}
          <p className={`comment-text ${isLongComment && !isExpanded ? 'truncated' : ''}`}>
            {isLongComment && !isExpanded 
              ? commentText.slice(0, 250) + '...' 
              : commentText
            }
          </p>
          {isLongComment && (
            <button 
              className="comment-expand-btn"
              onClick={onToggleExpand}
            >
              {isExpanded ? 'Daha az göster' : 'Devamını oku'}
              <span className="material-symbols-rounded">
                {isExpanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          )}
        </>
      )}

      <div className="comment-actions">
        <button 
          className={`comment-action-btn ${yorum.kullaniciBegendiMi ? 'liked' : ''}`}
          onClick={() => onLike(yorum.id)}
        >
          <span 
            className="material-symbols-rounded" 
            style={{ fontVariationSettings: yorum.kullaniciBegendiMi ? "'FILL' 1" : "'FILL' 0" }}
          >
            favorite
          </span>
          {yorum.begeniSayisi}
        </button>
        <button 
          className="comment-action-btn"
          onClick={() => onReply?.(yorum)}
        >
          <span className="material-symbols-rounded">reply</span>
          Yanıtla
        </button>
      </div>

      {/* Yanıtlar */}
      {yorum.yanitlar && yorum.yanitlar.length > 0 && (
        <div className="comment-replies">
          {visibleReplies?.map((yanit) => (
            <ReplyItem 
              key={yanit.id} 
              yanit={yanit} 
              onLike={onLike} 
              onReply={onReply} 
            />
          ))}
          {hasMoreReplies && (
            <button 
              className="show-more-replies-btn"
              onClick={() => setShowAllReplies(!showAllReplies)}
            >
              <span className="material-symbols-rounded">
                {showAllReplies ? 'expand_less' : 'expand_more'}
              </span>
              {showAllReplies 
                ? 'Yanıtları gizle' 
                : `${(yorum.yanitlar?.length || 0) - REPLY_LIMIT} yanıt daha göster`
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// LIST PREVIEW COMPONENT
// ============================================

interface ListPreviewProps {
  liste: Liste;
}

function ListPreview({ liste }: ListPreviewProps) {
  const navigate = useNavigate();

  return (
    <div 
      className="list-preview"
      onClick={() => navigate(`/liste/${liste.id}`)}
    >
      <div className="list-posters">
        {/* TODO: Show list content posters */}
        <div className="list-poster" style={{ 
          background: 'var(--void-surface)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginLeft: 0 
        }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--text-muted)' }}>movie</span>
        </div>
      </div>
      <div className="list-info">
        <div className="list-title">{liste.ad}</div>
        <div className="list-meta">{liste.icerikSayisi || 0} içerik</div>
        <div className="list-creator">
          <img 
            src={`https://ui-avatars.com/api/?name=${liste.kullaniciAdi}&background=d4a853&color=030304&size=20`}
            alt={liste.kullaniciAdi}
          />
          {liste.kullaniciAdi}
        </div>
      </div>
    </div>
  );
}
