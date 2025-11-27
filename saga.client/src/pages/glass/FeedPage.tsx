import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Star,
  MessageCircle,
  Heart,
  Film,
  BookOpen,
  UserPlus,
  List,
  Play,
  Loader2,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  Tv,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { aktiviteApi } from '../../services/api';
import type { Aktivite, AktiviteYorum } from '../../services/api';

// ============================================
// NEBULA GLASS CARD COMPONENT
// ============================================
function NebulaCard({ 
  children, 
  className = '' 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={`
      p-5 rounded-2xl
      bg-[rgba(20,20,35,0.65)]
      backdrop-blur-xl
      border border-[rgba(255,255,255,0.08)]
      shadow-lg
      ${className}
    `}>
      {children}
    </div>
  );
}

// ============================================
// ACTIVITY CARD COMPONENT - NEBULA STYLE
// ============================================

interface ActivityCardProps {
  aktivite: Aktivite;
  isLoggedIn: boolean;
}

function ActivityCard({ aktivite, isLoggedIn }: ActivityCardProps) {
  const navigate = useNavigate();
  const { kullaniciAdi, kullaniciAvatar, aktiviteTuru, olusturulmaZamani, veri } = aktivite;
  
  // Beğeni state
  const [begeniSayisi, setBegeniSayisi] = useState(aktivite.begeniSayisi || 0);
  const [begendim, setBegendim] = useState(aktivite.begendim || false);
  const [begeniYukleniyor, setBegeniYukleniyor] = useState(false);
  
  // Yorum state
  const [yorumSayisi] = useState(aktivite.yorumSayisi || 0);
  const [yorumlarAcik, setYorumlarAcik] = useState(false);
  const [yorumlar, setYorumlar] = useState<AktiviteYorum[]>([]);
  const [yorumlarYukleniyor, setYorumlarYukleniyor] = useState(false);
  const [yeniYorum, setYeniYorum] = useState('');
  const [yorumGonderiliyor, setYorumGonderiliyor] = useState(false);
  const [yanitYapilan, setYanitYapilan] = useState<number | null>(null);

  // Aktivite beğeni fonksiyonu
  const handleBegeni = async () => {
    if (!isLoggedIn || begeniYukleniyor) return;
    
    setBegeniYukleniyor(true);
    try {
      const result = await aktiviteApi.toggleBegeni(aktivite.id);
      setBegeniSayisi(result.begeniSayisi);
      setBegendim(result.begendim);
    } catch (error) {
      console.error('Beğeni hatası:', error);
    } finally {
      setBegeniYukleniyor(false);
    }
  };

  // Yorumları yükle
  const loadYorumlar = async () => {
    if (yorumlarYukleniyor) return;
    
    setYorumlarYukleniyor(true);
    try {
      const result = await aktiviteApi.getYorumlar(aktivite.id);
      setYorumlar(result.data);
    } catch (error) {
      console.error('Yorumlar yüklenirken hata:', error);
    } finally {
      setYorumlarYukleniyor(false);
    }
  };

  // Yorum bölümünü aç/kapat
  const toggleYorumlar = () => {
    if (!yorumlarAcik && yorumlar.length === 0) {
      loadYorumlar();
    }
    setYorumlarAcik(!yorumlarAcik);
  };

  // Yorum gönder
  const handleYorumGonder = async () => {
    if (!isLoggedIn || !yeniYorum.trim() || yorumGonderiliyor) return;
    
    setYorumGonderiliyor(true);
    try {
      const yorum = await aktiviteApi.yorumEkle(aktivite.id, {
        icerik: yeniYorum.trim(),
        ustYorumId: yanitYapilan || undefined,
      });
      setYorumlar((prev) => [yorum, ...prev]);
      setYeniYorum('');
      setYanitYapilan(null);
    } catch (error) {
      console.error('Yorum gönderme hatası:', error);
    } finally {
      setYorumGonderiliyor(false);
    }
  };

  // Zaman formatı
  const tarihStr = formatDistanceToNow(new Date(olusturulmaZamani), {
    addSuffix: true,
    locale: tr,
  });

  // İçerik türü ikonu
  const getTurIcon = (tur?: string) => {
    if (tur === 'film') return <Film size={14} className="text-[#6C5CE7]" />;
    if (tur === 'dizi') return <Tv size={14} className="text-[#00CEC9]" />;
    if (tur === 'kitap') return <BookOpen size={14} className="text-[#fd79a8]" />;
    return null;
  };

  // Aktivite türüne göre aksiyon metni
  const getAksiyonMetni = () => {
    switch (aktiviteTuru) {
      case 'puanlama':
        return 'bir içeriği puanladı';
      case 'yorum':
        return 'bir içerik hakkında yorum yaptı';
      case 'listeye_ekleme':
        return 'bir içeriği listeye ekledi';
      case 'takip':
        return 'bir kullanıcıyı takip etmeye başladı';
      case 'durum_guncelleme':
        return 'kütüphanesini güncelledi';
      default:
        return 'bir aktivite gerçekleştirdi';
    }
  };

  // İçerik detayına git
  const handleContentClick = () => {
    if (aktivite.icerikId && aktiviteTuru !== 'takip') {
      const tur = veri?.tur || aktivite.icerikTur || 'film';
      navigate(`/icerik/${tur}/${aktivite.icerikId}`);
    }
  };

  // Profil'e git
  const handleProfileClick = () => {
    navigate(`/profil/${kullaniciAdi}`);
  };

  // ============================================
  // PUANLAMA AKTİVİTESİ - Nebula Style
  // ============================================
  const renderPuanlamaContent = () => (
    <div
      className="relative overflow-hidden rounded-xl cursor-pointer group"
      onClick={handleContentClick}
    >
      <div className="relative aspect-video max-h-[280px] overflow-hidden rounded-xl">
        {veri?.posterUrl ? (
          <img
            src={veri.posterUrl}
            alt={veri.baslik}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
            {getTurIcon(veri?.tur)}
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a12] via-transparent to-transparent" />
        
        {/* İçerik bilgisi ve puan */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h4 className="font-bold text-white text-lg line-clamp-2 mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            {veri?.baslik}
          </h4>
          <div className="flex items-center gap-2 mb-3">
            {getTurIcon(veri?.tur)}
            <span className="text-xs text-[rgba(255,255,255,0.6)] capitalize">{veri?.tur}</span>
          </div>
          {/* Puan gösterimi - Nebula gradient badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#6C5CE7]/30 to-[#00CEC9]/20 border border-[rgba(108,92,231,0.3)]">
            <Star size={18} className="text-[#FF9F0A] fill-[#FF9F0A]" />
            <span className="text-xl font-bold text-white">{veri?.puan}</span>
            <span className="text-sm text-[rgba(255,255,255,0.5)]">/10</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================
  // YORUM AKTİVİTESİ - Nebula Style
  // ============================================
  const renderYorumContent = () => (
    <div className="space-y-3">
      <div
        className="flex gap-4 p-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] cursor-pointer hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(108,92,231,0.3)] transition-all"
        onClick={handleContentClick}
      >
        {veri?.posterUrl && (
          <img
            src={veri.posterUrl}
            alt={veri.baslik}
            className="w-20 h-28 rounded-lg object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white line-clamp-2">{veri?.baslik}</h4>
          <div className="flex items-center gap-2 mt-1">
            {getTurIcon(veri?.tur)}
            <span className="text-xs text-[rgba(255,255,255,0.5)] capitalize">{veri?.tur}</span>
          </div>
        </div>
      </div>
      
      {veri?.yorumOzet && (
        <div className="p-4 rounded-xl bg-[rgba(108,92,231,0.1)] border-l-2 border-[#6C5CE7]">
          <p className="text-[rgba(255,255,255,0.85)] text-sm italic line-clamp-3">
            "{veri.yorumOzet}"
          </p>
          <button
            onClick={handleContentClick}
            className="mt-2 text-xs text-[#6C5CE7] hover:text-[#00CEC9] transition-colors"
          >
            ...daha fazlasını oku
          </button>
        </div>
      )}
    </div>
  );

  // ============================================
  // KÜTÜPHANE DURUM GÜNCELLEMESİ - Nebula Style
  // ============================================
  const renderDurumContent = () => {
    const durumConfig: Record<string, { color: string; bg: string }> = {
      'izledim': { color: '#00b894', bg: 'rgba(0, 184, 148, 0.15)' },
      'izlenecek': { color: '#6C5CE7', bg: 'rgba(108, 92, 231, 0.15)' },
      'okudum': { color: '#00b894', bg: 'rgba(0, 184, 148, 0.15)' },
      'okunacak': { color: '#6C5CE7', bg: 'rgba(108, 92, 231, 0.15)' },
      'izleniyor': { color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.15)' },
      'okunuyor': { color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.15)' },
    };
    const config = durumConfig[veri?.durum?.toLowerCase() || ''] || { color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.15)' };

    return (
      <div
        className="flex gap-4 p-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] cursor-pointer hover:bg-[rgba(255,255,255,0.06)] transition-all"
        onClick={handleContentClick}
      >
        {veri?.posterUrl && (
          <img
            src={veri.posterUrl}
            alt={veri.baslik}
            className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white line-clamp-2">{veri?.baslik}</h4>
          <div className="flex items-center gap-2 mt-1">
            {getTurIcon(veri?.tur)}
            <span className="text-xs text-[rgba(255,255,255,0.5)] capitalize">{veri?.tur}</span>
          </div>
          <div className="mt-3">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: config.bg, color: config.color }}
            >
              <Play size={12} />
              {veri?.durum}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // LİSTEYE EKLEME AKTİVİTESİ - Nebula Style
  // ============================================
  const renderListeContent = () => (
    <div
      className="flex gap-4 p-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] cursor-pointer hover:bg-[rgba(255,255,255,0.06)] transition-all"
      onClick={handleContentClick}
    >
      {veri?.posterUrl && (
        <img
          src={veri.posterUrl}
          alt={veri.baslik}
          className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-white line-clamp-2">{veri?.baslik}</h4>
        <div className="flex items-center gap-2 mt-1">
          {getTurIcon(veri?.tur)}
          <span className="text-xs text-[rgba(255,255,255,0.5)] capitalize">{veri?.tur}</span>
        </div>
        {veri?.listeAdi && (
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[rgba(253,121,168,0.15)] text-[#fd79a8]">
              <List size={12} />
              {veri.listeAdi}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  // ============================================
  // TAKİP AKTİVİTESİ - Nebula Style
  // ============================================
  const renderTakipContent = () => (
    <div
      className="flex items-center gap-4 p-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] cursor-pointer hover:bg-[rgba(255,255,255,0.06)] transition-all"
      onClick={() => navigate(`/profil/${veri?.takipEdilenKullaniciAdi}`)}
    >
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00b894] to-[#00CEC9] flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-[rgba(0,206,201,0.3)]">
        {veri?.takipEdilenAvatar ? (
          <img
            src={veri.takipEdilenAvatar}
            alt={veri.takipEdilenKullaniciAdi}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-white font-bold text-xl">
            {veri?.takipEdilenKullaniciAdi?.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-white">@{veri?.takipEdilenKullaniciAdi}</p>
        <p className="text-sm text-[rgba(255,255,255,0.5)]">Profili görüntüle</p>
      </div>
      <UserPlus size={20} className="text-[#00CEC9]" />
    </div>
  );

  // Ana içerik render
  const renderMainContent = () => {
    switch (aktiviteTuru) {
      case 'puanlama':
        return renderPuanlamaContent();
      case 'yorum':
        return renderYorumContent();
      case 'durum_guncelleme':
        return renderDurumContent();
      case 'listeye_ekleme':
        return renderListeContent();
      case 'takip':
        return renderTakipContent();
      default:
        return null;
    }
  };

  return (
    <NebulaCard className="animate-fade-in hover:border-[rgba(108,92,231,0.2)] transition-all">
      {/* HEADER */}
      <div className="flex items-start gap-3 mb-4">
        {/* Avatar with gradient ring */}
        <div
          className="p-0.5 rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#fd79a8] cursor-pointer"
          onClick={handleProfileClick}
        >
          <div className="w-10 h-10 rounded-full bg-[#0a0a12] flex items-center justify-center overflow-hidden">
            {kullaniciAvatar ? (
              <img src={kullaniciAvatar} alt={kullaniciAdi} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-semibold text-sm">
                {kullaniciAdi?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span
              className="font-semibold text-white cursor-pointer hover:text-[#6C5CE7] transition-colors"
              onClick={handleProfileClick}
            >
              {kullaniciAdi}
            </span>
            <span className="text-[rgba(255,255,255,0.5)]"> {getAksiyonMetni()}</span>
          </p>
          <p className="text-xs text-[rgba(255,255,255,0.35)] mt-0.5">{tarihStr}</p>
        </div>
      </div>

      {/* CONTENT */}
      <div className="mb-4">
        {renderMainContent()}
      </div>

      {/* FOOTER - Actions */}
      <div className="flex items-center gap-6 pt-4 border-t border-[rgba(255,255,255,0.06)]">
        <button
          onClick={handleBegeni}
          disabled={begeniYukleniyor || !isLoggedIn}
          className={`flex items-center gap-2 text-sm transition-all disabled:opacity-50 ${
            begendim
              ? 'text-[#fd79a8]'
              : 'text-[rgba(255,255,255,0.5)] hover:text-[#fd79a8]'
          }`}
        >
          <Heart size={18} className={begendim ? 'fill-[#fd79a8]' : ''} />
          <span>{begeniSayisi > 0 ? begeniSayisi : 'Beğen'}</span>
        </button>
        
        <button
          onClick={toggleYorumlar}
          className="flex items-center gap-2 text-sm text-[rgba(255,255,255,0.5)] hover:text-[#6C5CE7] transition-colors"
        >
          <MessageCircle size={18} />
          <span>{yorumSayisi > 0 ? `${yorumSayisi} Yorum` : 'Yorum Yap'}</span>
          {yorumlarAcik ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* YORUM BÖLÜMÜ */}
      {yorumlarAcik && (
        <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)]">
          {isLoggedIn && (
            <div className="mb-4">
              {yanitYapilan && (
                <div className="flex items-center gap-2 mb-2 text-xs text-[#6C5CE7]">
                  <span>Yanıtlanıyor:</span>
                  <button onClick={() => setYanitYapilan(null)} className="hover:underline">
                    İptal
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={yeniYorum}
                  onChange={(e) => setYeniYorum(e.target.value)}
                  placeholder={yanitYapilan ? 'Yanıtınızı yazın...' : 'Yorum yazın...'}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-white text-sm placeholder-[rgba(255,255,255,0.3)] focus:outline-none focus:border-[#6C5CE7] focus:ring-2 focus:ring-[#6C5CE7]/20 transition-all"
                  onKeyPress={(e) => e.key === 'Enter' && handleYorumGonder()}
                />
                <button
                  onClick={handleYorumGonder}
                  disabled={!yeniYorum.trim() || yorumGonderiliyor}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-[#6C5CE7] to-[#00CEC9] text-white disabled:opacity-50 hover:shadow-lg hover:shadow-[#6C5CE7]/30 transition-all"
                >
                  {yorumGonderiliyor ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            </div>
          )}

          {yorumlarYukleniyor ? (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-[#6C5CE7]" />
            </div>
          ) : yorumlar.length > 0 ? (
            <div className="space-y-3">
              {yorumlar.map((yorum) => (
                <YorumItem
                  key={yorum.id}
                  yorum={yorum}
                  isLoggedIn={isLoggedIn}
                  onYanitla={() => setYanitYapilan(yorum.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-[rgba(255,255,255,0.35)] py-4">
              Henüz yorum yok. İlk yorumu siz yapın!
            </p>
          )}
        </div>
      )}
    </NebulaCard>
  );
}

// ============================================
// YORUM ITEM COMPONENT - Nebula Style
// ============================================

interface YorumItemProps {
  yorum: AktiviteYorum;
  isLoggedIn: boolean;
  onYanitla: () => void;
  isReply?: boolean;
}

function YorumItem({ yorum, isLoggedIn, onYanitla, isReply = false }: YorumItemProps) {
  const navigate = useNavigate();
  const [begendim, setBegendim] = useState(yorum.begendim || false);
  const [begeniSayisi, setBegeniSayisi] = useState(yorum.begeniSayisi || 0);
  const [begeniYukleniyor, setBegeniYukleniyor] = useState(false);

  const handleBegeni = async () => {
    if (!isLoggedIn || begeniYukleniyor) return;
    
    setBegeniYukleniyor(true);
    try {
      const result = await aktiviteApi.yorumBegen(yorum.id);
      setBegendim(result.begendim);
      setBegeniSayisi(result.begeniSayisi);
    } catch (error) {
      console.error('Yorum beğeni hatası:', error);
    } finally {
      setBegeniYukleniyor(false);
    }
  };

  const tarihStr = formatDistanceToNow(new Date(yorum.olusturulmaZamani), {
    addSuffix: true,
    locale: tr,
  });

  return (
    <div className={`${isReply ? 'ml-8 pl-4 border-l-2 border-[rgba(108,92,231,0.3)]' : ''}`}>
      <div className="flex gap-3">
        <div
          className="p-0.5 rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#00CEC9] cursor-pointer flex-shrink-0"
          onClick={() => navigate(`/profil/${yorum.kullaniciAdi}`)}
        >
          <div className="w-8 h-8 rounded-full bg-[#0a0a12] flex items-center justify-center overflow-hidden">
            {yorum.kullaniciAvatar ? (
              <img src={yorum.kullaniciAvatar} alt={yorum.kullaniciAdi} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-semibold text-xs">
                {yorum.kullaniciAdi?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-white text-sm cursor-pointer hover:text-[#6C5CE7] transition-colors"
              onClick={() => navigate(`/profil/${yorum.kullaniciAdi}`)}
            >
              {yorum.kullaniciAdi}
            </span>
            <span className="text-xs text-[rgba(255,255,255,0.3)]">{tarihStr}</span>
          </div>
          
          <p className="text-sm text-[rgba(255,255,255,0.85)] mt-1">{yorum.icerik}</p>
          
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={handleBegeni}
              disabled={begeniYukleniyor || !isLoggedIn}
              className={`flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
                begendim ? 'text-[#fd79a8]' : 'text-[rgba(255,255,255,0.4)] hover:text-[#fd79a8]'
              }`}
            >
              <Heart size={14} className={begendim ? 'fill-[#fd79a8]' : ''} />
              <span>{begeniSayisi > 0 ? begeniSayisi : ''}</span>
            </button>
            
            {!isReply && isLoggedIn && (
              <button
                onClick={onYanitla}
                className="text-xs text-[rgba(255,255,255,0.4)] hover:text-[#6C5CE7] transition-colors"
              >
                Yanıtla
              </button>
            )}
          </div>
        </div>
      </div>

      {yorum.yanitlar && yorum.yanitlar.length > 0 && (
        <div className="mt-3 space-y-3">
          {yorum.yanitlar.map((yanit) => (
            <YorumItem
              key={yanit.id}
              yorum={yanit}
              isLoggedIn={isLoggedIn}
              onYanitla={() => {}}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// SKELETON LOADER - Nebula Style
// ============================================

function ActivitySkeleton() {
  return (
    <NebulaCard>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.05)] animate-pulse" />
        <div className="flex-1">
          <div className="h-4 w-32 bg-[rgba(255,255,255,0.05)] rounded animate-pulse mb-2" />
          <div className="h-3 w-20 bg-[rgba(255,255,255,0.05)] rounded animate-pulse" />
        </div>
      </div>
      <div className="aspect-video rounded-xl bg-[rgba(255,255,255,0.05)] animate-pulse" />
    </NebulaCard>
  );
}

// ============================================
// EMPTY STATE - Nebula Style
// ============================================

function EmptyState({ isLoggedIn }: { isLoggedIn: boolean }) {
  const navigate = useNavigate();

  return (
    <NebulaCard className="text-center py-12">
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#6C5CE7]/20 to-[#00CEC9]/10 border border-[rgba(108,92,231,0.2)] flex items-center justify-center">
        <Sparkles size={36} className="text-[#6C5CE7]" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
        Henüz aktivite yok
      </h3>
      <p className="text-[rgba(255,255,255,0.5)] mb-6 max-w-xs mx-auto">
        {isLoggedIn
          ? 'Kullanıcıları takip ederek aktivitelerini burada görün.'
          : 'Keşfet sayfasından içerikleri inceleyebilirsiniz.'}
      </p>
      <button 
        onClick={() => navigate('/kesfet')}
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#6C5CE7] to-[#00CEC9] text-white font-semibold hover:shadow-lg hover:shadow-[#6C5CE7]/30 transition-all"
      >
        Keşfet
      </button>
    </NebulaCard>
  );
}

// ============================================
// MAIN FEED PAGE - Nebula Style
// ============================================

export default function FeedPage() {
  const { user } = useAuth();
  const [aktiviteler, setAktiviteler] = useState<Aktivite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sayfa, setSayfa] = useState(1);
  const [toplamSayfa, setToplamSayfa] = useState(1);
  const [filter, setFilter] = useState<'hepsi' | 'takip'>('hepsi');

  // Aktiviteleri yükle
  const fetchAktiviteler = useCallback(
    async (page: number, append: boolean = false) => {
      try {
        if (page === 1) setLoading(true);
        else setLoadingMore(true);
        setError(null);

        let result;

        if (user && filter === 'takip') {
          result = await aktiviteApi.getFeed({ sayfa: page, limit: 15 });
        } else {
          result = await aktiviteApi.getGenelFeed({ sayfa: page, limit: 15 });
        }

        if (append) {
          setAktiviteler((prev) => [...prev, ...result.data]);
        } else {
          setAktiviteler(result.data);
        }
        setToplamSayfa(result.toplamSayfa);
      } catch (err: any) {
        console.error('Feed yükleme hatası:', err);
        setError(err.response?.data?.message || 'Aktiviteler yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, filter]
  );

  useEffect(() => {
    setSayfa(1);
    fetchAktiviteler(1);
  }, [fetchAktiviteler]);

  const handleLoadMore = () => {
    if (sayfa < toplamSayfa && !loadingMore) {
      const nextPage = sayfa + 1;
      setSayfa(nextPage);
      fetchAktiviteler(nextPage, true);
    }
  };

  const handleRefresh = () => {
    setSayfa(1);
    fetchAktiviteler(1);
  };

  return (
    <div className="p-6 pb-24 lg:pb-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-4 bg-[rgba(10,10,18,0.8)] backdrop-blur-xl border-b border-[rgba(255,255,255,0.06)] mb-6">
        <div className="flex items-center justify-between max-w-[600px] mx-auto">
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            Akış
          </h1>
          <button 
            onClick={handleRefresh} 
            disabled={loading}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.6)] hover:text-white hover:border-[rgba(255,255,255,0.15)] disabled:opacity-50 transition-all"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto">
        {/* Filter Tabs - Nebula Style */}
        {user && (
          <div className="flex p-1 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] mb-6">
            <button
              onClick={() => setFilter('hepsi')}
              className={`flex-1 py-2.5 px-4 text-center text-sm font-medium rounded-lg transition-all ${
                filter === 'hepsi'
                  ? 'bg-gradient-to-r from-[#6C5CE7] to-[#00CEC9] text-white shadow-lg'
                  : 'text-[rgba(255,255,255,0.5)] hover:text-white'
              }`}
            >
              Herkes
            </button>
            <button
              onClick={() => setFilter('takip')}
              className={`flex-1 py-2.5 px-4 text-center text-sm font-medium rounded-lg transition-all ${
                filter === 'takip'
                  ? 'bg-gradient-to-r from-[#6C5CE7] to-[#00CEC9] text-white shadow-lg'
                  : 'text-[rgba(255,255,255,0.5)] hover:text-white'
              }`}
            >
              Takip Ettiklerim
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <NebulaCard className="text-center py-8 mb-4">
            <p className="text-[#FF6B6B] mb-4">{error}</p>
            <button 
              onClick={handleRefresh}
              className="px-5 py-2.5 rounded-xl bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.08)] text-white font-medium hover:bg-[rgba(255,255,255,0.12)] transition-all"
            >
              Tekrar Dene
            </button>
          </NebulaCard>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <ActivitySkeleton key={i} />
            ))}
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {aktiviteler.length === 0 ? (
              <EmptyState isLoggedIn={!!user} />
            ) : (
              <div className="flex flex-col gap-4">
                {aktiviteler.map((aktivite) => (
                  <ActivityCard
                    key={aktivite.id}
                    aktivite={aktivite}
                    isLoggedIn={!!user}
                  />
                ))}
              </div>
            )}

            {/* Load More Button */}
            {sayfa < toplamSayfa && (
              <div className="mt-6 text-center">
                <button 
                  onClick={handleLoadMore} 
                  disabled={loadingMore}
                  className="px-6 py-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-white font-medium hover:bg-[rgba(255,255,255,0.08)] disabled:opacity-50 transition-all"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Yükleniyor...
                    </span>
                  ) : (
                    'Daha Fazla Göster'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
