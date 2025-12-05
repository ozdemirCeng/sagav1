import './Skeletons.css';

// ═══════════════════════════════════════════════════════════════
// SKELETON COMPONENTS - VOID THEME
// Tüm sayfalarda kullanılabilir lazy loading animasyonları
// ═══════════════════════════════════════════════════════════════

// Temel Skeleton Box
export function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`skeleton-box ${className}`} />;
}

// ═══════════════════════════════════════════════════════════════
// CONTENT CARD SKELETON - Film/Dizi/Kitap kartları için
// ═══════════════════════════════════════════════════════════════
export function ContentCardSkeleton() {
  return (
    <div className="content-card-skeleton">
      <div className="skeleton-poster skeleton-shimmer" />
      <div className="skeleton-info">
        <div className="skeleton-title skeleton-shimmer" />
        <div className="skeleton-meta skeleton-shimmer" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONTENT GRID SKELETON - Keşfet sayfası için grid
// ═══════════════════════════════════════════════════════════════
export function ContentGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="content-grid-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <ContentCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HERO SKELETON - Ana sayfa hero bölümü için
// ═══════════════════════════════════════════════════════════════
export function HeroSkeleton() {
  return (
    <div className="hero-skeleton">
      <div className="hero-skeleton-bg skeleton-shimmer" />
      <div className="hero-skeleton-content">
        <div className="hero-skeleton-badge skeleton-shimmer" />
        <div className="hero-skeleton-title skeleton-shimmer" />
        <div className="hero-skeleton-meta skeleton-shimmer" />
        <div className="hero-skeleton-desc skeleton-shimmer" />
        <div className="hero-skeleton-actions">
          <div className="hero-skeleton-btn skeleton-shimmer" />
          <div className="hero-skeleton-btn skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CAROUSEL SKELETON - Ana sayfa carousel'ları için
// ═══════════════════════════════════════════════════════════════
export function CarouselSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="carousel-skeleton">
      <div className="carousel-skeleton-header">
        <div className="skeleton-section-title skeleton-shimmer" />
      </div>
      <div className="carousel-skeleton-items">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="carousel-skeleton-item">
            <div className="skeleton-poster-small skeleton-shimmer" />
            <div className="skeleton-title-small skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY CARD SKELETON - Feed sayfası için
// ═══════════════════════════════════════════════════════════════
export function ActivityCardSkeleton() {
  return (
    <div className="activity-card-skeleton">
      <div className="activity-skeleton-header">
        <div className="skeleton-avatar skeleton-shimmer" />
        <div className="skeleton-user-info">
          <div className="skeleton-username skeleton-shimmer" />
          <div className="skeleton-time skeleton-shimmer" />
        </div>
        <div className="skeleton-badge skeleton-shimmer" />
      </div>
      <div className="activity-skeleton-content">
        <div className="skeleton-poster-medium skeleton-shimmer" />
        <div className="activity-skeleton-info">
          <div className="skeleton-content-title skeleton-shimmer" />
          <div className="skeleton-content-meta skeleton-shimmer" />
          <div className="skeleton-rating skeleton-shimmer" />
        </div>
      </div>
      <div className="activity-skeleton-actions">
        <div className="skeleton-action-btn skeleton-shimmer" />
        <div className="skeleton-action-btn skeleton-shimmer" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FEED SKELETON - Feed sayfası için tam grid
// ═══════════════════════════════════════════════════════════════
export function FeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="feed-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <ActivityCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL PAGE SKELETON - İçerik detay sayfası için
// ═══════════════════════════════════════════════════════════════
export function DetailPageSkeleton() {
  return (
    <div className="detail-page-skeleton">
      {/* Hero Section */}
      <div className="detail-skeleton-hero">
        <div className="detail-skeleton-backdrop skeleton-shimmer" />
        <div className="detail-skeleton-hero-content">
          <div className="detail-skeleton-poster skeleton-shimmer" />
          <div className="detail-skeleton-info">
            <div className="detail-skeleton-title skeleton-shimmer" />
            <div className="detail-skeleton-meta skeleton-shimmer" />
            <div className="detail-skeleton-overview skeleton-shimmer" />
            <div className="detail-skeleton-actions">
              <div className="skeleton-btn-lg skeleton-shimmer" />
              <div className="skeleton-btn-lg skeleton-shimmer" />
            </div>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="detail-skeleton-tabs">
        <div className="skeleton-tab skeleton-shimmer" />
        <div className="skeleton-tab skeleton-shimmer" />
        <div className="skeleton-tab skeleton-shimmer" />
      </div>
      {/* Content */}
      <div className="detail-skeleton-content">
        <div className="skeleton-text-block skeleton-shimmer" />
        <div className="skeleton-text-block skeleton-shimmer" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROFILE SKELETON - Profil sayfası için
// ═══════════════════════════════════════════════════════════════
export function ProfileSkeleton() {
  return (
    <div className="profile-skeleton">
      {/* Header */}
      <div className="profile-skeleton-header">
        <div className="skeleton-cover skeleton-shimmer" />
        <div className="profile-skeleton-info">
          <div className="skeleton-avatar-large skeleton-shimmer" />
          <div className="profile-skeleton-details">
            <div className="skeleton-name skeleton-shimmer" />
            <div className="skeleton-username skeleton-shimmer" />
            <div className="skeleton-bio skeleton-shimmer" />
          </div>
          <div className="profile-skeleton-stats">
            <div className="skeleton-stat skeleton-shimmer" />
            <div className="skeleton-stat skeleton-shimmer" />
            <div className="skeleton-stat skeleton-shimmer" />
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="profile-skeleton-tabs">
        <div className="skeleton-tab skeleton-shimmer" />
        <div className="skeleton-tab skeleton-shimmer" />
        <div className="skeleton-tab skeleton-shimmer" />
      </div>
      {/* Content Grid */}
      <div className="profile-skeleton-content">
        {Array.from({ length: 6 }).map((_, i) => (
          <ContentCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LIBRARY SKELETON - Kütüphane sayfası için
// ═══════════════════════════════════════════════════════════════
export function LibrarySkeleton() {
  return (
    <div className="library-skeleton">
      {/* Header */}
      <div className="library-skeleton-header">
        <div className="skeleton-page-title skeleton-shimmer" />
        <div className="library-skeleton-filters">
          <div className="skeleton-filter skeleton-shimmer" />
          <div className="skeleton-filter skeleton-shimmer" />
          <div className="skeleton-filter skeleton-shimmer" />
        </div>
      </div>
      {/* Grid */}
      <ContentGridSkeleton count={8} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LIST SKELETON - Liste sayfası için
// ═══════════════════════════════════════════════════════════════
export function ListSkeleton() {
  return (
    <div className="list-skeleton">
      <div className="list-skeleton-header">
        <div className="skeleton-list-title skeleton-shimmer" />
        <div className="skeleton-list-meta skeleton-shimmer" />
      </div>
      <ContentGridSkeleton count={6} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMMENT SKELETON - Yorum bölümü için
// ═══════════════════════════════════════════════════════════════
export function CommentSkeleton() {
  return (
    <div className="comment-skeleton">
      <div className="skeleton-avatar-small skeleton-shimmer" />
      <div className="comment-skeleton-content">
        <div className="skeleton-comment-header skeleton-shimmer" />
        <div className="skeleton-comment-text skeleton-shimmer" />
        <div className="skeleton-comment-text short skeleton-shimmer" />
      </div>
    </div>
  );
}

export function CommentsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="comments-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <CommentSkeleton key={i} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE LOADER - Tam sayfa loading için
// ═══════════════════════════════════════════════════════════════
export function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader-content">
        <div className="loader-spinner" />
        <span className="loader-text">Yükleniyor...</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INLINE LOADER - Küçük loading spinner
// ═══════════════════════════════════════════════════════════════
export function InlineLoader({ size = 20, text }: { size?: number; text?: string }) {
  return (
    <div className="inline-loader">
      <svg 
        className="inline-loader-spinner" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      {text && <span className="inline-loader-text">{text}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION SKELETON - Bildirimler için
// ═══════════════════════════════════════════════════════════════
export function NotificationSkeleton() {
  return (
    <div className="notification-skeleton">
      <div className="skeleton-avatar-small skeleton-shimmer" />
      <div className="notification-skeleton-content">
        <div className="skeleton-notification-text skeleton-shimmer" />
        <div className="skeleton-notification-time skeleton-shimmer" />
      </div>
    </div>
  );
}

export function NotificationsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="notifications-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <NotificationSkeleton key={i} />
      ))}
    </div>
  );
}

// Export all
export default {
  SkeletonBox,
  ContentCardSkeleton,
  ContentGridSkeleton,
  HeroSkeleton,
  CarouselSkeleton,
  ActivityCardSkeleton,
  FeedSkeleton,
  DetailPageSkeleton,
  ProfileSkeleton,
  LibrarySkeleton,
  ListSkeleton,
  CommentSkeleton,
  CommentsSkeleton,
  PageLoader,
  InlineLoader,
  NotificationSkeleton,
  NotificationsSkeleton,
};
