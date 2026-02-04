import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import type { PanInfo } from 'motion/react';
import {
  Loader2, Sparkles, Film, Tv, BookOpen, ChevronLeft, ChevronRight,
  Download, Clock, FileText, Star, Trophy, Heart, X, Calendar, MessageSquare, TrendingUp
} from 'lucide-react';
import { aiApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './YearlySummaryPage.css';

type SummaryData = Awaited<ReturnType<typeof aiApi.getSummary>>;

// Spotify Wrapped tarzı slide tipleri
interface Slide {
  id: string;
  type: 'intro' | 'total' | 'breakdown' | 'genre' | 'author' | 'favorite' | 'time' | 'activity' | 'ratings' | 'ai' | 'share';
  gradient: string;
}

const SLIDES: Slide[] = [
  { id: 'intro', type: 'intro', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
  { id: 'total', type: 'total', gradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { id: 'breakdown', type: 'breakdown', gradient: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)' },
  { id: 'activity', type: 'activity', gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { id: 'ratings', type: 'ratings', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'genre', type: 'genre', gradient: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { id: 'author', type: 'author', gradient: 'linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)' },
  { id: 'favorite', type: 'favorite', gradient: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'time', type: 'time', gradient: 'linear-gradient(135deg, #200122 0%, #6f0000 100%)' },
  { id: 'ai', type: 'ai', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #e4b863 5%, #1a1a2e 10%, #16213e 100%)' },
  { id: 'share', type: 'share', gradient: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)' },
];

// Sayı animasyonu için özel hook
function useCountUp(end: number, duration = 2000, start = 0) {
  const [count, setCount] = useState(start);
  const [isAnimating, setIsAnimating] = useState(false);

  const animate = useCallback(() => {
    setIsAnimating(true);
    const startTime = Date.now();
    const diff = end - start;

    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing: easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(start + diff * eased));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setIsAnimating(false);
      }
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);

  return { count, animate, isAnimating };
}

// Animasyonlu sayı komponenti
function AnimatedNumber({ value, suffix = '', delay = 0 }: { value: number; suffix?: string; delay?: number }) {
  const { count, animate } = useCountUp(value, 1500);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStarted(true);
      animate();
    }, delay);
    return () => clearTimeout(timer);
  }, [animate, delay]);

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay / 1000, type: 'spring', stiffness: 100 }}
    >
      {started ? count.toLocaleString('tr-TR') : '0'}{suffix}
    </motion.span>
  );
}

// Progress bar komponenti
function ProgressBar({ progress, color = '#e4b863' }: { progress: number; color?: string }) {
  return (
    <div className="ws-progress-track">
      <motion.div
        className="ws-progress-fill"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(progress, 100)}%` }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

// Staggered list item
function StaggeredItem({ children, index }: { children: React.ReactNode; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: 0.2 + index * 0.15,
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1]
      }}
    >
      {children}
    </motion.div>
  );
}

// Parçacık efekti
function Particles() {
  const particles = useMemo(() => 
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2
    })), []
  );

  return (
    <div className="ws-particles">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="ws-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.2, 1]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut'
          }}
        />
      ))}
    </div>
  );
}

export default function YearlySummaryPage() {
  const { year } = useParams<{ year?: string }>();
  const navigate = useNavigate();
  const { user, requireAuth } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(parseInt(year || `${currentYear}`, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  // Swipe için motion value
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-200, 0, 200], [0.5, 1, 0.5]);

  useEffect(() => {
    if (year) {
      const parsed = parseInt(year, 10);
      if (!Number.isNaN(parsed)) {
        setSelectedYear(parsed);
      }
    }
  }, [year]);

  useEffect(() => {
    if (!requireAuth('summary')) return;
  }, [requireAuth]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await aiApi.getSummary(selectedYear);
        setSummary(data);
        setCurrentSlide(0);
      } catch (err) {
        console.error('Özet yükleme hatası:', err);
        setError('Özet yüklenemedi.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedYear, user]);

  const typeCounts = summary?.stats?.typeCounts || {};
  const filmCount = typeCounts.Film || typeCounts.film || 0;
  const diziCount = typeCounts.Dizi || typeCounts.dizi || 0;
  const kitapCount = typeCounts.Kitap || typeCounts.kitap || 0;
  const totalCount = summary?.stats?.totalCount || 0;

  const goPrev = useCallback(() => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide((s) => s - 1);
    }
  }, [currentSlide]);

  const goNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      setDirection(1);
      setCurrentSlide((s) => s + 1);
    }
  }, [currentSlide]);

  const goToSlide = useCallback((index: number) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  }, [currentSlide]);

  // Klavye navigasyonu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape') navigate('/kesfet');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goPrev, goNext, navigate]);

  // Swipe handler
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      goNext();
    } else if (info.offset.x > threshold) {
      goPrev();
    }
  };

  // SVG paylaşım oluştur
  const generateShareImage = useCallback(() => {
    if (!summary) return;
    
    const topGenre = summary.stats.topGenres?.[0] || '—';
    const topAuthor = summary.stats.topAuthors?.[0] || '—';
    const topRated = summary.stats.topRated?.[0]?.baslik || '—';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0c" />
      <stop offset="50%" stop-color="#1a1a2e" />
      <stop offset="100%" stop-color="#16213e" />
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#d4a853" />
      <stop offset="50%" stop-color="#e4b863" />
      <stop offset="100%" stop-color="#c9973a" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)" />
  
  <!-- Logo -->
  <text x="540" y="200" fill="url(#gold)" font-size="72" font-family="Inter, sans-serif" font-weight="800" text-anchor="middle">SAGA ${selectedYear}</text>
  <text x="540" y="280" fill="#ffffff" opacity="0.7" font-size="32" font-family="Inter, sans-serif" text-anchor="middle">Yıllık Özet</text>
  
  <!-- Toplam -->
  <text x="540" y="480" fill="#ffffff" font-size="180" font-family="Inter, sans-serif" font-weight="900" text-anchor="middle">${totalCount}</text>
  <text x="540" y="560" fill="#ffffff" opacity="0.6" font-size="36" font-family="Inter, sans-serif" text-anchor="middle">içerik tamamlandı</text>
  
  <!-- Breakdown -->
  <rect x="140" y="650" width="250" height="200" rx="24" fill="rgba(255,255,255,0.05)" />
  <text x="265" y="720" fill="#e4b863" font-size="28" font-family="Inter, sans-serif" text-anchor="middle">Film</text>
  <text x="265" y="800" fill="#ffffff" font-size="64" font-family="Inter, sans-serif" font-weight="700" text-anchor="middle">${filmCount}</text>
  
  <rect x="415" y="650" width="250" height="200" rx="24" fill="rgba(255,255,255,0.05)" />
  <text x="540" y="720" fill="#e4b863" font-size="28" font-family="Inter, sans-serif" text-anchor="middle">Dizi</text>
  <text x="540" y="800" fill="#ffffff" font-size="64" font-family="Inter, sans-serif" font-weight="700" text-anchor="middle">${diziCount}</text>
  
  <rect x="690" y="650" width="250" height="200" rx="24" fill="rgba(255,255,255,0.05)" />
  <text x="815" y="720" fill="#e4b863" font-size="28" font-family="Inter, sans-serif" text-anchor="middle">Kitap</text>
  <text x="815" y="800" fill="#ffffff" font-size="64" font-family="Inter, sans-serif" font-weight="700" text-anchor="middle">${kitapCount}</text>
  
  <!-- Favori Tür -->
  <rect x="140" y="920" width="800" height="180" rx="24" fill="rgba(228,184,99,0.1)" stroke="rgba(228,184,99,0.3)" />
  <text x="180" y="990" fill="#e4b863" font-size="28" font-family="Inter, sans-serif">Favori Tür</text>
  <text x="180" y="1060" fill="#ffffff" font-size="48" font-family="Inter, sans-serif" font-weight="700">${topGenre}</text>
  
  <!-- Favori Yazar -->
  <rect x="140" y="1130" width="800" height="180" rx="24" fill="rgba(228,184,99,0.1)" stroke="rgba(228,184,99,0.3)" />
  <text x="180" y="1200" fill="#e4b863" font-size="28" font-family="Inter, sans-serif">En Çok Okunan Yazar</text>
  <text x="180" y="1270" fill="#ffffff" font-size="48" font-family="Inter, sans-serif" font-weight="700">${topAuthor.length > 25 ? topAuthor.substring(0, 25) + '...' : topAuthor}</text>
  
  <!-- Yılın Favorisi -->
  <rect x="140" y="1340" width="800" height="180" rx="24" fill="rgba(228,184,99,0.1)" stroke="rgba(228,184,99,0.3)" />
  <text x="180" y="1410" fill="#e4b863" font-size="28" font-family="Inter, sans-serif">Yılın Favorisi</text>
  <text x="180" y="1480" fill="#ffffff" font-size="42" font-family="Inter, sans-serif" font-weight="700">${topRated.length > 30 ? topRated.substring(0, 30) + '...' : topRated}</text>
  
  <!-- Süre -->
  <text x="540" y="1650" fill="#ffffff" opacity="0.8" font-size="32" font-family="Inter, sans-serif" text-anchor="middle">${summary.stats.totalMinutes.toLocaleString('tr-TR')} dakika · ${summary.stats.totalPages.toLocaleString('tr-TR')} sayfa</text>
  
  <!-- Footer -->
  <text x="540" y="1820" fill="#ffffff" opacity="0.4" font-size="24" font-family="Inter, sans-serif" text-anchor="middle">saga.app</text>
</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `saga-${selectedYear}-wrapped.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [summary, selectedYear, totalCount, filmCount, diziCount, kitapCount]);

  // Slide içerikleri render
  const renderSlideContent = (slide: Slide) => {
    if (!summary) return null;

    const textVariants = {
      hidden: { opacity: 0, y: 30 },
      visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
          delay: 0.3 + i * 0.15,
          duration: 0.8,
          ease: 'easeOut' as const
        }
      })
    };

    switch (slide.type) {
      case 'intro':
        return (
          <div className="ws-slide-content ws-center">
            <Particles />
            <motion.div
              className="ws-logo"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
            >
              <Sparkles size={48} />
            </motion.div>
            <motion.h1
              className="ws-title-giant"
              custom={0}
              initial="hidden"
              animate="visible"
              variants={textVariants}
            >
              {selectedYear}
            </motion.h1>
            <motion.p
              className="ws-subtitle"
              custom={1}
              initial="hidden"
              animate="visible"
              variants={textVariants}
            >
              Senin yılın nasıl geçti?
            </motion.p>
            <motion.div
              className="ws-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              <ChevronRight size={20} />
              <span>Devam etmek için kaydır veya tıkla</span>
            </motion.div>
          </div>
        );

      case 'total':
        return (
          <div className="ws-slide-content ws-center">
            <motion.p
              className="ws-label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Bu yıl
            </motion.p>
            <motion.div
              className="ws-number-giant"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 80, delay: 0.4 }}
            >
              <AnimatedNumber value={totalCount} delay={600} />
            </motion.div>
            <motion.p
              className="ws-label-large"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              içerik tamamladın
            </motion.p>
            <motion.div
              className="ws-emoji-row"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2, type: 'spring' }}
            >
              🎬 📺 📚
            </motion.div>
          </div>
        );

      case 'breakdown':
        return (
          <div className="ws-slide-content">
            <motion.h2
              className="ws-section-title"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              İçerik Dağılımın
            </motion.h2>
            
            <div className="ws-breakdown-grid">
              <StaggeredItem index={0}>
                <div className="ws-breakdown-card">
                  <div className="ws-breakdown-icon"><Film size={32} /></div>
                  <div className="ws-breakdown-info">
                    <span className="ws-breakdown-label">Film</span>
                    <span className="ws-breakdown-value">
                      <AnimatedNumber value={filmCount} delay={400} />
                    </span>
                  </div>
                  <ProgressBar progress={(filmCount / totalCount) * 100} color="#f59e0b" />
                </div>
              </StaggeredItem>

              <StaggeredItem index={1}>
                <div className="ws-breakdown-card">
                  <div className="ws-breakdown-icon"><Tv size={32} /></div>
                  <div className="ws-breakdown-info">
                    <span className="ws-breakdown-label">Dizi</span>
                    <span className="ws-breakdown-value">
                      <AnimatedNumber value={diziCount} delay={600} />
                    </span>
                  </div>
                  <ProgressBar progress={(diziCount / totalCount) * 100} color="#8b5cf6" />
                </div>
              </StaggeredItem>

              <StaggeredItem index={2}>
                <div className="ws-breakdown-card">
                  <div className="ws-breakdown-icon"><BookOpen size={32} /></div>
                  <div className="ws-breakdown-info">
                    <span className="ws-breakdown-label">Kitap</span>
                    <span className="ws-breakdown-value">
                      <AnimatedNumber value={kitapCount} delay={800} />
                    </span>
                  </div>
                  <ProgressBar progress={(kitapCount / totalCount) * 100} color="#10b981" />
                </div>
              </StaggeredItem>
            </div>
          </div>
        );

      case 'activity':
        const monthlyActivity = summary.stats.monthlyActivity || [];
        const maxMonthCount = Math.max(...monthlyActivity.map(m => m.count), 1);
        return (
          <div className="ws-slide-content">
            <motion.div
              className="ws-icon-badge ws-activity-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <Calendar size={28} />
            </motion.div>
            <motion.h2
              className="ws-section-title"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Yıl Boyunca Aktiviten
            </motion.h2>

            {summary.stats.mostActiveMonth && (
              <motion.div
                className="ws-activity-highlight"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <span className="ws-highlight-label">En aktif ayın</span>
                <span className="ws-highlight-value">{summary.stats.mostActiveMonth}</span>
                <span className="ws-highlight-sub">{summary.stats.mostActiveMonthCount} içerik</span>
              </motion.div>
            )}

            <div className="ws-activity-chart">
              {monthlyActivity.map((month, i) => (
                <motion.div
                  key={month.month}
                  className="ws-activity-bar-container"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                >
                  <motion.div
                    className="ws-activity-bar"
                    initial={{ height: 0 }}
                    animate={{ height: `${(month.count / maxMonthCount) * 100}%` }}
                    transition={{ delay: 0.7 + i * 0.05, duration: 0.8, ease: 'easeOut' }}
                  />
                  <span className="ws-activity-label">{month.monthName.slice(0, 3)}</span>
                </motion.div>
              ))}
            </div>

            {summary.stats.favoriteDay && (
              <motion.p
                className="ws-activity-insight"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
              >
                En çok <strong>{summary.stats.favoriteDay}</strong> günleri aktifsin 📅
              </motion.p>
            )}
          </div>
        );

      case 'ratings':
        return (
          <div className="ws-slide-content ws-center">
            <motion.div
              className="ws-icon-badge ws-ratings-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <Star size={28} />
            </motion.div>
            <motion.h2
              className="ws-section-title"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Puanlama İstatistiklerin
            </motion.h2>

            <div className="ws-ratings-stats">
              <StaggeredItem index={0}>
                <div className="ws-rating-card ws-rating-main">
                  <span className="ws-rating-big">
                    <AnimatedNumber value={Math.round((summary.stats.averageRating || 0) * 10) / 10} delay={400} />
                  </span>
                  <span className="ws-rating-label">Ortalama Puanın</span>
                  <div className="ws-rating-stars">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        size={20}
                        fill={star <= Math.round(summary.stats.averageRating / 2) ? '#fbbf24' : 'transparent'}
                        color="#fbbf24"
                      />
                    ))}
                  </div>
                </div>
              </StaggeredItem>

              <div className="ws-ratings-row">
                <StaggeredItem index={1}>
                  <div className="ws-rating-card">
                    <TrendingUp size={24} className="ws-rating-icon" />
                    <span className="ws-rating-value">
                      <AnimatedNumber value={summary.stats.totalRatings} delay={600} />
                    </span>
                    <span className="ws-rating-label">Puanlama</span>
                  </div>
                </StaggeredItem>

                <StaggeredItem index={2}>
                  <div className="ws-rating-card">
                    <MessageSquare size={24} className="ws-rating-icon" />
                    <span className="ws-rating-value">
                      <AnimatedNumber value={summary.stats.totalReviews} delay={800} />
                    </span>
                    <span className="ws-rating-label">Yorum</span>
                  </div>
                </StaggeredItem>
              </div>

              <div className="ws-status-row">
                <StaggeredItem index={3}>
                  <div className="ws-status-item ws-status-completed">
                    <span className="ws-status-count">{summary.stats.completedCount}</span>
                    <span className="ws-status-label">Tamamlandı</span>
                  </div>
                </StaggeredItem>
                <StaggeredItem index={4}>
                  <div className="ws-status-item ws-status-watching">
                    <span className="ws-status-count">{summary.stats.watchingCount}</span>
                    <span className="ws-status-label">Devam Ediyor</span>
                  </div>
                </StaggeredItem>
                <StaggeredItem index={5}>
                  <div className="ws-status-item ws-status-planned">
                    <span className="ws-status-count">{summary.stats.plannedCount}</span>
                    <span className="ws-status-label">Planlandı</span>
                  </div>
                </StaggeredItem>
              </div>
            </div>
          </div>
        );

      case 'genre':
        const topGenres = summary.stats.topGenres.slice(0, 5);
        return (
          <div className="ws-slide-content">
            <motion.div
              className="ws-icon-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <Heart size={28} />
            </motion.div>
            <motion.h2
              className="ws-section-title"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Favori Türlerin
            </motion.h2>

            {topGenres.length > 0 ? (
              <div className="ws-genre-list">
                {topGenres.map((genre, i) => (
                  <StaggeredItem key={genre} index={i}>
                    <div className={`ws-genre-item ${i === 0 ? 'ws-genre-top' : ''}`}>
                      <span className="ws-genre-rank">#{i + 1}</span>
                      <span className="ws-genre-name">{genre}</span>
                      {i === 0 && <Trophy size={20} className="ws-genre-trophy" />}
                    </div>
                  </StaggeredItem>
                ))}
              </div>
            ) : (
              <motion.p
                className="ws-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Henüz tür verisi yok
              </motion.p>
            )}
          </div>
        );

      case 'author':
        const topAuthors = summary.stats.topAuthors.slice(0, 5);
        return (
          <div className="ws-slide-content">
            <motion.div
              className="ws-icon-badge ws-author-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <FileText size={28} />
            </motion.div>
            <motion.h2
              className="ws-section-title"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              En Çok Okuduğun Yazarlar
            </motion.h2>

            {topAuthors.length > 0 ? (
              <div className="ws-author-list">
                {topAuthors.map((author, i) => (
                  <StaggeredItem key={author} index={i}>
                    <div className={`ws-author-item ${i === 0 ? 'ws-author-top' : ''}`}>
                      <span className="ws-author-rank">#{i + 1}</span>
                      <span className="ws-author-name">{author}</span>
                    </div>
                  </StaggeredItem>
                ))}
              </div>
            ) : (
              <motion.p
                className="ws-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Henüz yazar verisi yok
              </motion.p>
            )}
          </div>
        );

      case 'favorite':
        const topRated = summary.stats.topRated.slice(0, 3);
        return (
          <div className="ws-slide-content">
            <motion.div
              className="ws-icon-badge ws-star-badge"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <Star size={28} />
            </motion.div>
            <motion.h2
              className="ws-section-title"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              En Yüksek Puanladıkların
            </motion.h2>

            {topRated.length > 0 ? (
              <div className="ws-favorites-list">
                {topRated.map((item, i) => (
                  <StaggeredItem key={item.baslik} index={i}>
                    <div className={`ws-favorite-item ${i === 0 ? 'ws-favorite-top' : ''}`}>
                      <div className="ws-favorite-rank">
                        {i === 0 ? <Trophy size={24} /> : `#${i + 1}`}
                      </div>
                      <div className="ws-favorite-info">
                        <span className="ws-favorite-title">{item.baslik}</span>
                        <span className="ws-favorite-meta">{item.tur}</span>
                      </div>
                      {item.puan && (
                        <div className="ws-favorite-rating">
                          <Star size={16} fill="#e4b863" />
                          <span>{item.puan.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </StaggeredItem>
                ))}
              </div>
            ) : (
              <motion.p
                className="ws-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Henüz puanlama yok
              </motion.p>
            )}
          </div>
        );

      case 'time':
        return (
          <div className="ws-slide-content ws-center">
            <motion.div
              className="ws-icon-badge ws-time-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <Clock size={28} />
            </motion.div>
            <motion.h2
              className="ws-section-title"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Harcadığın Zaman
            </motion.h2>

            <div className="ws-time-stats">
              <motion.div
                className="ws-time-stat"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <span className="ws-time-value">
                  <AnimatedNumber value={summary.stats.totalMinutes} delay={600} />
                </span>
                <span className="ws-time-label">dakika izleme</span>
              </motion.div>

              <motion.div
                className="ws-time-stat"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 }}
              >
                <span className="ws-time-value">
                  <AnimatedNumber value={summary.stats.totalPages} delay={900} />
                </span>
                <span className="ws-time-label">sayfa okuma</span>
              </motion.div>
            </div>

            <motion.p
              className="ws-time-insight"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
            >
              {summary.stats.totalMinutes > 1000
                ? '🔥 Gerçek bir maratoncu!'
                : summary.stats.totalMinutes > 500
                ? '👏 Harika bir tempo!'
                : '🌱 Güzel bir başlangıç!'}
            </motion.p>
          </div>
        );

      case 'ai':
        return (
          <div className="ws-slide-content">
            <motion.div
              className="ws-icon-badge ws-ai-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <Sparkles size={28} />
            </motion.div>
            <motion.h2
              className="ws-section-title"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              AI Analizi
            </motion.h2>

            <motion.div
              className="ws-ai-narrative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <p>{summary.narrative}</p>
            </motion.div>
          </div>
        );

      case 'share':
        return (
          <div className="ws-slide-content ws-center">
            <Particles />
            <motion.div
              className="ws-share-card"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', delay: 0.3 }}
            >
              <div className="ws-share-preview">
                <div className="ws-share-year">{selectedYear}</div>
                <div className="ws-share-stats">
                  <span>{totalCount} içerik</span>
                  <span>{summary.stats.totalMinutes.toLocaleString('tr-TR')} dk</span>
                  <span>{summary.stats.totalPages.toLocaleString('tr-TR')} sayfa</span>
                </div>
              </div>
            </motion.div>

            <motion.h2
              className="ws-section-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              Özetini Paylaş!
            </motion.h2>

            <motion.div
              className="ws-share-buttons"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <button className="ws-share-btn" onClick={generateShareImage}>
                <Download size={20} />
                <span>Görsel İndir</span>
              </button>
            </motion.div>
          </div>
        );

      default:
        return null;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="ws-container ws-loading">
        <div className="ws-loader">
          <Loader2 size={48} className="animate-spin" />
          <p>Yıllık özetin hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="ws-container ws-error">
        <div className="ws-error-content">
          <X size={48} />
          <p>{error}</p>
          <button onClick={() => navigate('/kesfet')}>Geri Dön</button>
        </div>
      </div>
    );
  }

  // No summary
  if (!summary) {
    return null;
  }

  const currentSlideData = SLIDES[currentSlide];

  return (
    <div
      ref={containerRef}
      className="ws-container"
      style={{ background: currentSlideData.gradient }}
    >
      {/* Progress bar */}
      <div className="ws-progress">
        {SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            className={`ws-progress-segment ${i === currentSlide ? 'active' : ''} ${i < currentSlide ? 'completed' : ''}`}
            onClick={() => goToSlide(i)}
          />
        ))}
      </div>

      {/* Header */}
      <div className="ws-header">
        <button className="ws-close" onClick={() => navigate('/kesfet')}>
          <X size={24} />
        </button>
        <div className="ws-year-select">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Slide content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentSlide}
          className="ws-slide"
          custom={direction}
          initial={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction < 0 ? 300 : -300, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          style={{ x, opacity }}
        >
          {renderSlideContent(currentSlideData)}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="ws-nav">
        <button
          className="ws-nav-btn"
          onClick={goPrev}
          disabled={currentSlide === 0}
        >
          <ChevronLeft size={28} />
        </button>
        <div className="ws-slide-counter">
          {currentSlide + 1} / {SLIDES.length}
        </div>
        <button
          className="ws-nav-btn"
          onClick={goNext}
          disabled={currentSlide === SLIDES.length - 1}
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* Touch areas for mobile */}
      <div className="ws-touch-areas">
        <div className="ws-touch-left" onClick={goPrev} />
        <div className="ws-touch-right" onClick={goNext} />
      </div>
    </div>
  );
}
