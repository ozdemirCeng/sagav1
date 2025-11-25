import { useState } from 'react';
import { TextInput, PasswordInput, Anchor, Paper, Title, Text, Container, Button } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { notifications } from '@mantine/notifications';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Supabase'e kayıt isteği atıyoruz
            // metadata içine username ekliyoruz ki Trigger bunu yakalayabilsin
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username,
                        full_name: username // İstersen ayrı bir ad soyad inputu da ekleyebilirsin
                    }
                }
            });

            if (error) throw error;

            notifications.show({
                title: 'Başarılı',
                message: 'Kayıt başarılı! Lütfen e-postanızı kontrol edin veya giriş yapın.',
                color: 'green',
            });
            navigate('/giris');

        } catch (error: any) {
            console.error("❌ Kayıt Hatası Detayı:", error);
            const errorMessage = error?.message || error?.error_description || 'Kayıt olurken hata oluştu.';
            notifications.show({
                title: 'Hata',
                message: errorMessage,
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container size={420} my={40}>
            <Title ta="center">Aramıza Katılın 🚀</Title>
            <Text c="dimmed" size="sm" ta="center" mt={5}>
                Zaten hesabınız var mı?{' '}
                <Anchor size="sm" component="button" onClick={() => navigate('/giris')}>
                    Giriş Yap
                </Anchor>
            </Text>

            <Paper withBorder shadow="md" p={30} mt={30} radius="md">
                <form onSubmit={handleRegister}>
                    <TextInput
                        label="Kullanıcı Adı"
                        placeholder="kullaniciadi"
                        required
                        mt="md"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <TextInput
                        label="E-posta"
                        placeholder="ornek@email.com"
                        required
                        mt="md"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <PasswordInput
                        label="Şifre"
                        placeholder="En az 6 karakter"
                        required
                        mt="md"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <Button fullWidth mt="xl" type="submit" loading={loading}>
                        Kayıt Ol
                    </Button>
                </form>
            </Paper>
        </Container>
    );
}