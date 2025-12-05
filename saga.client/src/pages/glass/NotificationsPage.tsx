import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bildirimApi, type Bildirim } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import './NotificationsPage.css';

// Sidebar'daki bildirim sayısını yenilemek için global refresh fonksiyonu
export let refreshSidebarBildirim: (() => void) | null = null;
export const setRefreshSidebarBildirim = (fn: () => void) => { refreshSidebarBildirim = fn; };

export default function NotificationsPage() {
    const navigate = useNavigate();
    const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
    const [loading, setLoading] = useState(true);
    const [sayfa, setSayfa] = useState(1);
    const [toplamSayfa, setToplamSayfa] = useState(1);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const fetchBildirimler = useCallback(async (currentSayfa: number, currentFilter: 'all' | 'unread') => {
        try {
            setLoading(true);
            if (currentFilter === 'unread') {
                const response = await bildirimApi.getOkunmamis();
                setBildirimler(response.bildirimler);
                setToplamSayfa(1);
            } else {
                const response = await bildirimApi.getBildirimler({ sayfa: currentSayfa, limit: 20 });
                setBildirimler(response.bildirimler);
                setToplamSayfa(response.toplamSayfa);
            }
        } catch (err) {
            console.error('Bildirimler yüklenemedi:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBildirimler(sayfa, filter);
    }, [sayfa, filter, fetchBildirimler]);

    const handleOkunduIsaretle = async (id: number, e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            await bildirimApi.okunduIsaretle(id);
            setBildirimler(prev => prev.map(b => b.id === id ? { ...b, okundu: true } : b));
            refreshSidebarBildirim?.();
        } catch (err) {
            console.error('Okundu işaretlenemedi:', err);
        }
    };

    const handleTumunuOkunduIsaretle = async () => {
        try {
            await bildirimApi.tumunuOkunduIsaretle();
            setBildirimler(prev => prev.map(b => ({ ...b, okundu: true })));
            refreshSidebarBildirim?.();
        } catch (err) {
            console.error('Tümü okundu işaretlenemedi:', err);
        }
    };

    const handleSil = async (id: number, e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            await bildirimApi.sil(id);
            setBildirimler(prev => prev.filter(b => b.id !== id));
            refreshSidebarBildirim?.();
        } catch (err) {
            console.error('Bildirim silinemedi:', err);
        }
    };

    const handleTumunuSil = async () => {
        try {
            await bildirimApi.tumunuSil();
            setBildirimler([]);
            refreshSidebarBildirim?.();
        } catch (err) {
            console.error('Bildirimler silinemedi:', err);
        }
    };

    const handleBildirimClick = (bildirim: Bildirim) => {
        if (!bildirim.okundu) {
            handleOkunduIsaretle(bildirim.id);
        }
        if (bildirim.linkUrl) {
            navigate(bildirim.linkUrl);
        }
    };

    const getBildirimIcon = (tip: string) => {
        switch (tip) {
            case 'takip':
            case 'yeni_takipci':
                return (
                    <svg className="notif-type-icon follow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                    </svg>
                );
            case 'begeni':
                return (
                    <svg className="notif-type-icon like" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                );
            case 'yorum':
                return (
                    <svg className="notif-type-icon comment" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                );
            case 'liste':
            case 'listeye_ekleme':
                return (
                    <svg className="notif-type-icon list" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                    </svg>
                );
            case 'puanlama':
                return (
                    <svg className="notif-type-icon rating" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                    </svg>
                );
            default:
                return (
                    <svg className="notif-type-icon default" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                );
        }
    };

    const formatTime = (dateStr: string) => {
        return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: tr });
    };

    const okunmamisSayisi = bildirimler.filter(b => !b.okundu).length;

    return (
        <div className="notifications-page">
            {/* Filter Tabs & Actions */}
            <div className="notif-tabs-container">
                <div className="notif-tabs-row">
                    <div className="notif-tabs">
                        <button
                            onClick={() => { setFilter('all'); setSayfa(1); }}
                            className={`notif-tab ${filter === 'all' ? 'active' : ''}`}
                        >
                            Tümü
                        </button>
                        <button
                            onClick={() => { setFilter('unread'); setSayfa(1); }}
                            className={`notif-tab ${filter === 'unread' ? 'active' : ''}`}
                        >
                            Okunmamış
                            {okunmamisSayisi > 0 && <span className="tab-count">{okunmamisSayisi}</span>}
                        </button>
                    </div>
                    <div className="notif-page-actions">
                        <button 
                            className="notif-action-btn"
                            onClick={handleTumunuOkunduIsaretle}
                            title="Tümünü okundu işaretle"
                        >
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </button>
                        <button 
                            className="notif-action-btn delete"
                            onClick={handleTumunuSil}
                            title="Tümünü sil"
                        >
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="notif-content">
                {loading ? (
                    <div className="notif-skeleton-list">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="notif-skeleton-item">
                                <div className="skeleton-icon shimmer"></div>
                                <div className="skeleton-text-group">
                                    <div className="skeleton-line lg shimmer"></div>
                                    <div className="skeleton-line sm shimmer"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : bildirimler.length === 0 ? (
                    <div className="notif-empty-state">
                        <div className="empty-icon">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                            </svg>
                        </div>
                        <h3>Bildirim Yok</h3>
                        <p>
                            {filter === 'unread'
                                ? 'Okunmamış bildiriminiz bulunmuyor.'
                                : 'Henüz bildiriminiz bulunmuyor.'}
                        </p>
                    </div>
                ) : (
                    <div className="notif-list">
                        {bildirimler.map((bildirim) => (
                            <article
                                key={bildirim.id}
                                className={`notif-card ${!bildirim.okundu ? 'unread' : ''}`}
                                onClick={() => handleBildirimClick(bildirim)}
                            >
                                {/* Unread indicator */}
                                {!bildirim.okundu && <div className="unread-indicator"></div>}
                                
                                {/* Avatar / Icon */}
                                <div className="notif-avatar">
                                    {bildirim.gonderen?.avatarUrl ? (
                                        <img 
                                            src={bildirim.gonderen.avatarUrl} 
                                            alt={bildirim.gonderen.kullaniciAdi}
                                            onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.svg'; }}
                                        />
                                    ) : (
                                        <div className="notif-avatar-icon">
                                            {getBildirimIcon(bildirim.tip)}
                                        </div>
                                    )}
                                    {/* Type badge */}
                                    <div className={`type-badge ${bildirim.tip}`}>
                                        {getBildirimIcon(bildirim.tip)}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="notif-body">
                                    <div className="notif-main">
                                        {bildirim.baslik && (
                                            <p className="notif-title">{bildirim.baslik}</p>
                                        )}
                                        {bildirim.mesaj && (
                                            <p className="notif-message">{bildirim.mesaj}</p>
                                        )}
                                        {bildirim.gonderen && (
                                            <span className="notif-sender">@{bildirim.gonderen.kullaniciAdi}</span>
                                        )}
                                    </div>
                                    <span className="notif-time">{formatTime(bildirim.olusturulmaZamani)}</span>
                                </div>

                                {/* Actions */}
                                <div className="notif-actions">
                                    {!bildirim.okundu && (
                                        <button
                                            className="notif-action-btn mark-read"
                                            onClick={(e) => handleOkunduIsaretle(bildirim.id, e)}
                                            title="Okundu işaretle"
                                        >
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                            </svg>
                                        </button>
                                    )}
                                    <button
                                        className="notif-action-btn delete"
                                        onClick={(e) => handleSil(bildirim.id, e)}
                                        title="Sil"
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                        </svg>
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {!loading && toplamSayfa > 1 && filter === 'all' && (
                    <div className="notif-pagination">
                        <button
                            onClick={() => setSayfa(s => Math.max(1, s - 1))}
                            disabled={sayfa === 1}
                            className="pagination-btn"
                        >
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                            </svg>
                            Önceki
                        </button>
                        <span className="pagination-info">{sayfa} / {toplamSayfa}</span>
                        <button
                            onClick={() => setSayfa(s => Math.min(toplamSayfa, s + 1))}
                            disabled={sayfa === toplamSayfa}
                            className="pagination-btn"
                        >
                            Sonraki
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
