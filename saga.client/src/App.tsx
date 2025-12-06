import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

import { AuthProvider, AuthModalProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { VoidLayout } from './components/layout';
import LoginPage from './pages/glass/LoginPage';
import RegisterPage from './pages/glass/RegisterPage';
import ForgotPasswordPage from './pages/glass/ForgotPasswordPage';
import ResetPasswordPage from './pages/glass/ResetPasswordPage';
import FeedPage from './pages/glass/FeedPage';
import ExplorePage from './pages/glass/ExplorePage';
import DetailPage from './pages/glass/DetailPage';
import ProfilePage from './pages/glass/ProfilePage';
import SettingsPage from './pages/glass/SettingsPage';
import LibraryPage from './pages/glass/LibraryPage';
import ListEditPage from './pages/glass/ListEditPage';
import NotificationsPage from './pages/glass/NotificationsPage';

// Client örneğini oluştur (Cache ayarlarıyla)
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // Veriler 5 dakika taze sayılsın (tekrar istek atma)
            retry: 1, // Hata olursa 1 kere daha dene
        },
    },
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <MantineProvider>
                <ThemeProvider>
                    <AuthProvider>
                        <BrowserRouter>
                            <AuthModalProvider>
                                <Routes>
                                    {/* Auth Routes - No Layout */}
                                    <Route path="/giris" element={<LoginPage />} />
                                    <Route path="/kayit" element={<RegisterPage />} />
                                    <Route path="/sifre-sifirla" element={<ForgotPasswordPage />} />
                                    <Route path="/sifre-yenile" element={<ResetPasswordPage />} />

                                    {/* All Pages with VoidLayout */}
                                    <Route element={<VoidLayout />}>
                                        <Route path="/" element={<FeedPage />} />
                                        <Route path="/akis" element={<FeedPage />} />
                                        <Route path="/bildirimler" element={<NotificationsPage />} />
                                        <Route path="/profil/:kullaniciAdi" element={<ProfilePage />} />
                                        <Route path="/kesfet" element={<ExplorePage />} />
                                        <Route path="/ayarlar" element={<SettingsPage />} />
                                        <Route path="/kutuphane" element={<LibraryPage />} />
                                        <Route path="/liste/:id/duzenle" element={<ListEditPage />} />
                                        <Route path="/icerik/:tip/:id" element={<DetailPage />} />
                                        <Route path="/icerik/:id" element={<DetailPage />} />
                                    </Route>

                                    {/* Fallback */}
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </AuthModalProvider>
                        </BrowserRouter>
                    </AuthProvider>
                </ThemeProvider>
            </MantineProvider>
        </QueryClientProvider>
    );
}

export default App;