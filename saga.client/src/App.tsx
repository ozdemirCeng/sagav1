import { useEffect, useState } from 'react';
import { MantineProvider, Container, Title, SimpleGrid, Card, Image, Text, Badge, Button, Group } from '@mantine/core';
import '@mantine/core/styles.css';

interface Icerik {
    id: number;
    baslik: string;
    tur: string;
    posterUrl: string;
    ortalamaPuan: number;
}

function App() {
    const [icerikler, setIcerikler] = useState<Icerik[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchIcerikler();
    }, []);

    async function fetchIcerikler() {
        try {
            // Backend'e istek atıyoruz (Proxy sayesinde direkt /api yazabiliriz)
            const response = await fetch('/api/icerikler');
            if (response.ok) {
                const data = await response.json();
                setIcerikler(data);
            } else {
                console.error("Veri çekilemedi");
            }
        } catch (error) {
            console.error("Hata:", error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <MantineProvider>
            <Container size="lg" py="xl">
                <Title order={1} mb="xl" style={{ textAlign: 'center' }}>🎬 Saga Keşfet</Title>
                
                {loading ? (
                    <Text ta="center">Yükleniyor...</Text>
                ) : (
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
                        {icerikler.map((item) => (
                            <Card key={item.id} shadow="sm" padding="lg" radius="md" withBorder>
                                <Card.Section>
                                    <Image
                                        src={item.posterUrl || "https://placehold.co/600x400?text=No+Image"}
                                        height={300}
                                        alt={item.baslik}
                                    />
                                </Card.Section>

                                <Group justify="space-between" mt="md" mb="xs">
                                    <Text fw={500} truncate>{item.baslik}</Text>
                                    <Badge color={item.tur === 'film' ? 'blue' : 'green'}>{item.tur}</Badge>
                                </Group>

                                <Text size="sm" c="dimmed">
                                    Puan: ⭐ {item.ortalamaPuan}
                                </Text>

                                <Button color="blue" fullWidth mt="md" radius="md">
                                    Detaylar
                                </Button>
                            </Card>
                        ))}
                    </SimpleGrid>
                )}
                
                {icerikler.length === 0 && !loading && (
                    <div style={{textAlign: 'center', marginTop: '50px'}}>
                        <Text size="xl">Henüz içerik yok.</Text>
                        <Text c="dimmed">Veritabanına manuel veya API ile veri eklemelisin.</Text>
                    </div>
                )}

            </Container>
        </MantineProvider>
    );
}

export default App;