import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { aktiviteApi } from '../../services/api';
import type { Aktivite, AktiviteYorum } from '../../services/api';
import { 
  getFeedCache, 
  setFeedCache, 
  removeFromFeedCache,
  invalidateFeedCache
} from '../../services/feedCache';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import './FeedPage.css';

// ============================================
// ACTIVITY TYPE HELPER - Get action text
// ============================================

// Durum için helper fonksiyonlar
function getStatusLabel(durum: string, tur?: string): string {
  const durumKey = (durum || '').toLowerCase();
  const isBook = (tur || '').toLowerCase() === 'kitap';
  
  switch (durumKey) {
    case 'izlendi':
      return 'İzlendi';
    case 'okundu':
      return 'Okundu';
    case 'izlenecek':
      return 'İzlenecek';
    case 'okunacak':
      return 'Okunacak';
    case 'devam_ediyor':
      return isBook ? 'Okunuyor' : 'İzleniyor';
    case 'izleniyor':
      return 'İzleniyor';
    case 'okunuyor':
      return 'Okunuyor';
    case 'tamamlandi':
      return isBook ? 'Okundu' : 'İzlendi';
    case 'birakti':
    case 'bıraktı':
      return 'Bıraktı';
    default:
      return durum;
  }
}

function getStatusIcon(durum: string, tur?: string): string {
  const durumKey = (durum || '').toLowerCase();
  const isBook = (tur || '').toLowerCase() === 'kitap';
  
  switch (durumKey) {
    case 'izlendi':
    case 'okundu':
    case 'tamamlandi':
      return 'check_circle';
    case 'izlenecek':
    case 'okunacak':
      return 'bookmark';
    case 'devam_ediyor':
    case 'izleniyor':
    case 'okunuyor':
      return isBook ? 'auto_stories' : 'play_circle';
    case 'birakti':
    case 'bıraktı':
      return 'cancel';
    default:
      return 'info';
  }
}

function getStatusClass(durum: string, _tur?: string): string {
  const durumKey = (durum || '').toLowerCase();
  
  switch (durumKey) {
    case 'izlendi':
    case 'okundu':
    case 'tamamlandi':
      return 'status-completed';
    case 'izlenecek':
    case 'okunacak':
      return 'status-planned';
    case 'devam_ediyor':
    case 'izleniyor':
    case 'okunuyor':
      return 'status-watching';
    case 'birakti':
    case 'bıraktı':
      return 'status-dropped';
    default:
      return 'status-default';
  }
}

// Activity type için aksiyon metni oluştur
function getActionText(type: string, contentType?: string, durum?: string): string {
  const typeKey = type.toLowerCase();
  const turKey = (contentType || '').toLowerCase();
  const isBook = turKey === 'kitap';
  const isTV = turKey === 'dizi';
  
  const contentName = isBook ? 'bu kitabı' : isTV ? 'bu diziyi' : 'bu filmi';
  const contentNameHakkinda = isBook ? 'bu kitap' : isTV ? 'bu dizi' : 'bu film';
  
  switch (typeKey) {
    case 'puanlama':
      return `${contentName} puanladı`;
    case 'yorum':
      return `${contentNameHakkinda} hakkında yorum yaptı`;
    case 'durum_guncelleme':
      // Durum değerine göre aksiyon metni
      const durumKey = (durum || '').toLowerCase();
      if (durumKey === 'izlendi' || durumKey === 'tamamlandi') {
        return isBook ? `${contentName} okudu` : `${contentName} izledi`;
      } else if (durumKey === 'okundu') {
        return `${contentName} okudu`;
      } else if (durumKey === 'devam_ediyor' || durumKey === 'izleniyor') {
        return isTV ? 'bu diziyi izlemeye başladı' : 'bu filmi izlemeye başladı';
      } else if (durumKey === 'okunuyor') {
        return 'bu kitabı okumaya başladı';
      } else if (durumKey === 'izlenecek' || durumKey === 'okunacak') {
        return `${contentName} listesine ekledi`;
      }
      return isBook ? 'okuma durumunu güncelledi' : 'izleme durumunu güncelledi';
    case 'listeye_ekleme':
    case 'kutuphaneyeekleme':
      return `${contentName} kütüphanesine ekledi`;
    default:
      return 'bir aktivite gerçekleştirdi';
  }
}

// ============================================
// INLINE COMMENTS SECTION COMPONENT
// ============================================
interface InlineCommentsProps {
  aktiviteId: number;
  isOpen: boolean;
  isLoggedIn: boolean;
  currentUserName?: string;
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
}

function InlineComments({ aktiviteId, isOpen, isLoggedIn, currentUserName, onCommentAdded, onCommentDeleted }: InlineCommentsProps) {
  const [yorumlar, setYorumlar] = useState<AktiviteYorum[]>([]);
  const [loading, setLoading] = useState(true);
  const [yeniYorum, setYeniYorum] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; kullaniciAdi: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const YORUM_LIMIT = 200; // Karakter sınırı

  const toggleExpandComment = (yorumId: number) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(yorumId)) {
        newSet.delete(yorumId);
      } else {
        newSet.add(yorumId);
      }
      return newSet;
    });
  };

  const renderYorumIcerik = (yorum: AktiviteYorum) => {
    const isExpanded = expandedComments.has(yorum.id);
    const isLong = yorum.icerik.length > YORUM_LIMIT;
    
    if (!isLong || isExpanded) {
      return (
        <>
          {yorum.icerik}
          {isLong && (
            <button 
              className="read-more-link inline-read-more"
              onClick={() => toggleExpandComment(yorum.id)}
            >
              daha az göster
            </button>
          )}
        </>
      );
    }
    
    return (
      <>
        {yorum.icerik.substring(0, YORUM_LIMIT)}...
        <button 
          className="read-more-link inline-read-more"
          onClick={() => toggleExpandComment(yorum.id)}
        >
          daha fazlasını gör
        </button>
      </>
    );
  };

  useEffect(() => {
    if (isOpen) {
      fetchYorumlar();
    }
  }, [isOpen, aktiviteId]);

  // Menü dışı tıklamada kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuId !== null) {
        const menuEl = menuRefs.current[openMenuId];
        if (menuEl && !menuEl.contains(e.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const fetchYorumlar = async () => {
    try {
      setLoading(true);
      const response = await aktiviteApi.getYorumlar(aktiviteId);
      setYorumlar(response.data || []);
    } catch (error) {
      console.error('Yorumlar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleYorumGonder = async () => {
    if (!yeniYorum.trim() || gonderiliyor) return;
    setGonderiliyor(true);
    try {
      const yorum = await aktiviteApi.yorumEkle(aktiviteId, { 
        icerik: yeniYorum.trim(),
        ustYorumId: replyingTo?.id
      });
      
      if (replyingTo) {
        // Yanıt ise, üst yorumun yanıtlar listesine ekle
        setYorumlar(yorumlar.map(y => 
          y.id === replyingTo.id 
            ? { ...y, yanitlar: [...(y.yanitlar || []), yorum] }
            : y
        ));
      } else {
        // Ana yorum ise başa ekle
        setYorumlar([yorum, ...yorumlar]);
      }
      
      setYeniYorum('');
      setReplyingTo(null);
      if (onCommentAdded) onCommentAdded();
    } catch (error) {
      console.error('Yorum gönderilemedi:', error);
    } finally {
      setGonderiliyor(false);
    }
  };

  const handleReply = (yorumId: number, kullaniciAdi: string) => {
    setReplyingTo({ id: yorumId, kullaniciAdi });
    setYeniYorum(`@${kullaniciAdi} `);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setYeniYorum('');
  };

  const handleYorumBegen = async (yorumId: number, isReply = false, parentId?: number) => {
    // Optimistic update için mevcut durumu bul
    let currentBegendi = false;
    if (isReply && parentId) {
      const parent = yorumlar.find(y => y.id === parentId);
      const reply = parent?.yanitlar?.find(r => r.id === yorumId);
      currentBegendi = reply?.begendim || false;
    } else {
      const yorum = yorumlar.find(y => y.id === yorumId);
      currentBegendi = yorum?.begendim || false;
    }

    // Hemen güncelle (optimistic)
    if (isReply && parentId) {
      setYorumlar(yorumlar.map(y => 
        y.id === parentId 
          ? { 
              ...y, 
              yanitlar: y.yanitlar?.map(r => 
                r.id === yorumId 
                  ? { ...r, begendim: !currentBegendi, begeniSayisi: (r.begeniSayisi || 0) + (currentBegendi ? -1 : 1) }
                  : r
              ) 
            }
          : y
      ));
    } else {
      setYorumlar(yorumlar.map(y => 
        y.id === yorumId 
          ? { ...y, begendim: !currentBegendi, begeniSayisi: (y.begeniSayisi || 0) + (currentBegendi ? -1 : 1) }
          : y
      ));
    }

    try {
      const result = await aktiviteApi.yorumBegen(yorumId);
      
      // API sonucuyla senkronize et
      if (isReply && parentId) {
        setYorumlar(prev => prev.map(y => 
          y.id === parentId 
            ? { 
                ...y, 
                yanitlar: y.yanitlar?.map(r => 
                  r.id === yorumId 
                    ? { ...r, begendim: result.begendim, begeniSayisi: result.begeniSayisi }
                    : r
                ) 
              }
            : y
        ));
      } else {
        setYorumlar(prev => prev.map(y => 
          y.id === yorumId 
            ? { ...y, begendim: result.begendim, begeniSayisi: result.begeniSayisi }
            : y
        ));
      }
    } catch (error) {
      // Hata durumunda geri al
      if (isReply && parentId) {
        setYorumlar(prev => prev.map(y => 
          y.id === parentId 
            ? { 
                ...y, 
                yanitlar: y.yanitlar?.map(r => 
                  r.id === yorumId 
                    ? { ...r, begendim: currentBegendi, begeniSayisi: (r.begeniSayisi || 0) + (currentBegendi ? 1 : -1) }
                    : r
                ) 
              }
            : y
        ));
      } else {
        setYorumlar(prev => prev.map(y => 
          y.id === yorumId 
            ? { ...y, begendim: currentBegendi, begeniSayisi: (y.begeniSayisi || 0) + (currentBegendi ? 1 : -1) }
            : y
        ));
      }
      console.error('Beğeni hatası:', error);
    }
  };

  const handleYorumSil = async (yorumId: number, isReply = false, parentId?: number) => {
    setDeletingId(yorumId);
    setOpenMenuId(null);
    try {
      await aktiviteApi.yorumSil(yorumId);
      
      if (isReply && parentId) {
        // Yanıtı sil
        setYorumlar(yorumlar.map(y => 
          y.id === parentId 
            ? { ...y, yanitlar: y.yanitlar?.filter(r => r.id !== yorumId) }
            : y
        ));
      } else {
        // Ana yorumu sil
        setYorumlar(yorumlar.filter(y => y.id !== yorumId));
      }
      
      if (onCommentDeleted) onCommentDeleted();
    } catch (error) {
      console.error('Yorum silinemedi:', error);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="inline-comments">
      {/* Yorumlar Listesi - Önce yorumlar */}
      <div className="inline-comments-list">
        {loading ? (
          <div className="comments-loading">
            <div className="loading-spinner small"></div>
          </div>
        ) : yorumlar.length === 0 ? (
          <div className="no-comments-inline">
            Henüz yorum yok{isLoggedIn && ' — İlk yorumu sen yap!'}
          </div>
        ) : (
          yorumlar.map((yorum) => (
            <div key={yorum.id} className="comment-thread">
              {/* Ana Yorum */}
              <div className="comment-item">
                <img 
                  src={yorum.kullaniciAvatar || '/default-avatar.svg'}
                  alt={yorum.kullaniciAdi}
                  className="comment-avatar"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.svg'; }}
                />
                <div className="comment-body">
                  <p className="comment-text">
                    <span className="comment-username">{yorum.kullaniciAdi}</span>
                    {renderYorumIcerik(yorum)}
                  </p>
                  <div className="comment-meta">
                    <span className="comment-time">
                      {formatDistanceToNow(new Date(yorum.olusturulmaZamani), { addSuffix: false, locale: tr })}
                    </span>
                    {yorum.begeniSayisi > 0 && (
                      <span className="comment-likes">{yorum.begeniSayisi} beğeni</span>
                    )}
                    {isLoggedIn && (
                      <button 
                        className={`comment-like-btn ${yorum.begendim ? 'liked' : ''}`}
                        onClick={() => handleYorumBegen(yorum.id)}
                      >
                        {yorum.begendim ? '❤️' : '🤍'}
                      </button>
                    )}
                    {isLoggedIn && (
                      <button 
                        className="comment-reply-btn"
                        onClick={() => handleReply(yorum.id, yorum.kullaniciAdi)}
                      >
                        Yanıtla
                      </button>
                    )}
                  </div>
                </div>
                {/* Sağdaki 3 nokta menüsü - sadece kendi yorumları için */}
                {currentUserName === yorum.kullaniciAdi && (
                  <div className="comment-more-menu" ref={(el) => { menuRefs.current[yorum.id] = el; }}>
                    <button 
                      className="comment-more-btn"
                      onClick={() => setOpenMenuId(openMenuId === yorum.id ? null : yorum.id)}
                    >
                      •••
                    </button>
                    {openMenuId === yorum.id && (
                      <div className="comment-dropdown-menu">
                        <button 
                          className="comment-menu-delete"
                          onClick={() => handleYorumSil(yorum.id)}
                          disabled={deletingId === yorum.id}
                        >
                          {deletingId === yorum.id ? 'Siliniyor...' : 'Sil'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Yanıtlar */}
              {yorum.yanitlar && yorum.yanitlar.length > 0 && (
                <div className="comment-replies">
                  {yorum.yanitlar.map((yanit) => (
                    <div key={yanit.id} className="comment-item reply">
                      <img 
                        src={yanit.kullaniciAvatar || '/default-avatar.svg'}
                        alt={yanit.kullaniciAdi}
                        className="comment-avatar"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.svg'; }}
                      />
                      <div className="comment-body">
                        <p className="comment-text">
                          <span className="comment-username">{yanit.kullaniciAdi}</span>
                          {renderYorumIcerik(yanit)}
                        </p>
                        <div className="comment-meta">
                          <span className="comment-time">
                            {formatDistanceToNow(new Date(yanit.olusturulmaZamani), { addSuffix: false, locale: tr })}
                          </span>
                          {yanit.begeniSayisi > 0 && (
                            <span className="comment-likes">{yanit.begeniSayisi} beğeni</span>
                          )}
                          {isLoggedIn && (
                            <button 
                              className={`comment-like-btn ${yanit.begendim ? 'liked' : ''}`}
                              onClick={() => handleYorumBegen(yanit.id, true, yorum.id)}
                            >
                              {yanit.begendim ? '❤️' : '🤍'}
                            </button>
                          )}
                          {isLoggedIn && (
                            <button 
                              className="comment-reply-btn"
                              onClick={() => handleReply(yorum.id, yanit.kullaniciAdi)}
                            >
                              Yanıtla
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Sağdaki 3 nokta menüsü - yanıtlar için */}
                      {currentUserName === yanit.kullaniciAdi && (
                        <div className="comment-more-menu" ref={(el) => { menuRefs.current[yanit.id] = el; }}>
                          <button 
                            className="comment-more-btn"
                            onClick={() => setOpenMenuId(openMenuId === yanit.id ? null : yanit.id)}
                          >
                            •••
                          </button>
                          {openMenuId === yanit.id && (
                            <div className="comment-dropdown-menu">
                              <button 
                                className="comment-menu-delete"
                                onClick={() => handleYorumSil(yanit.id, true, yorum.id)}
                                disabled={deletingId === yanit.id}
                              >
                                {deletingId === yanit.id ? 'Siliniyor...' : 'Sil'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Yorum Input - Instagram tarzı en altta */}
      {isLoggedIn ? (
        <div className="comment-input-bar">
          {replyingTo && (
            <div className="replying-indicator">
              @{replyingTo.kullaniciAdi}
              <button onClick={cancelReply}>×</button>
            </div>
          )}
          <div className="comment-input-row">
            <input
              ref={inputRef}
              type="text"
              value={yeniYorum}
              onChange={(e) => setYeniYorum(e.target.value)}
              placeholder={replyingTo ? `@${replyingTo.kullaniciAdi} yanıtla...` : "Yorum ekle..."}
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && yeniYorum.trim()) {
                  e.preventDefault();
                  handleYorumGonder();
                }
              }}
            />
            <button 
              onClick={handleYorumGonder}
              disabled={!yeniYorum.trim() || gonderiliyor}
              className="comment-post-btn"
            >
              {gonderiliyor ? '...' : 'Paylaş'}
            </button>
          </div>
        </div>
      ) : (
        <div className="comment-login-prompt">
          <Link to="/giris">Giriş yap</Link> ve yorum yap
        </div>
      )}
    </div>
  );
}

// ============================================
// ACTIVITY CARD COMPONENT - feed.html style
// ============================================
export interface FeedActivityCardProps {
  aktivite: Aktivite;
  isLoggedIn: boolean;
  index: number;
  currentUserName?: string;
  onDelete?: (aktiviteId: number) => void;
  compact?: boolean; // Detay sayfasında kompakt görünüm için
}

export function FeedActivityCard({ aktivite, isLoggedIn, index, currentUserName, onDelete, compact = false }: FeedActivityCardProps) {
  const navigate = useNavigate();
  const { kullaniciAdi, kullaniciAvatar, olusturulmaZamani, veri } = aktivite;
  const aktiviteTuru = aktivite.aktiviteTuru || aktivite.aktiviteTipiStr || '';
  
  const [liked, setLiked] = useState(aktivite.begendim || false);
  const [likeCount, setLikeCount] = useState(aktivite.begeniSayisi || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(aktivite.yorumSayisi || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Kendi aktivitemiz mi?
  const isOwnActivity = currentUserName && kullaniciAdi === currentUserName;
  const isSpoiler = veri?.spoilerIceriyor === true;

  const tarihStr = formatDistanceToNow(new Date(olusturulmaZamani), { addSuffix: true, locale: tr });
  
  // Aktivite türüne göre aksiyon metni (durum_guncelleme için durum bilgisi de gönder)
  const actionText = getActionText(aktiviteTuru, veri?.tur, veri?.durum);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleLike = async () => {
    if (!isLoggedIn || isLiking) return;
    
    // Optimistic update - UI'ı hemen güncelle
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    
    setIsLiking(true);
    try {
      const result = await aktiviteApi.toggleBegeni(aktivite.id);
      // API sonucuyla senkronize et
      setLiked(result.begendim);
      setLikeCount(result.begeniSayisi);
    } catch (error) {
      // Hata durumunda geri al
      setLiked(prevLiked);
      setLikeCount(prevCount);
      console.error('Beğeni hatası:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwnActivity || isDeleting) return;
    
    setIsDeleting(true);
    try {
      await aktiviteApi.aktiviteSil(aktivite.id);
      setShowMenu(false);
      if (onDelete) onDelete(aktivite.id);
    } catch (error) {
      console.error('Silme hatası:', error);
      alert('Aktivite silinirken bir hata oluştu.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleContentClick = () => {
    if (aktivite.icerikId && aktiviteTuru.toLowerCase() !== 'takip' && aktiviteTuru.toLowerCase() !== 'takipetme') {
      const rawTur = veri?.tur || aktivite.icerikTur || 'film';
      const tur = rawTur.toLowerCase();
      navigate(`/icerik/${tur}/${aktivite.icerikId}`);
    }
  };

  // Yoruma git - yorum detayına yönlendir ve o yoruma scroll et
  const handleGoToComment = () => {
    if (veri?.yorumId && aktivite.icerikId) {
      const rawTur = veri?.tur || aktivite.icerikTur || 'film';
      const tur = rawTur.toLowerCase();
      navigate(`/icerik/${tur}/${aktivite.icerikId}?tab=yorumlar&yorumId=${veri.yorumId}#yorum-${veri.yorumId}`);
    } else if (aktivite.icerikId) {
      const rawTur = veri?.tur || aktivite.icerikTur || 'film';
      const tur = rawTur.toLowerCase();
      navigate(`/icerik/${tur}/${aktivite.icerikId}?tab=yorumlar`);
    }
  };

  const handleProfileClick = () => navigate(`/profil/${kullaniciAdi}`);

  const handleCommentsClick = () => {
    setShowComments(!showComments);
  };

  // Puan hesaplama - 10 üzerinden puan geliyor, 5 yıldıza çeviriyoruz
  const displayRating = veri?.puan ? veri.puan / 2 : 0;
  
  // Yorum özeti - maksimum 200 karakter
  const getCommentExcerpt = (comment?: string) => {
    if (!comment) return null;
    if (comment.length <= 200) return comment;
    return comment.substring(0, 200).trim() + '...';
  };
  
  const commentExcerpt = getCommentExcerpt(veri?.yorumOzet);
  // Backend'den tam uzunluk geliyorsa onu kullan, yoksa özetten tahmin et
  const hasFullComment = veri?.yorumTamUzunluk ? veri.yorumTamUzunluk > 200 : (veri?.yorumOzet || '').length > 200;

  // İçerik türünü belirleme
  const getContentTypeIcon = () => {
    const rawTur = veri?.tur || aktivite.icerikTur || 'film';
    const tur = rawTur.toLowerCase();
    if (tur === 'dizi') return { icon: 'tv', label: 'Dizi' };
    if (tur === 'kitap') return { icon: 'book', label: 'Kitap' };
    return { icon: 'movie', label: 'Film' };
  };
  
  const contentType = getContentTypeIcon();
  
  return (
    <article 
      className={`activity-card ${showComments ? 'comments-open' : ''}`}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* ═══════════════════════════════════════════════════════════
          HEADER: DeepSeek style - Avatar, Meta (user+action+time), Type badge
      ═══════════════════════════════════════════════════════════ */}
      <div className="activity-header">
        {/* Avatar with gradient background or image */}
        {kullaniciAvatar ? (
          <img
            src={kullaniciAvatar}
            alt={kullaniciAdi}
            onClick={handleProfileClick}
            className="activity-avatar"
            onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.svg'; }}
          />
        ) : (
          <div className="activity-avatar-placeholder" onClick={handleProfileClick}>
            {kullaniciAdi.substring(0, 2).toUpperCase()}
          </div>
        )}
        
        {/* Meta: User info + time */}
        <div className="activity-meta">
          <div className="activity-user">
            <button onClick={handleProfileClick} className="activity-username">
              {kullaniciAdi}
            </button>
            <span className="activity-action">{actionText}</span>
          </div>
          <div className="activity-time">{tarihStr}</div>
        </div>
        
        {/* Activity Type Badge */}
        <div className="activity-type">
          <span className="type-icon material-symbols-rounded">{contentType.icon}</span>
          {contentType.label}
        </div>
        
        {/* More Menu - Sadece kendi aktivitelerimiz için göster */}
        {isOwnActivity && (
          <div className="more-menu-container header-menu" ref={menuRef}>
            <button 
              className="more-btn"
              onClick={() => setShowMenu(!showMenu)}
            >
              <span className="material-symbols-rounded">more_horiz</span>
            </button>
            
            {showMenu && (
              <div className="activity-menu">
                <button 
                  className="menu-item delete"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <span className="material-symbols-rounded">delete</span>
                  {isDeleting ? 'Siliniyor...' : 'Sil'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CONTENT PREVIEW: Poster + Info block
          Aktivite tipine göre poster boyutu değişir
      ═══════════════════════════════════════════════════════════ */}
      {!compact && (
      <div className={`content-preview ${aktiviteTuru.toLowerCase() === 'puanlama' ? 'rating-card' : aktiviteTuru.toLowerCase() === 'yorum' ? 'comment-card' : ''}`} onClick={handleContentClick}>
        {/* Content Poster */}
        <div className="content-poster">
          {veri?.posterUrl ? (
            <img src={veri.posterUrl} alt={veri.baslik} />
          ) : (
            <div className="poster-placeholder">
              <span className="material-symbols-rounded">movie</span>
            </div>
          )}
          
          {/* Poster üzerinde TMDB ve Platform puanları */}
          <div className="poster-ratings-overlay">
            <div className="poster-rating-item tmdb">
              <span className="rating-source">TMDB</span>
              <span className="rating-score">{veri?.hariciPuan && veri.hariciPuan > 0 ? veri.hariciPuan.toFixed(1) : '—'}</span>
            </div>
            <div className="poster-rating-item saga">
              <span className="rating-source">SAGA</span>
              <span className="rating-score">{veri?.ortalamaPuan && veri.ortalamaPuan > 0 ? veri.ortalamaPuan.toFixed(1) : '—'}</span>
            </div>
          </div>
        </div>
        
        {/* Content Info */}
        <div className="content-info">
          <h3 className="content-title">{veri?.baslik || 'İçerik'}</h3>
          <p className="content-meta">
            {/* Kitap için yazar önce: "George Orwell • Kitap • 328 sayfa" */}
            {(veri?.tur || '').toLowerCase() === 'kitap' ? (
              <>
                {veri?.yazar && `${veri.yazar} • `}
                Kitap
                {veri?.sayfaSayisi && ` • ${veri.sayfaSayisi} sayfa`}
              </>
            ) : (
              <>
                {veri?.yil && `${veri.yil} • `}
                {(veri?.tur || '').toLowerCase() === 'dizi' ? 'Dizi' : 'Film'}
                {veri?.sure && ` • ${veri.sure}`}
                {veri?.sezonSayisi && ` • ${veri.sezonSayisi} Sezon`}
                {veri?.bolumSayisi && ` • ${veri.bolumSayisi} Bölüm`}
              </>
            )}
          </p>
          
          {/* Kullanıcının puanı - Puan varsa göster (aktivite türü puanlama veya veri.puan varsa) */}
          {veri?.puan && veri.puan > 0 && (
            <div className="user-rating-display">
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span 
                    key={star} 
                    className={`material-symbols-rounded ${star <= Math.round(displayRating) ? 'filled' : ''}`}
                  >
                    star
                  </span>
                ))}
              </div>
              <span className="rating-value">{veri.puan}/10</span>
            </div>
          )}
          
          {/* Durum güncelleme için status badge (İzleniyor, İzlendi, Okunuyor, Okundu vs.) */}
          {aktiviteTuru.toLowerCase() === 'durum_guncelleme' && veri?.durum && (
            <div className={`activity-status-badge ${getStatusClass(veri.durum, veri.tur)}`}>
              <span className="material-symbols-rounded">{getStatusIcon(veri.durum, veri.tur)}</span>
              <span>{getStatusLabel(veri.durum, veri.tur)}</span>
            </div>
          )}
          
          {/* List Info (for listeye_ekleme type) */}
          {(aktiviteTuru.toLowerCase() === 'listeye_ekleme' || aktiviteTuru.toLowerCase() === 'kutuphaneyeekleme') && veri?.listeAdi && (
            <div className="activity-list-badge">
              <span className="material-symbols-rounded">playlist_add</span>
              <span>{veri.listeAdi}</span>
            </div>
          )}
          
          {/* Kullanıcı Yorumu - Poster sağında */}
          {(aktiviteTuru.toLowerCase() === 'yorum' && commentExcerpt) && (
            <>
              {/* Spoiler varsa blur ile göster */}
              {isSpoiler && !spoilerRevealed ? (
                <div 
                  className="content-user-comment spoiler-hidden"
                  onClick={(e) => { e.stopPropagation(); setSpoilerRevealed(true); }}
                >
                  <p>"{commentExcerpt}"</p>
                  <div className="spoiler-overlay">
                    <span className="material-symbols-rounded">visibility_off</span>
                    Spoiler - görmek için tıkla
                  </div>
                </div>
              ) : (
                <div className="content-user-comment">
                  <p>"{commentExcerpt}"</p>
                  <div className="comment-actions">
                    {/* Spoiler açıldıysa gizle butonu göster */}
                    {isSpoiler && spoilerRevealed && (
                      <button 
                        className="spoiler-hide-btn"
                        onClick={(e) => { e.stopPropagation(); setSpoilerRevealed(false); }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>visibility_off</span>
                        Gizle
                      </button>
                    )}
                    {/* Uzun yorum için daha fazla gör */}
                    {hasFullComment && (
                      <button className="read-more-link" onClick={(e) => { e.stopPropagation(); handleGoToComment(); }}>
                        daha fazlasını gör
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Diğer türler için yorum varsa göster */}
          {aktiviteTuru.toLowerCase() !== 'yorum' && veri?.yorumOzet && (
            <div className="content-user-comment">
              <p>"{getCommentExcerpt(veri.yorumOzet)}"</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Compact modda sadece yorum/puan bilgisi */}
      {compact && (
        <div className="compact-activity-info">
          {veri?.puan && veri.puan > 0 && (
            <div className="user-rating-display">
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span 
                    key={star} 
                    className={`material-symbols-rounded ${star <= Math.round(displayRating) ? 'filled' : ''}`}
                  >
                    star
                  </span>
                ))}
              </div>
              <span className="rating-value">{veri.puan.toFixed(1)}</span>
            </div>
          )}
          {/* Yorum içeriği - spoiler kontrolü ile */}
          {commentExcerpt && (
            <>
              {isSpoiler && !spoilerRevealed ? (
                <div 
                  className="content-user-comment spoiler-hidden"
                  onClick={(e) => { e.stopPropagation(); setSpoilerRevealed(true); }}
                >
                  <p>"{commentExcerpt}"</p>
                  <div className="spoiler-overlay">
                    <span className="material-symbols-rounded">visibility_off</span>
                    Spoiler - görmek için tıkla
                  </div>
                </div>
              ) : (
                <div className="content-user-comment">
                  <p>"{commentExcerpt}"</p>
                  <div className="comment-actions">
                    {isSpoiler && spoilerRevealed && (
                      <button 
                        className="spoiler-hide-btn"
                        onClick={(e) => { e.stopPropagation(); setSpoilerRevealed(false); }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>visibility_off</span>
                        Gizle
                      </button>
                    )}
                    {hasFullComment && (
                      <button className="read-more-link" onClick={(e) => { e.stopPropagation(); handleGoToComment(); }}>
                        daha fazlasını gör
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ACTIONS: Sadece Beğen ve Yorum butonları
      ═══════════════════════════════════════════════════════════ */}
      <div className="activity-actions">
        <button 
          onClick={handleLike}
          disabled={isLiking || !isLoggedIn}
          className={`action-button ${liked ? 'liked' : ''}`}
          title={liked ? 'Beğenmekten vazgeç' : 'Beğen'}
        >
          <span className="material-symbols-rounded">{liked ? 'favorite' : 'favorite_border'}</span>
          <span>{likeCount > 0 ? likeCount : 'Beğen'}</span>
        </button>
        
        <button 
          className={`action-button ${showComments ? 'active' : ''}`}
          onClick={handleCommentsClick}
          title="Yorum yap"
        >
          <span className="material-symbols-rounded">chat_bubble_outline</span>
          <span>{commentCount > 0 ? commentCount : 'Yorum'}</span>
        </button>
      </div>

      {/* Inline Comments Section - Expands below card */}
      <InlineComments
        aktiviteId={aktivite.id}
        isOpen={showComments}
        isLoggedIn={isLoggedIn}
        currentUserName={currentUserName}
        onCommentAdded={() => setCommentCount(c => c + 1)}
        onCommentDeleted={() => setCommentCount(c => Math.max(0, c - 1))}
      />
    </article>
  );
}

// ============================================
// SKELETON LOADER
// ============================================
function ActivitySkeleton() {
  return (
    <article className="activity-card">
      {/* Header Skeleton */}
      <div className="activity-header">
        {/* Avatar */}
        <div className="activity-avatar skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: '50%' }} />
        
        {/* Meta */}
        <div className="activity-meta" style={{ flex: 1 }}>
          <div className="activity-user" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="skeleton-shimmer" style={{ width: 100, height: 16, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: 140, height: 14, borderRadius: 4 }} />
          </div>
          <div className="skeleton-shimmer" style={{ width: 60, height: 12, borderRadius: 4, marginTop: 4 }} />
        </div>
        
        {/* Type Badge */}
        <div className="skeleton-shimmer" style={{ width: 60, height: 24, borderRadius: 6 }} />
      </div>
      
      {/* Content Preview Skeleton */}
      <div className="content-preview" style={{ display: 'flex', gap: 16, padding: '16px 0' }}>
        {/* Poster */}
        <div className="skeleton-shimmer" style={{ width: 100, height: 150, borderRadius: 12, flexShrink: 0 }} />
        
        {/* Content Info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton-shimmer" style={{ width: '70%', height: 20, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ width: '50%', height: 14, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ width: 120, height: 24, borderRadius: 6, marginTop: 8 }} />
          <div className="skeleton-shimmer" style={{ width: '90%', height: 14, borderRadius: 4, marginTop: 8 }} />
          <div className="skeleton-shimmer" style={{ width: '75%', height: 14, borderRadius: 4 }} />
        </div>
      </div>
      
      {/* Footer Skeleton */}
      <div className="activity-footer" style={{ display: 'flex', gap: 16, paddingTop: 12, borderTop: '1px solid var(--void-border)' }}>
        <div className="skeleton-shimmer" style={{ width: 60, height: 32, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 60, height: 32, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 60, height: 32, borderRadius: 8 }} />
      </div>
    </article>
  );
}

// ============================================
// EMPTY STATE
// ============================================
interface EmptyStateProps {
  isLoggedIn: boolean;
  activeTab?: string;
}

function EmptyState({ isLoggedIn, activeTab }: EmptyStateProps) {
  const navigate = useNavigate();

  // Arkadaşlar filtresinde özel mesaj
  if (activeTab === 'takip') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </div>
        <h3>Arkadaşlarından aktivite yok</h3>
        <p>Takip ettiğin kullanıcıların aktiviteleri burada görünür. Yeni kullanıcılar keşfet!</p>
        <button 
          onClick={() => navigate('/kesfet')}
          className="load-more-btn"
          style={{ marginTop: '20px' }}
        >
          Kullanıcı Keşfet
        </button>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
        </svg>
      </div>
      <h3>Henüz aktivite yok</h3>
      <p>
        {isLoggedIn
          ? 'Kullanıcıları takip ederek aktivitelerini burada görün.'
          : 'Keşfet sayfasından içerikleri inceleyebilirsiniz.'}
      </p>
      <button 
        onClick={() => navigate('/kesfet')}
        className="load-more-btn"
        style={{ marginTop: '20px' }}
      >
        Keşfet
      </button>
    </div>
  );
}

// ============================================
// FEED TABS COMPONENT
// ============================================
interface FeedTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isLoggedIn: boolean;
}

function FeedTabs({ activeTab, onTabChange, isLoggedIn }: FeedTabsProps) {
  const tabs = isLoggedIn 
    ? [
        { id: 'hepsi', label: 'Tümü' },
        { id: 'takip', label: 'Arkadaşlar' },
        { id: 'puanlama', label: 'Puanladılar' },
        { id: 'yorum', label: 'Yorumlar' },
        { id: 'liste', label: 'Listeler' },
      ]
    : [
        { id: 'hepsi', label: 'Tümü' },
        { id: 'puanlama', label: 'Puanladılar' },
        { id: 'yorum', label: 'Yorumlar' },
        { id: 'liste', label: 'Listeler' },
      ];

  return (
    <div className="feed-tabs-wrapper">
      <div className="feed-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`feed-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN FEED PAGE COMPONENT
// ============================================
export default function FeedPage() {
  const { user } = useAuth();
  const [aktiviteler, setAktiviteler] = useState<Aktivite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sayfa, setSayfa] = useState(1);
  const [toplamSayfa, setToplamSayfa] = useState(999); // Başlangıçta yüksek değer - yüklenene kadar "all loaded" gösterme
  const [activeTab, setActiveTab] = useState('hepsi');
  const [allLoaded, setAllLoaded] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false); // İlk yükleme tamamlandı mı
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Pull to refresh states
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  
  // Scroll-to-top refresh states
  const [showScrollTopRefresh, setShowScrollTopRefresh] = useState(false);
  const lastScrollY = useRef(0);
  const isAtTop = useRef(true);
  const scrollTopCount = useRef(0);
  const scrollTopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Double load prevention
  const isDataLoadedRef = useRef(false);
  const currentTabRef = useRef(activeTab);

  // Aktiviteleri yükle
  // Ref'ler ile güncel değerleri sakla (closure sorununu önlemek için)
  const userRef = useRef(user);
  const activeTabRef = useRef(activeTab);
  
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Scroll event handler for scroll-to-top refresh
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const wasAtTop = isAtTop.current;
      isAtTop.current = scrollY < 10;
      
      // Kullanıcı en üstteyken tekrar yukarı scroll yapmaya çalışırsa
      if (isAtTop.current && wasAtTop && scrollY === 0) {
        scrollTopCount.current += 1;
        
        // Timer'ı sıfırla
        if (scrollTopTimer.current) {
          clearTimeout(scrollTopTimer.current);
        }
        
        // 500ms içinde 2 kez yukarı scroll yapılırsa yenile
        if (scrollTopCount.current >= 2) {
          scrollTopCount.current = 0;
          if (!isRefreshing && !loading) {
            setShowScrollTopRefresh(true);
            handleRefresh().then(() => {
              setShowScrollTopRefresh(false);
            });
          }
        }
        
        scrollTopTimer.current = setTimeout(() => {
          scrollTopCount.current = 0;
        }, 500);
      }
      
      lastScrollY.current = scrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTopTimer.current) {
        clearTimeout(scrollTopTimer.current);
      }
    };
  }, [isRefreshing, loading]);

  const fetchAktiviteler = useCallback(
    async (page: number, append: boolean = false, forceRefresh: boolean = false) => {
      try {
        const currentUser = userRef.current;
        const currentTab = activeTabRef.current;
        
        // Cache check for first page only (not append, not force refresh)
        if (page === 1 && !append && !forceRefresh) {
          const cached = getFeedCache(currentTab, currentUser?.id);
          if (cached) {
            setAktiviteler(cached.data);
            setToplamSayfa(cached.toplamSayfa);
            setLoading(false);
            setInitialLoadComplete(true);
            setAllLoaded(cached.data.length < 15 || cached.toplamSayfa <= 1);
            
            // Arka planda güncelle
            fetchAktiviteler(1, false, true).catch(console.error);
            return;
          }
        }
        
        if (page === 1 && !append) {
          setLoading(true);
          setAllLoaded(false);
        } else if (append) {
          setLoadingMore(true);
        }
        setError(null);
        
        let result;

        if (currentUser && currentTab === 'takip') {
          // Arkadaşlar filtresi - sadece takip edilen kullanıcıların aktiviteleri
          result = await aktiviteApi.getFeed({ sayfa: page, limit: 15 });
        } else {
          result = await aktiviteApi.getGenelFeed({ sayfa: page, limit: 15 });
        }

        // Filter by type if needed (for genel feed)
        let filteredData = result.data;
        if (currentTab !== 'takip' && currentTab !== 'hepsi') {
          if (currentTab === 'puanlama') {
            filteredData = result.data.filter((a: Aktivite) => 
              (a.aktiviteTuru || a.aktiviteTipiStr || '').toLowerCase() === 'puanlama'
            );
          } else if (currentTab === 'yorum') {
            filteredData = result.data.filter((a: Aktivite) => 
              (a.aktiviteTuru || a.aktiviteTipiStr || '').toLowerCase() === 'yorum'
            );
          } else if (currentTab === 'liste') {
            filteredData = result.data.filter((a: Aktivite) => {
              const type = (a.aktiviteTuru || a.aktiviteTipiStr || '').toLowerCase();
              return type === 'listeye_ekleme' || type === 'kutuphaneyeekleme' || type === 'listeolusturma';
            });
          }
        }

        // Check if all data loaded - sadece gerçekten son sayfa ise
        const isLastPage = page >= result.toplamSayfa;
        const noMoreData = result.data.length < 15;
        if (isLastPage || noMoreData) {
          setAllLoaded(true);
        }

        if (append) {
          setAktiviteler((prev) => [...prev, ...filteredData]);
        } else {
          setAktiviteler(filteredData);
          // Cache'e kaydet (sadece ilk sayfa)
          if (page === 1) {
            setFeedCache(currentTab, filteredData, result.toplamSayfa, currentUser?.id);
          }
        }
        setToplamSayfa(result.toplamSayfa);
        setInitialLoadComplete(true); // İlk yükleme tamamlandı
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        console.error('Feed yükleme hatası:', err);
        setError(error.response?.data?.message || 'Aktiviteler yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [] // Stabil fonksiyon - ref'ler üzerinden güncel değerlere erişir
  );

  // İlk yükleme ve activeTab değişikliklerinde fetch
  useEffect(() => {
    // Tab değişti mi kontrol et
    if (activeTab !== currentTabRef.current) {
      currentTabRef.current = activeTab;
      isDataLoadedRef.current = false;
      // Tab değişince state'leri sıfırla
      setAllLoaded(false);
      setInitialLoadComplete(false);
      setToplamSayfa(999);
    }
    
    // Çift yükleme önle
    if (isDataLoadedRef.current) return;
    isDataLoadedRef.current = true;
    
    setSayfa(1);
    fetchAktiviteler(1);
  }, [activeTab, fetchAktiviteler]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !loadingMore && !allLoaded && sayfa < toplamSayfa) {
          const nextPage = sayfa + 1;
          setSayfa(nextPage);
          fetchAktiviteler(nextPage, true);
        }
      },
      { 
        threshold: 0, // Hemen tetikle
        rootMargin: '400px' // 400px önce tetikle - daha erken yükle
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sayfa, toplamSayfa, loadingMore, allLoaded, fetchAktiviteler]);

  const handleRefresh = async () => {
    // Cache'i temizle ve yeniden yükle
    invalidateFeedCache(activeTab, user?.id);
    setSayfa(1);
    setAllLoaded(false);
    setInitialLoadComplete(false);
    setToplamSayfa(999); // Reset toplamSayfa
    await fetchAktiviteler(1, false, true);
  };
  
  // Aktivite silme handler'ı - cache'i de güncelle
  const handleDeleteActivity = useCallback((id: number) => {
    setAktiviteler(prev => prev.filter(a => a.id !== id));
    removeFromFeedCache(id);
  }, []);

  // Pull to refresh handlers
  const PULL_THRESHOLD = 80;
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      pullStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - pullStartY.current;
    
    if (diff > 0 && window.scrollY === 0) {
      // Resistance effect - pull gets harder as you go
      const resistance = Math.min(diff * 0.4, 120);
      setPullDistance(resistance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(60); // Keep indicator visible during refresh
      await handleRefresh();
      setIsRefreshing(false);
    }
    
    setPullDistance(0);
    setIsPulling(false);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSayfa(1);
  };

  return (
    <div 
      className="feed-page"
      ref={feedContainerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main Content - Full width, responsive */}
      <main className="feed-content">
        {/* Filter Tabs - Pill style */}
        <FeedTabs 
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isLoggedIn={!!user}
        />
        
        {/* Scroll-to-top Refresh Indicator */}
        {showScrollTopRefresh && (
          <div className="scroll-top-refresh-indicator">
            <div className="pull-spinner spinning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
            <span>Yenileniyor...</span>
          </div>
        )}
        
        {/* Pull to Refresh Indicator */}
        <div 
          className={`pull-to-refresh-indicator ${isRefreshing ? 'refreshing' : ''}`}
          style={{ 
            height: pullDistance,
            opacity: Math.min(pullDistance / PULL_THRESHOLD, 1)
          }}
        >
          <div className={`pull-spinner ${isRefreshing ? 'spinning' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
          <span>{isRefreshing ? 'Yenileniyor...' : (pullDistance >= PULL_THRESHOLD ? 'Bırak ve yenile' : 'Yenilemek için çek')}</span>
        </div>

        {/* Error State */}
        {error && (
          <div className="error-state">
            <p className="error-message">{error}</p>
            <button 
              onClick={handleRefresh}
              className="load-more-btn"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="activity-feed">
            {[1, 2, 3].map((i) => (
              <ActivitySkeleton key={i} />
            ))}
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {aktiviteler.length === 0 ? (
              <EmptyState isLoggedIn={!!user} activeTab={activeTab} />
            ) : (
              <div className="activity-feed">
                {aktiviteler
                  .filter((aktivite) => {
                    // Takip aktivitelerini ve içerik bilgisi olmayan aktiviteleri hariç tut
                    const tur = (aktivite.aktiviteTuru || aktivite.aktiviteTipiStr || '').toLowerCase();
                    if (tur === 'takip' || tur === 'takipetme') return false;
                    // İçerik bilgisi olmayan aktiviteleri de hariç tut
                    if (!aktivite.veri?.baslik && !aktivite.icerikId) return false;
                    return true;
                  })
                  .map((aktivite, index) => (
                  <FeedActivityCard
                    key={aktivite.id}
                    aktivite={aktivite}
                    isLoggedIn={!!user}
                    index={index}
                    currentUserName={user?.kullaniciAdi}
                    onDelete={handleDeleteActivity}
                  />
                ))}
              </div>
            )}

            {/* Infinite Scroll Trigger */}
            {aktiviteler.length > 0 && (
              <div className="load-more-container" ref={loadMoreRef}>
                {loadingMore ? (
                  <div className="infinite-scroll-loading">
                    <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    <span>Yükleniyor...</span>
                  </div>
                ) : initialLoadComplete && (allLoaded || sayfa >= toplamSayfa) ? (
                  <div className="all-loaded-message">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                      <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                    </svg>
                    <span>Tüm aktiviteler yüklendi</span>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
