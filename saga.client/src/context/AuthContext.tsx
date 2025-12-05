import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { LoginRequiredModal } from '../components/ui/Modal';
import { useNavigate } from 'react-router-dom';

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5054/api';

// Extended user type with our app-specific fields
export interface SagaUser {
    id: string; // GUID from backend
    supabaseId: string;
    email: string;
    kullaniciAdi: string;
    goruntulemeAdi?: string;
    ad?: string;
    profilResmi?: string;
}

interface AuthContextType {
    session: Session | null;
    user: SagaUser | null;
    supabaseUser: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    signOut: () => Promise<void>;
    // Guest Guard System
    requireAuth: (action?: string) => boolean;
    showLoginModal: boolean;
    setShowLoginModal: (show: boolean) => void;
    pendingAction: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
    const [user, setUser] = useState<SagaUser | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Guest Guard State
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<string | null>(null);

    const isAuthenticated = !!user;

    // Backend'den kullanıcı profilini çek (doğru kullaniciAdi için)
    const fetchUserProfile = async (supaUser: User, accessToken: string): Promise<SagaUser | null> => {
        try {
            // Backend'de kendi profilimi getir endpoint'i
            const response = await fetch(`${API_URL}/kullanici/profil`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const profil = await response.json();
                return {
                    id: profil.id,
                    supabaseId: supaUser.id,
                    email: supaUser.email || '',
                    kullaniciAdi: profil.kullaniciAdi,
                    goruntulemeAdi: profil.goruntulemeAdi,
                    ad: profil.goruntulemeAdi || supaUser.user_metadata?.full_name,
                    profilResmi: profil.avatarUrl,
                };
            }
        } catch (error) {
            console.error('Profil yüklenirken hata:', error);
        }

        // Fallback: Supabase metadata'dan kullanıcı oluştur
        const kullaniciAdi = supaUser.user_metadata?.kullanici_adi || 
                            supaUser.user_metadata?.username ||
                            supaUser.email?.split('@')[0] || 
                            'user';
        
        return {
            id: supaUser.id,
            supabaseId: supaUser.id,
            email: supaUser.email || '',
            kullaniciAdi,
            ad: supaUser.user_metadata?.ad || supaUser.user_metadata?.full_name,
            profilResmi: supaUser.user_metadata?.profil_resmi,
        };
    };

    useEffect(() => {
        // 1. Mevcut oturumu kontrol et
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            setSupabaseUser(session?.user ?? null);
            
            if (session?.user && session?.access_token) {
                const sagaUser = await fetchUserProfile(session.user, session.access_token);
                setUser(sagaUser);
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        // 2. Oturum değişikliklerini dinle (Giriş/Çıkış anında tetiklenir)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            setSupabaseUser(session?.user ?? null);
            
            if (session?.user && session?.access_token) {
                const sagaUser = await fetchUserProfile(session.user, session.access_token);
                setUser(sagaUser);
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    /**
     * Guest Guard: Protected actions için kullanılır
     * Eğer kullanıcı giriş yapmamışsa, login modal'ı açar ve false döner
     * Eğer giriş yapmışsa true döner ve action devam eder
     */
    const requireAuth = useCallback((action?: string): boolean => {
        if (isAuthenticated) {
            return true;
        }
        
        // Set pending action for context
        setPendingAction(action || null);
        setShowLoginModal(true);
        return false;
    }, [isAuthenticated]);

    // Context value'yu memoize et - gereksiz re-render'ları önler
    const contextValue = useMemo(() => ({
        session, 
        user,
        supabaseUser,
        loading, 
        isAuthenticated,
        signOut,
        requireAuth,
        showLoginModal,
        setShowLoginModal,
        pendingAction,
    }), [session, user, supabaseUser, loading, isAuthenticated, signOut, requireAuth, showLoginModal, pendingAction]);

    return (
        <AuthContext.Provider value={contextValue}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

// Hook olarak kullanmak için
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Guest Guard Modal Provider - App.tsx'de kullanılacak
export function AuthModalProvider({ children }: { children: React.ReactNode }) {
    const { showLoginModal, setShowLoginModal, pendingAction } = useAuth();
    const navigate = useNavigate();

    const handleLogin = () => {
        setShowLoginModal(false);
        navigate('/giris');
    };

    const handleRegister = () => {
        setShowLoginModal(false);
        navigate('/kayit');
    };

    const getActionMessage = () => {
        switch (pendingAction) {
            case 'like':
                return 'İçeriği beğenmek için giriş yapmalısınız.';
            case 'rate':
                return 'Puan vermek için giriş yapmalısınız.';
            case 'comment':
                return 'Yorum yapmak için giriş yapmalısınız.';
            case 'addToList':
                return 'Listeye eklemek için giriş yapmalısınız.';
            case 'follow':
                return 'Takip etmek için giriş yapmalısınız.';
            default:
                return 'Bu özelliği kullanmak için giriş yapmalısınız.';
        }
    };

    return (
        <>
            {children}
            <LoginRequiredModal
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                onLogin={handleLogin}
                onRegister={handleRegister}
                message={getActionMessage()}
            />
        </>
    );
}