import { useState } from 'react';
import { TextInput, PasswordInput, Checkbox, Anchor, Paper, Title, Text, Container, Group, Button, Modal, Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { notifications } from '@mantine/notifications';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            notifications.show({
                title: 'Başarılı',
                message: 'Giriş başarılı! Yönlendiriliyorsunuz...',
                color: 'green',
            });
            navigate('/'); // Ana sayfaya git
        } catch (error: any) {
            notifications.show({
                title: 'Hata',
                message: error.message || 'Giriş yapılırken hata oluştu.',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${window.location.origin}/sifre-sifirla`,
            });

            if (error) throw error;

            notifications.show({
                title: 'E-posta Gönderildi',
                message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.',
                color: 'green',
            });
            setResetModalOpen(false);
            setResetEmail('');
        } catch (error: any) {
            notifications.show({
                title: 'Hata',
                message: error.message || 'Şifre sıfırlama e-postası gönderilirken hata oluştu.',
                color: 'red',
            });
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <Container size={420} my={40}>
            <Title ta="center">Hoş Geldiniz! 👋</Title>
            <Text c="dimmed" size="sm" ta="center" mt={5}>
                Hesabınız yok mu?{' '}
                <Anchor size="sm" component="button" onClick={() => navigate('/kayit')}>
                    Kayıt Olun
                </Anchor>
            </Text>

            <Paper withBorder shadow="md" p={30} mt={30} radius="md">
                <form onSubmit={handleLogin}>
                    <TextInput
                        label="E-posta"
                        placeholder="ornek@email.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <PasswordInput
                        label="Şifre"
                        placeholder="Şifreniz"
                        required
                        mt="md"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <Group justify="space-between" mt="lg">
                        <Checkbox label="Beni hatırla" />
                        <Anchor 
                            component="button" 
                            type="button"
                            size="sm"
                            onClick={() => setResetModalOpen(true)}
                        >
                            Şifremi unuttum?
                        </Anchor>
                    </Group>

                    <Button fullWidth mt="xl" type="submit" loading={loading}>
                        Giriş Yap
                    </Button>
                </form>
            </Paper>

            {/* Şifre Sıfırlama Modalı */}
            <Modal
                opened={resetModalOpen}
                onClose={() => setResetModalOpen(false)}
                title="Şifre Sıfırlama"
                centered
            >
                <form onSubmit={handlePasswordReset}>
                    <Stack>
                        <Text size="sm" c="dimmed">
                            E-posta adresinizi girin. Size şifre sıfırlama bağlantısı göndereceğiz.
                        </Text>
                        <TextInput
                            label="E-posta Adresi"
                            placeholder="ornek@email.com"
                            required
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                        />
                        <Button type="submit" loading={resetLoading}>
                            Sıfırlama Bağlantısı Gönder
                        </Button>
                    </Stack>
                </form>
            </Modal>
        </Container>
    );
}