import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  Star,
  Calendar,
  Loader2,
  MessageSquare,
  ThumbsUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { Yorum } from '../../services/api';

// ============================================
// NEBULA UI COMPONENTS
// ============================================

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-5 rounded-2xl bg-[rgba(20,20,35,0.65)] backdrop-blur-xl border border-[rgba(255,255,255,0.08)] shadow-lg ${className}`}>
      {children}
    </div>
  );
}

function Button({ 
  children, 
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick 
}: { 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50';
  const variantStyles = {
    primary: 'bg-gradient-to-r from-[#6C5CE7] to-[#a29bfe] text-white hover:shadow-lg hover:shadow-[#6C5CE7]/25',
    secondary: 'bg-[rgba(255,255,255,0.08)] text-white border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.12)]',
    ghost: 'bg-transparent text-[rgba(255,255,255,0.7)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]',
  };
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1',
    md: 'px-4 py-2 text-sm gap-2',
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
      {children}
    </button>
  );
}

type TabType = 'yorumlar' | 'aktiviteler';

export default function LikesPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('yorumlar');
  const [begenilenYorumlar, setBegenilenYorumlar] = useState<Yorum[]>([]);
  const [loading, setLoading] = useState(true);

  // Beğenilen yorumları yükle
  useEffect(() => {
    const loadBegeniler = async () => {
      if (!isAuthenticated || !user) return;
      
      setLoading(true);
      try {
        // Not: Backend'de beğenilen yorumları getiren endpoint olmayabilir
        // Bu demo amaçlı - gerçek implementasyon için backend endpoint gerekli
        // Şimdilik boş array döndürüyoruz
        setBegenilenYorumlar([]);
      } catch (err) {
        console.error('Beğeniler yüklenirken hata:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadBegeniler();
  }, [isAuthenticated, user]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto">
        <GlassCard className="text-center py-12">
          <Heart size={48} className="mx-auto mb-4 text-[#8E8E93]" />
          <h2 className="text-xl font-semibold text-white mb-2">Giriş Yapmalısınız</h2>
          <p className="text-[#8E8E93] mb-6">Beğenilerinizi görüntülemek için giriş yapın.</p>
          <Button onClick={() => navigate('/giris')}>Giriş Yap</Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Beğeniler</h1>
        <p className="text-[rgba(255,255,255,0.5)] text-sm mt-1">
          Beğendiğiniz içerikler ve yorumlar
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('yorumlar')}
          className={`
            px-4 py-2 rounded-xl text-sm font-medium transition-colors
            ${activeTab === 'yorumlar'
              ? 'bg-[#6C5CE7] text-white'
              : 'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.1)]'
            }
          `}
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={16} />
            Yorumlar
          </div>
        </button>
        <button
          onClick={() => setActiveTab('aktiviteler')}
          className={`
            px-4 py-2 rounded-xl text-sm font-medium transition-colors
            ${activeTab === 'aktiviteler'
              ? 'bg-[#6C5CE7] text-white'
              : 'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.1)]'
            }
          `}
        >
          <div className="flex items-center gap-2">
            <ThumbsUp size={16} />
            Aktiviteler
          </div>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-[#6C5CE7]" />
        </div>
      ) : activeTab === 'yorumlar' ? (
        begenilenYorumlar.length > 0 ? (
          <div className="space-y-4">
            {begenilenYorumlar.map((yorum) => (
              <GlassCard key={yorum.id} className="p-4">
                <div className="flex items-start gap-4">
                  {/* User Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#fd79a8] flex items-center justify-center text-white font-semibold">
                    {yorum.kullaniciAdi?.charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{yorum.kullaniciAdi}</span>
                      {yorum.puan && (
                        <div className="flex items-center gap-1 text-[#FF9F0A]">
                          <Star size={12} className="fill-current" />
                          <span className="text-xs">{yorum.puan}/10</span>
                        </div>
                      )}
                    </div>
                    
                    {yorum.baslik && (
                      <h4 className="font-medium text-white mb-1">{yorum.baslik}</h4>
                    )}
                    
                    <p className="text-sm text-[rgba(255,255,255,0.7)] line-clamp-3">
                      {yorum.icerik}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-3 text-xs text-[rgba(255,255,255,0.4)]">
                      <div className="flex items-center gap-1">
                        <Heart size={12} className="text-[#fd79a8] fill-current" />
                        <span>{yorum.begeniSayisi}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>{new Date(yorum.olusturulmaZamani).toLocaleDateString('tr-TR')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard className="text-center py-12">
            <Heart size={48} className="mx-auto mb-4 text-[#8E8E93]" />
            <h2 className="text-xl font-semibold text-white mb-2">Beğenilen Yorum Yok</h2>
            <p className="text-[#8E8E93] mb-6">
              Henüz hiçbir yorumu beğenmediniz. İçerikleri keşfedin ve beğendiğiniz yorumları kaydedin.
            </p>
            <Button onClick={() => navigate('/kesfet')}>Keşfet</Button>
          </GlassCard>
        )
      ) : (
        <GlassCard className="text-center py-12">
          <ThumbsUp size={48} className="mx-auto mb-4 text-[#8E8E93]" />
          <h2 className="text-xl font-semibold text-white mb-2">Beğenilen Aktivite Yok</h2>
          <p className="text-[#8E8E93] mb-6">
            Henüz hiçbir aktiviteyi beğenmediniz. Akışı kontrol edin ve beğendiğiniz paylaşımları kaydedin.
          </p>
          <Button onClick={() => navigate('/')}>Akışa Git</Button>
        </GlassCard>
      )}
    </div>
  );
}
