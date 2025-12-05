import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  BookOpen,
  Film,
  Tv,
  ArrowUpDown,
  Filter,
  Grid3X3,
  List as ListIcon,
  CheckCircle,
  PlayCircle,
  Clock,
  Layers,
  ChevronDown,
  Plus,
  Flame,
  Lock,
  Globe,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { kutuphaneApi, listeApi, kullaniciApi } from "../../services/api";
import type { KutuphaneDurumu, Liste } from "../../services/api";
import { ContentCard, kutuphaneToCardData } from "../../components/ui/ContentCard";
import {
  getKutuphaneCache,
  setKutuphaneCache,
  getListelerCache,
  setListelerCache,
  getTakipciSayisiCache,
  setTakipciSayisiCache,
} from "../../services/libraryCache";
import "./LibraryPage.css";

// ============================================
// TYPES
// ============================================

type FilterStatus = "tumu" | "watching" | "completed" | "planned";
type FilterType = "tumu" | "film" | "dizi" | "kitap";
type ViewMode = "grid" | "list";
type SortOption = "son_eklenen" | "puan" | "isim" | "yil";

// ============================================
// MAIN COMPONENT
// ============================================

export default function LibraryPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [kutuphane, setKutuphane] = useState<KutuphaneDurumu[]>([]);
  const [listeler, setListeler] = useState<Liste[]>([]);
  const [takipciSayisi, setTakipciSayisi] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("tumu");
  const [filterType, setFilterType] = useState<FilterType>("tumu");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("son_eklenen");
  
  // Liste oluşturma modal
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [newListeName, setNewListeName] = useState("");
  const [newListeAciklama, setNewListeAciklama] = useState("");
  const [newListeHerkeseAcik, setNewListeHerkeseAcik] = useState(false);
  const [creatingListe, setCreatingListe] = useState(false);
  
  // Çift yükleme önleme
  const isDataLoadedRef = useRef(false);

  // Kütüphane yükle (cache destekli)
  const fetchKutuphane = useCallback(async (userId: string, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getKutuphaneCache(userId);
      if (cached) {
        setKutuphane(cached);
        return cached;
      }
    }
    
    try {
      const data = await kutuphaneApi.getKutuphane(userId);
      setKutuphaneCache(userId, data);
      setKutuphane(data);
      return data;
    } catch (error) {
      console.error("Kütüphane yüklenirken hata:", error);
      return [];
    }
  }, []);

  // Listeler yükle (cache destekli)
  const fetchListeler = useCallback(async (userId: string, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getListelerCache(userId);
      if (cached) {
        setListeler(cached);
        return cached;
      }
    }
    
    try {
      const data = await listeApi.getMyListeler();
      setListelerCache(userId, data);
      setListeler(data);
      return data;
    } catch (error) {
      console.error("Listeler yüklenirken hata:", error);
      return [];
    }
  }, []);

  // Takipçi sayısı yükle (cache destekli)
  const fetchTakipciSayisi = useCallback(async (userId: string, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getTakipciSayisiCache(userId);
      if (cached !== null) {
        setTakipciSayisi(cached);
        return cached;
      }
    }
    
    try {
      const data = await kullaniciApi.getTakipciler(userId);
      const count = data.length;
      setTakipciSayisiCache(userId, count);
      setTakipciSayisi(count);
      return count;
    } catch (error) {
      console.error("Takipçi sayısı yüklenirken hata:", error);
      return 0;
    }
  }, []);

  // İlk yükleme - lazy loading ile
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    
    // Çift yükleme önle
    if (isDataLoadedRef.current) return;
    isDataLoadedRef.current = true;

    const loadData = async () => {
      // Önce cache'den hızlıca yükle
      const cachedKutuphane = getKutuphaneCache(user.id);
      const cachedListeler = getListelerCache(user.id);
      const cachedTakipci = getTakipciSayisiCache(user.id);
      
      if (cachedKutuphane && cachedListeler && cachedTakipci !== null) {
        // Tüm cache mevcut - hemen göster
        setKutuphane(cachedKutuphane);
        setListeler(cachedListeler);
        setTakipciSayisi(cachedTakipci);
        setLoading(false);
        
        // Arka planda güncelle
        Promise.all([
          fetchKutuphane(user.id, true),
          fetchListeler(user.id, true),
          fetchTakipciSayisi(user.id, true),
        ]).catch(console.error);
      } else {
        // Cache yok - normal yükle
        setLoading(true);
        await Promise.all([
          fetchKutuphane(user.id),
          fetchListeler(user.id),
          fetchTakipciSayisi(user.id),
        ]);
        setLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated, user?.id, fetchKutuphane, fetchListeler, fetchTakipciSayisi]);

  // Liste oluştur
  const handleCreateListe = async () => {
    if (!newListeName.trim() || !user?.id) return;
    
    setCreatingListe(true);
    try {
      const yeniListe = await listeApi.create({
        ad: newListeName.trim(),
        aciklama: newListeAciklama.trim() || undefined,
        herkeseAcik: newListeHerkeseAcik,
      });
      const updatedListeler = [yeniListe, ...listeler];
      setListeler(updatedListeler);
      setListelerCache(user.id, updatedListeler);
      setShowCreateListModal(false);
      setNewListeName("");
      setNewListeAciklama("");
      setNewListeHerkeseAcik(false);
    } catch (err) {
      console.error("Liste oluşturulurken hata:", err);
    } finally {
      setCreatingListe(false);
    }
  };

  // İstatistikler
  const stats = {
    total: kutuphane.length,
    watching: kutuphane.filter((i) => 
      i.durum === "devam_ediyor" || i.durum === "izleniyor" || i.durum === "okunuyor"
    ).length,
    completed: kutuphane.filter((i) => 
      i.durum === "izlendi" || i.durum === "okundu" || i.durum === "tamamlandi"
    ).length,
    planned: kutuphane.filter((i) => 
      i.durum === "izlenecek" || i.durum === "okunacak" || i.durum === "beklemede"
    ).length,
    film: kutuphane.filter((i) => (i.tur || i.icerikTur) === "film").length,
    dizi: kutuphane.filter((i) => (i.tur || i.icerikTur) === "dizi").length,
    kitap: kutuphane.filter((i) => (i.tur || i.icerikTur) === "kitap").length,
  };

  // Filtreleme
  const filteredItems = kutuphane.filter((item) => {
    // Status filter
    if (filterStatus === "watching" && 
        !(item.durum === "devam_ediyor" || item.durum === "izleniyor" || item.durum === "okunuyor")) {
      return false;
    }
    if (filterStatus === "completed" && 
        !(item.durum === "izlendi" || item.durum === "okundu" || item.durum === "tamamlandi")) {
      return false;
    }
    if (filterStatus === "planned" && 
        !(item.durum === "izlenecek" || item.durum === "okunacak" || item.durum === "beklemede")) {
      return false;
    }

    // Type filter
    if (filterType !== "tumu") {
      const itemType = item.tur || item.icerikTur;
      if (itemType !== filterType) return false;
    }

    return true;
  });

  // Sıralama
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case "puan":
        return (b.ortalamaPuan || 0) - (a.ortalamaPuan || 0);
      case "isim":
        return (a.baslik || a.icerikAdi || "").localeCompare(b.baslik || b.icerikAdi || "");
      case "yil":
        const yearA = a.icerik?.yayinTarihi ? new Date(a.icerik.yayinTarihi).getFullYear() : 0;
        const yearB = b.icerik?.yayinTarihi ? new Date(b.icerik.yayinTarihi).getFullYear() : 0;
        return yearB - yearA;
      case "son_eklenen":
      default:
        return new Date(b.guncellemeZamani || b.olusturulmaZamani || 0).getTime() - 
               new Date(a.guncellemeZamani || a.olusturulmaZamani || 0).getTime();
    }
  });

  // Login gerekliyse
  if (!isAuthenticated) {
    return (
      <div className="library-page">
        <div className="library-empty-state">
          <BookOpen className="library-empty-state-icon" />
          <h2 className="library-empty-state-title">Giriş Yapmalısınız</h2>
          <p className="library-empty-state-text">
            Kütüphanenizi görüntülemek için giriş yapın.
          </p>
          <button 
            className="library-empty-state-btn"
            onClick={() => navigate("/giris")}
          >
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="library-page">
      {/* Profile Summary */}
      <div className="library-profile-card">
        <div className="library-profile-avatar">
          <img 
            src={user?.profilResmi || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.kullaniciAdi || 'U')}&background=d4a853&color=030304`} 
            alt="Profil" 
          />
        </div>
        <div className="library-profile-info">
          <h2 className="library-profile-name">{user?.kullaniciAdi}</h2>
          <span className="library-profile-username">@{user?.kullaniciAdi}</span>
          <div className="library-profile-stats">
            <div className="library-stat-item">
              <div className="library-stat-value">{stats.completed}</div>
              <div className="library-stat-label">İzlenen</div>
            </div>
            <div className="library-stat-item">
              <div className="library-stat-value">{listeler.length}</div>
              <div className="library-stat-label">Liste</div>
            </div>
            <div className="library-stat-item">
              <div className="library-stat-value">{takipciSayisi}</div>
              <div className="library-stat-label">Takipçi</div>
            </div>
          </div>
        </div>
        <Link to={`/profil/${user?.kullaniciAdi}`} className="library-profile-action">Profili Gör</Link>
      </div>

      {/* Quick Stats */}
      <div className="library-quick-stats">
        <div className="library-stats-grid">
          <div 
            className={`library-stat-card ${filterStatus === "watching" ? "active" : ""}`}
            onClick={() => setFilterStatus(filterStatus === "watching" ? "tumu" : "watching")}
          >
            <div className="library-stat-card-icon watching">
              <PlayCircle size={18} />
            </div>
            <div className="library-stat-card-value">{stats.watching}</div>
            <div className="library-stat-card-label">Devam Ediyor</div>
          </div>
          <div 
            className={`library-stat-card ${filterStatus === "completed" ? "active" : ""}`}
            onClick={() => setFilterStatus(filterStatus === "completed" ? "tumu" : "completed")}
          >
            <div className="library-stat-card-icon completed">
              <CheckCircle size={18} />
            </div>
            <div className="library-stat-card-value">{stats.completed}</div>
            <div className="library-stat-card-label">Tamamlandı</div>
          </div>
          <div 
            className={`library-stat-card ${filterStatus === "planned" ? "active" : ""}`}
            onClick={() => setFilterStatus(filterStatus === "planned" ? "tumu" : "planned")}
          >
            <div className="library-stat-card-icon planned">
              <Clock size={18} />
            </div>
            <div className="library-stat-card-value">{stats.planned}</div>
            <div className="library-stat-card-label">Beklemede</div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="library-content-tabs">
        <button 
          className={`library-content-tab ${filterType === "tumu" ? "active" : ""}`}
          onClick={() => setFilterType("tumu")}
        >
          <Layers size={16} />
          Tümü
          <span className="count">{stats.total}</span>
        </button>
        <button 
          className={`library-content-tab ${filterType === "film" ? "active" : ""}`}
          onClick={() => setFilterType("film")}
        >
          <Film size={16} />
          Filmler
          <span className="count">{stats.film}</span>
        </button>
        <button 
          className={`library-content-tab ${filterType === "dizi" ? "active" : ""}`}
          onClick={() => setFilterType("dizi")}
        >
          <Tv size={16} />
          Diziler
          <span className="count">{stats.dizi}</span>
        </button>
        <button 
          className={`library-content-tab ${filterType === "kitap" ? "active" : ""}`}
          onClick={() => setFilterType("kitap")}
        >
          <BookOpen size={16} />
          Kitaplar
          <span className="count">{stats.kitap}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="library-filter-bar">
        <div className="library-filter-left">
          <button 
            className="library-filter-dropdown"
            onClick={() => {
              // Sıralama seçeneklerini döngüsel olarak değiştir
              const options: SortOption[] = ["son_eklenen", "puan", "isim", "yil"];
              const currentIndex = options.indexOf(sortBy);
              const nextIndex = (currentIndex + 1) % options.length;
              setSortBy(options[nextIndex]);
            }}
          >
            <ArrowUpDown size={16} />
            {sortBy === "son_eklenen" && "Son Eklenen"}
            {sortBy === "puan" && "Puana Göre"}
            {sortBy === "isim" && "İsme Göre"}
            {sortBy === "yil" && "Yıla Göre"}
            <ChevronDown size={16} />
          </button>
          <button className="library-filter-dropdown">
            <Filter size={16} />
            Filtrele
          </button>
        </div>
        <div className="library-view-toggle">
          <button 
            className={`library-view-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 size={18} />
          </button>
          <button 
            className={`library-view-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={`library-content-grid ${viewMode === "list" ? "list-view" : ""}`}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="library-content-card">
              <div className="library-content-poster library-skeleton library-skeleton-poster" />
              <div className="library-content-info">
                <div className="library-skeleton library-skeleton-text" />
                <div className="library-skeleton library-skeleton-text short" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedItems.length > 0 ? (
        <div className={`library-content-grid ${viewMode === "list" ? "list-view" : ""}`}>
          {sortedItems.map((item) => {
            const cardData = kutuphaneToCardData(item);
            
            return (
              <ContentCard
                key={item.id || item.icerikId}
                data={cardData}
                showStatus={true}
                showBadge={true}
                showRatings={true}
                className="library-card"
              />
            );
          })}
        </div>
      ) : (
        <div className="library-empty-state">
          <BookOpen className="library-empty-state-icon" />
          <h2 className="library-empty-state-title">Kütüphaneniz Boş</h2>
          <p className="library-empty-state-text">
            Film, dizi veya kitap aramaya başlayın ve kütüphanenize ekleyin.
          </p>
          <button 
            className="library-empty-state-btn"
            onClick={() => navigate("/kesfet")}
          >
            Keşfet
          </button>
        </div>
      )}

      {/* Section Divider */}
      {sortedItems.length > 0 && (
        <>
          <div className="library-section-divider" />

          {/* My Lists Section */}
          <section className="library-my-lists-section">
            <div className="library-section-header">
              <h2 className="library-section-title">Listelerim</h2>
              <button 
                className="library-section-action"
                onClick={() => setShowCreateListModal(true)}
              >
                <Plus size={14} />
                Yeni Liste
              </button>
            </div>
            <div className="library-lists-grid">
              {/* Create New List Card */}
              <div 
                className="library-create-list-card"
                onClick={() => setShowCreateListModal(true)}
              >
                <div className="library-create-list-icon">
                  <Plus size={24} />
                </div>
                <span className="library-create-list-text">Yeni Liste Oluştur</span>
              </div>
              
              {/* Mevcut Listeler */}
              {listeler.map((liste) => (
                <div 
                  key={liste.id} 
                  className="library-list-card"
                  onClick={() => navigate(`/liste/${liste.id}/duzenle`)}
                >
                  <div className="library-list-card-cover">
                    {liste.icerikler && liste.icerikler.length > 0 ? (
                      <img 
                        src={liste.icerikler[0].posterUrl || ''} 
                        alt={liste.ad} 
                      />
                    ) : (
                      <div className="library-list-card-placeholder">
                        <Layers size={32} />
                      </div>
                    )}
                  </div>
                  <div className="library-list-card-info">
                    <h4 className="library-list-card-title">{liste.ad}</h4>
                    <div className="library-list-card-meta">
                      <span>{liste.icerikSayisi} içerik</span>
                      {liste.herkeseAcik ? (
                        <Globe size={12} />
                      ) : (
                        <Lock size={12} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>


          {/* Activity Summary */}
          <section className="library-activity-summary">
            <div className="library-section-header">
              <h2 className="library-section-title">Bu Ay</h2>
            </div>
            <div className="library-activity-cards">
              <div className="library-activity-card">
                <div className="library-activity-card-header">
                  <div className="library-activity-card-icon time">
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="library-activity-card-title">Tamamlanan</div>
                    <div className="library-activity-card-value">
                      {stats.completed} <small>içerik</small>
                    </div>
                  </div>
                </div>
                <div className="library-activity-chart">
                  {/* Son 7 günün aktivitesi - şimdilik statik */}
                  {[20, 40, 60, 30, 80, 50, stats.completed > 0 ? 100 : 20].map((height, i) => (
                    <div 
                      key={i}
                      className={`library-chart-bar ${i === 6 ? "active" : ""}`}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="library-activity-card">
                <div className="library-activity-card-header">
                  <div className="library-activity-card-icon streak">
                    <Flame size={20} />
                  </div>
                  <div>
                    <div className="library-activity-card-title">Kütüphane</div>
                    <div className="library-activity-card-value">
                      {stats.total} <small>içerik</small>
                    </div>
                    <div className="library-activity-card-subtitle">
                      {stats.watching > 0 && `${stats.watching} devam ediyor`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Liste Oluşturma Modal */}
      {showCreateListModal && (
        <div className="library-modal-overlay" onClick={() => setShowCreateListModal(false)}>
          <div className="library-modal" onClick={(e) => e.stopPropagation()}>
            <div className="library-modal-header">
              <h3>Yeni Liste Oluştur</h3>
              <button 
                className="library-modal-close"
                onClick={() => setShowCreateListModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="library-modal-body">
              <div className="library-modal-field">
                <label>Liste Adı</label>
                <input
                  type="text"
                  placeholder="Liste adını girin..."
                  value={newListeName}
                  onChange={(e) => setNewListeName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="library-modal-field">
                <label>Açıklama (Opsiyonel)</label>
                <textarea
                  placeholder="Liste açıklaması..."
                  value={newListeAciklama}
                  onChange={(e) => setNewListeAciklama(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="library-modal-field checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={newListeHerkeseAcik}
                    onChange={(e) => setNewListeHerkeseAcik(e.target.checked)}
                  />
                  <Globe size={16} />
                  Herkese Açık
                </label>
              </div>
            </div>
            <div className="library-modal-footer">
              <button 
                className="library-modal-btn cancel"
                onClick={() => setShowCreateListModal(false)}
              >
                İptal
              </button>
              <button 
                className="library-modal-btn create"
                onClick={handleCreateListe}
                disabled={!newListeName.trim() || creatingListe}
              >
                {creatingListe ? "Oluşturuluyor..." : "Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
