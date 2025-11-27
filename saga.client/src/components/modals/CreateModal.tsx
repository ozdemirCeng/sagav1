import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Search,
  List,
  Film,
  BookOpen,
  Star,
  Plus,
  Loader2,
  Check,
  Globe,
  Lock,
} from 'lucide-react';
import { icerikApi, listeApi } from '../../services/api';
import type { IcerikListItem } from '../../services/api';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'icerik' | 'liste';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function CreateModal({ isOpen, onClose }: CreateModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('icerik');
  
  // İçerik arama state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IcerikListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Liste oluşturma state
  const [listeAd, setListeAd] = useState('');
  const [listeAciklama, setListeAciklama] = useState('');
  const [listeHerkesaAcik, setListeHerkesaAcik] = useState(false);
  const [listeLoading, setListeLoading] = useState(false);
  const [listeSuccess, setListeSuccess] = useState(false);
  const [listeError, setListeError] = useState('');

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Arama fonksiyonu
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      const result = await icerikApi.ara(query, { limit: 10 });
      setSearchResults(result.data);
    } catch (err) {
      console.error('Arama hatası:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedSearch);
  }, [debouncedSearch, performSearch]);

  // Liste oluştur
  const handleCreateListe = async () => {
    if (!listeAd.trim()) {
      setListeError('Liste adı gereklidir.');
      return;
    }

    setListeLoading(true);
    setListeError('');
    
    try {
      const yeniListe = await listeApi.create({
        ad: listeAd,
        aciklama: listeAciklama || undefined,
        herkeseAcik: listeHerkesaAcik,
        tur: 'ozel',
      });
      
      setListeSuccess(true);
      setTimeout(() => {
        onClose();
        navigate(`/liste/${yeniListe.id}`);
      }, 1000);
    } catch (err) {
      console.error('Liste oluşturma hatası:', err);
      setListeError('Liste oluşturulurken bir hata oluştu.');
    } finally {
      setListeLoading(false);
    }
  };

  // İçeriğe git
  const handleContentClick = (item: IcerikListItem) => {
    onClose();
    navigate(`/icerik/${item.id}`);
  };

  // Modal kapandığında state'leri sıfırla
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('icerik');
      setSearchQuery('');
      setSearchResults([]);
      setListeAd('');
      setListeAciklama('');
      setListeHerkesaAcik(false);
      setListeSuccess(false);
      setListeError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="
        relative w-full max-w-lg mx-4
        bg-[rgba(20,20,35,0.95)]
        backdrop-blur-xl
        border border-[rgba(255,255,255,0.1)]
        rounded-2xl
        shadow-2xl
        max-h-[80vh]
        flex flex-col
        animate-scale-in
      ">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="text-lg font-semibold text-white">Yeni Oluştur</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-colors text-[rgba(255,255,255,0.6)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[rgba(255,255,255,0.08)]">
          <button
            onClick={() => setActiveTab('icerik')}
            className={`
              flex-1 px-4 py-3 flex items-center justify-center gap-2
              text-sm font-medium transition-colors
              ${activeTab === 'icerik' 
                ? 'text-white border-b-2 border-[#6C5CE7]' 
                : 'text-[rgba(255,255,255,0.5)] hover:text-white'
              }
            `}
          >
            <Search size={16} />
            İçerik Bul
          </button>
          <button
            onClick={() => setActiveTab('liste')}
            className={`
              flex-1 px-4 py-3 flex items-center justify-center gap-2
              text-sm font-medium transition-colors
              ${activeTab === 'liste' 
                ? 'text-white border-b-2 border-[#6C5CE7]' 
                : 'text-[rgba(255,255,255,0.5)] hover:text-white'
              }
            `}
          >
            <List size={16} />
            Liste Oluştur
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'icerik' && (
            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search 
                  size={18} 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)]" 
                />
                <input
                  type="text"
                  placeholder="Film, dizi veya kitap ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="
                    w-full pl-11 pr-4 py-3
                    rounded-xl
                    bg-[rgba(255,255,255,0.05)]
                    border border-[rgba(255,255,255,0.1)]
                    text-white text-sm
                    placeholder-[rgba(255,255,255,0.35)]
                    focus:outline-none focus:border-[#6C5CE7]
                    transition-all
                  "
                />
              </div>

              {/* Results */}
              <div className="space-y-2">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-[#6C5CE7]" />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleContentClick(item)}
                      className="
                        w-full p-3 rounded-xl
                        flex items-center gap-3
                        bg-[rgba(255,255,255,0.03)]
                        hover:bg-[rgba(255,255,255,0.08)]
                        transition-colors
                        text-left
                      "
                    >
                      {item.posterUrl ? (
                        <img 
                          src={item.posterUrl} 
                          alt={item.baslik}
                          className="w-12 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-16 rounded-lg bg-[rgba(255,255,255,0.1)] flex items-center justify-center">
                          {item.tur === 'kitap' ? <BookOpen size={20} /> : <Film size={20} />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.baslik}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[rgba(255,255,255,0.5)] capitalize">{item.tur}</span>
                          {item.yayinTarihi && (
                            <span className="text-xs text-[rgba(255,255,255,0.4)]">
                              {new Date(item.yayinTarihi).getFullYear()}
                            </span>
                          )}
                        </div>
                      </div>
                      {item.ortalamaPuan > 0 && (
                        <div className="flex items-center gap-1 text-[#FF9F0A]">
                          <Star size={14} className="fill-current" />
                          <span className="text-sm font-semibold">{item.ortalamaPuan.toFixed(1)}</span>
                        </div>
                      )}
                    </button>
                  ))
                ) : searchQuery && !searchLoading ? (
                  <div className="text-center py-8">
                    <p className="text-[rgba(255,255,255,0.5)]">Sonuç bulunamadı</p>
                    <button
                      onClick={() => {
                        onClose();
                        navigate(`/kesfet?q=${encodeURIComponent(searchQuery)}`);
                      }}
                      className="mt-3 text-sm text-[#6C5CE7] hover:underline"
                    >
                      Keşfet'te ara →
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[rgba(255,255,255,0.4)]">
                    <p>Film, dizi veya kitap aramaya başlayın</p>
                    <p className="text-sm mt-2">İçerik sayfasında puanlama ve yorum yapabilirsiniz</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'liste' && (
            <div className="space-y-4">
              {/* Liste Adı */}
              <div>
                <label className="block text-sm text-[rgba(255,255,255,0.7)] mb-2">
                  Liste Adı *
                </label>
                <input
                  type="text"
                  value={listeAd}
                  onChange={(e) => setListeAd(e.target.value)}
                  placeholder="Ör: İzlenecek Filmler"
                  className="
                    w-full px-4 py-3
                    rounded-xl
                    bg-[rgba(255,255,255,0.05)]
                    border border-[rgba(255,255,255,0.1)]
                    text-white text-sm
                    placeholder-[rgba(255,255,255,0.35)]
                    focus:outline-none focus:border-[#6C5CE7]
                    transition-all
                  "
                />
              </div>

              {/* Liste Açıklaması */}
              <div>
                <label className="block text-sm text-[rgba(255,255,255,0.7)] mb-2">
                  Açıklama
                </label>
                <textarea
                  value={listeAciklama}
                  onChange={(e) => setListeAciklama(e.target.value)}
                  placeholder="Bu liste hakkında kısa bir açıklama..."
                  rows={3}
                  className="
                    w-full px-4 py-3
                    rounded-xl
                    bg-[rgba(255,255,255,0.05)]
                    border border-[rgba(255,255,255,0.1)]
                    text-white text-sm
                    placeholder-[rgba(255,255,255,0.35)]
                    focus:outline-none focus:border-[#6C5CE7]
                    resize-none
                    transition-all
                  "
                />
              </div>

              {/* Gizlilik */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.03)]">
                <div className="flex items-center gap-3">
                  {listeHerkesaAcik ? (
                    <Globe size={20} className="text-[#00CEC9]" />
                  ) : (
                    <Lock size={20} className="text-[rgba(255,255,255,0.5)]" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {listeHerkesaAcik ? 'Herkese Açık' : 'Gizli Liste'}
                    </p>
                    <p className="text-xs text-[rgba(255,255,255,0.4)]">
                      {listeHerkesaAcik 
                        ? 'Herkes bu listeyi görebilir' 
                        : 'Sadece sen görebilirsin'
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setListeHerkesaAcik(!listeHerkesaAcik)}
                  className={`
                    w-12 h-6 rounded-full
                    transition-colors
                    ${listeHerkesaAcik 
                      ? 'bg-[#6C5CE7]' 
                      : 'bg-[rgba(255,255,255,0.2)]'
                    }
                    relative
                  `}
                >
                  <div className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white
                    transition-transform
                    ${listeHerkesaAcik ? 'right-1' : 'left-1'}
                  `} />
                </button>
              </div>

              {/* Error */}
              {listeError && (
                <p className="text-sm text-red-400">{listeError}</p>
              )}

              {/* Create Button */}
              <button
                onClick={handleCreateListe}
                disabled={listeLoading || !listeAd.trim() || listeSuccess}
                className="
                  w-full py-3 px-4
                  rounded-xl
                  bg-gradient-to-r from-[#6C5CE7] to-[#00CEC9]
                  text-white font-semibold
                  flex items-center justify-center gap-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  hover:shadow-lg hover:shadow-[#6C5CE7]/30
                  transition-all
                "
              >
                {listeLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : listeSuccess ? (
                  <>
                    <Check size={18} />
                    Liste Oluşturuldu!
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Liste Oluştur
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
