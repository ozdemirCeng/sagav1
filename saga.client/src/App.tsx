import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppLayout from './layout/AppLayout';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ContentDetailPage from './pages/ContentDetailPage';
import ProfilePage from './pages/ProfilePage';

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
        <MantineProvider>
            <Notifications position="top-right" zIndex={1000} />
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <ErrorBoundary>
                        <BrowserRouter>
                        <Routes>
                            {/* Public Routes */}
                            <Route path="/giris" element={<LoginPage />} />
                            <Route path="/kayit" element={<RegisterPage />} />
                            <Route path="/sifre-sifirla" element={<ResetPasswordPage />} />

                            {/* Protected Routes */}
                            <Route element={<AppLayout />}>
                                <Route path="/" element={<HomePage />} />
                                <Route path="/kesfet" element={<ExplorePage />} />
                                <Route path="/icerik/:id" element={<ContentDetailPage />} />
                                <Route path="/profil/:username" element={<ProfilePage />} />
                            </Route>

                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                        </BrowserRouter>
                    </ErrorBoundary>
                </AuthProvider>
            </QueryClientProvider>
        </MantineProvider>
    );
}

export default App;