import { useState, useEffect } from 'react';
import { PasswordInput, Paper, Title, Text, Container, Button, Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { notifications } from '@mantine/notifications';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isValidLink, setIsValidLink] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Supabase recovery event'ini dinle
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsValidLink(true);
            }
        });

        // URL'den access_token kontrolü
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');
        if (type === 'recovery') {
            setIsValidLink(true);
        }

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            notifications.show({
                title: 'Hata',
                message: 'Şifreler eşleşmiyor!',
                color: 'red',
            });
            return;
        }

        if (password.length < 6) {
            notifications.show({
                title: 'Hata',
                message: 'Şifre en az 6 karakter olmalıdır.',
                color: 'red',
            });
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;

            notifications.show({
                title: 'Başarılı',
                message: 'Şifreniz başarıyla güncellendi. Giriş sayfasına yönlendiriliyorsunuz...',
                color: 'green',
            });

            // Oturumu kapat ve giriş sayfasına yönlendir
            await supabase.auth.signOut();
            setTimeout(() => navigate('/giris'), 2000);
        } catch (error: any) {
            notifications.show({
                title: 'Hata',
                message: error.message || 'Şifre güncellenirken hata oluştu.',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isValidLink) {
        return (
            <Container size={420} my={40}>
                <Paper withBorder shadow="md" p={30} radius="md">
                    <Stack align="center" gap="md">
                        <Title order={2}>Geçersiz Bağlantı</Title>
                        <Text c="dimmed" ta="center">
                            Bu şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.
                            Lütfen yeni bir şifre sıfırlama isteği gönderin.
                        </Text>
                        <Button onClick={() => navigate('/giris')}>
                            Giriş Sayfasına Dön
                        </Button>
                    </Stack>
                </Paper>
            </Container>
        );
    }

    return (
        <Container size={420} my={40}>
            <Title ta="center">Yeni Şifre Belirle</Title>
            <Text c="dimmed" size="sm" ta="center" mt={5}>
                Yeni şifrenizi aşağıya girin
            </Text>

            <Paper withBorder shadow="md" p={30} mt={30} radius="md">
                <form onSubmit={handleResetPassword}>
                    <Stack>
                        <PasswordInput
                            label="Yeni Şifre"
                            placeholder="En az 6 karakter"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <PasswordInput
                            label="Şifre Tekrar"
                            placeholder="Şifrenizi tekrar girin"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <Button fullWidth type="submit" loading={loading}>
                            Şifreyi Güncelle
                        </Button>
                    </Stack>
                </form>
            </Paper>
        </Container>
    );
}
