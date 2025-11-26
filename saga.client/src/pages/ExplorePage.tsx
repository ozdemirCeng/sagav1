import { useState } from 'react';
import {
  Container,
  Title,
  TextInput,
  Select,
  Grid,
  Card,
  Image,
  Text,
  Badge,
  Group,
  Stack,
  Button,
  NumberInput,
  Paper,
  Flex,
  ActionIcon,
  Collapse,
  Tabs,
  Box,
  Loader,
  Overlay,
  Tooltip,
} from '@mantine/core';
import { IconSearch, IconFilter, IconX, IconStar, IconTrendingUp, IconArrowRight, IconFlame } from '@tabler/icons-react';
import { useSearchContent, useFilteredContent, usePopularContent, useTopRatedContent } from '../hooks/useIcerikler';
import { useNavigate } from 'react-router';
import { useDebouncedValue } from '@mantine/hooks';
import { ContentCardSkeleton } from '../components/ContentCardSkeleton';
import { EmptyState } from '../components/EmptyState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalApiService } from '../services/externalApiService';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../context/AuthContext';

const filmTurleri = [
  'Aksiyon',
  'Macera',
  'Animasyon',
  'Komedi',
  'Suç',
  'Belgesel',
  'Drama',
  'Aile',
  'Fantastik',
  'Tarih',
  'Korku',
  'Müzik',
  'Gizem',
  'Romantik',
  'Bilim Kurgu',
  'Gerilim',
  'Savaş',
  'Western',
];

const kitapKategorileri = [
  'Roman',
  'Bilim Kurgu',
  'Fantastik',
  'Polisiye',
  'Gerilim',
  'Tarih',
  'Biyografi',
  'Bilim',
  'Felsefe',
  'Psikoloji',
  'Şiir',
  'Deneme',
  'Çocuk',
  'Gençlik',
  'Kişisel Gelişim',
  'İş ve Ekonomi',
];

// Vitrin Modülleri Bileşeni (En Popülerler, En Yüksek Puanlılar)
function VitrinModulleri({ navigate }: { navigate: (path: string) => void }) {
  const { data: popularContent, isLoading: popularLoading } = usePopularContent();
  const { data: topRatedContent, isLoading: topRatedLoading } = useTopRatedContent();

  const renderCompactCard = (icerik: any) => (
    <Card
      key={icerik.id}
      shadow="sm"
      padding="sm"
      radius="md"
      withBorder
      style={{
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        minWidth: 140,
        maxWidth: 160,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '';
      }}
      onClick={() => navigate(`/icerik/${icerik.id}`)}
    >
      <Card.Section>
        <Image
          src={icerik.posterUrl || 'https://placehold.co/140x200/e2e8f0/64748b?text=No+Image'}
          height={200}
          alt={icerik.baslik}
          fallbackSrc="https://placehold.co/140x200/e2e8f0/64748b?text=No+Image"
        />
      </Card.Section>
      <Stack gap={4} mt="xs">
        <Text fw={500} lineClamp={1} size="xs">
          {icerik.baslik}
        </Text>
        <Flex justify="space-between" align="center">
          <Badge size="xs" color={icerik.tur === 'film' ? 'blue' : 'green'} variant="light">
            {icerik.tur === 'film' ? 'Film' : 'Kitap'}
          </Badge>
          {(icerik.ortalamaPuan ?? 0) > 0 && (
            <Group gap={2}>
              <IconStar size={12} fill="gold" color="gold" />
              <Text size="xs" fw={500}>
                {icerik.ortalamaPuan.toFixed(1)}
              </Text>
            </Group>
          )}
        </Flex>
      </Stack>
    </Card>
  );

  return (
    <Stack gap="lg">
      {/* En Popüler İçerikler */}
      <Box>
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <IconFlame size={20} color="orange" />
            <Title order={3}>En Popülerler</Title>
          </Group>
          <Button
            variant="subtle"
            size="xs"
            rightSection={<IconArrowRight size={14} />}
            onClick={() => {
              // Filtre ile popüler içerikleri göster
            }}
          >
            Tümünü Gör
          </Button>
        </Group>
        {popularLoading ? (
          <Grid>
            {[...Array(6)].map((_, index) => (
              <Grid.Col key={index} span={{ base: 4, xs: 3, sm: 2, md: 2, lg: 1.5 }}>
                <ContentCardSkeleton />
              </Grid.Col>
            ))}
          </Grid>
        ) : (
          <Flex gap="md" wrap="nowrap" style={{ overflowX: 'auto', paddingBottom: '8px' }}>
            {popularContent?.slice(0, 8).map(renderCompactCard)}
          </Flex>
        )}
      </Box>

      {/* En Yüksek Puanlılar */}
      <Box>
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <IconTrendingUp size={20} color="green" />
            <Title order={3}>En Yüksek Puanlılar</Title>
          </Group>
          <Button
            variant="subtle"
            size="xs"
            rightSection={<IconArrowRight size={14} />}
            onClick={() => {
              // Filtre ile yüksek puanlı içerikleri göster
            }}
          >
            Tümünü Gör
          </Button>
        </Group>
        {topRatedLoading ? (
          <Grid>
            {[...Array(6)].map((_, index) => (
              <Grid.Col key={index} span={{ base: 4, xs: 3, sm: 2, md: 2, lg: 1.5 }}>
                <ContentCardSkeleton />
              </Grid.Col>
            ))}
          </Grid>
        ) : (
          <Flex gap="md" wrap="nowrap" style={{ overflowX: 'auto', paddingBottom: '8px' }}>
            {topRatedContent?.slice(0, 8).map(renderCompactCard)}
          </Flex>
        )}
      </Box>
    </Stack>
  );
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Arama state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(searchQuery, 500);
  const [activeTab, setActiveTab] = useState<'database' | 'tmdb' | 'books'>('database');
  const [importingId, setImportingId] = useState<string | null>(null);

  // Filtre state
  const [showFilters, setShowFilters] = useState(false);
  const [tur, setTur] = useState<'film' | 'kitap' | undefined>(undefined);
  const [turler, setTurler] = useState<string[]>([]);
  const [minPuan, setMinPuan] = useState<number | undefined>(undefined);
  const [maxPuan, setMaxPuan] = useState<number | undefined>(undefined);
  const [minYil, setMinYil] = useState<number | undefined>(undefined);
  const [maxYil, setMaxYil] = useState<number | undefined>(undefined);

  // Import mutations
  const importTmdbMutation = useMutation({
    mutationFn: (tmdbId: string) => externalApiService.importTmdbFilm(tmdbId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['icerikler'] });
      notifications.show({
        title: 'Başarılı',
        message: 'Film kütüphaneye eklendi!',
        color: 'green',
      });
      navigate(`/icerik/${data.id}`);
    },
    onError: () => {
      notifications.show({
        title: 'Hata',
        message: 'Film eklenirken bir hata oluştu.',
        color: 'red',
      });
    },
    onSettled: () => {
      setImportingId(null);
    }
  });

  const importBookMutation = useMutation({
    mutationFn: (bookId: string) => externalApiService.importGoogleBook(bookId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['icerikler'] });
      notifications.show({
        title: 'Başarılı',
        message: 'Kitap kütüphaneye eklendi!',
        color: 'green',
      });
      navigate(`/icerik/${data.id}`);
    },
    onError: () => {
      notifications.show({
        title: 'Hata',
        message: 'Kitap eklenirken bir hata oluştu.',
        color: 'red',
      });
    },
    onSettled: () => {
      setImportingId(null);
    }
  });

  // Harici içerik tıklama handler'ı
  const handleExternalContentClick = (icerik: any) => {
    if (!user) {
      notifications.show({
        title: 'Giriş Gerekli',
        message: 'İçerik eklemek için giriş yapmalısınız.',
        color: 'orange',
      });
      navigate('/giris');
      return;
    }

    setImportingId(icerik.externalId);
    if (icerik.tur === 'film') {
      importTmdbMutation.mutate(icerik.externalId);
    } else {
      importBookMutation.mutate(icerik.externalId);
    }
  };

  // Arama veya filtreleme yapılıyor mu?
  const isSearching = debouncedQuery.length > 2;
  const hasFilters = tur || turler.length > 0 || minPuan || maxPuan || minYil || maxYil;

  // Query hooks - Database
  const { data: searchResults, isLoading: searchLoading } = useSearchContent(debouncedQuery, { enabled: isSearching && activeTab === 'database' });
  const { data: filterResults, isLoading: filterLoading } = useFilteredContent({
    tur,
    turler: turler.length > 0 ? turler : undefined,
    minPuan,
    maxPuan,
    minYil,
    maxYil,
    limit: 50
  }, { enabled: activeTab === 'database' });

  // Query hooks - External APIs
  const { data: tmdbResults, isLoading: tmdbLoading } = useQuery({
    queryKey: ['tmdb-search', debouncedQuery],
    queryFn: () => isSearching ? externalApiService.searchTmdbFilms(debouncedQuery) : externalApiService.getPopularTmdbFilms(),
    enabled: activeTab === 'tmdb'
  });

  const { data: booksResults, isLoading: booksLoading } = useQuery({
    queryKey: ['books-search', debouncedQuery],
    queryFn: () => externalApiService.searchGoogleBooks(debouncedQuery, 0, 40),
    enabled: activeTab === 'books' && isSearching
  });

  // Initial load for "all content" if no search/filter
  const { data: allContent, isLoading: allContentLoading } = useFilteredContent({
    limit: 50
  }, { enabled: activeTab === 'database' && !isSearching && !hasFilters });

  // Determine which results to display
  let displayResults: any[] = [];
  let isContentLoading = false;

  if (activeTab === 'database') {
    displayResults = isSearching 
      ? searchResults ?? []
      : hasFilters 
        ? filterResults ?? []
        : allContent ?? [];
    isContentLoading = isSearching ? searchLoading : hasFilters ? filterLoading : allContentLoading;
  } else if (activeTab === 'tmdb') {
    displayResults = (tmdbResults ?? []).map(film => ({
      id: film.id,
      baslik: film.baslik,
      posterUrl: film.posterUrl,
      ortalamaPuan: film.puan,
      tur: 'film' as const,
      yayinTarihi: film.yayinTarihi,
      aciklama: film.aciklama,
      isExternal: true,
      externalId: film.id
    }));
    isContentLoading = tmdbLoading;
  } else if (activeTab === 'books') {
    displayResults = (booksResults ?? []).map(book => ({
      id: book.id,
      baslik: book.baslik,
      posterUrl: book.posterUrl,
      ortalamaPuan: 0,
      tur: 'kitap' as const,
      yayinTarihi: book.yayinTarihi,
      aciklama: book.aciklama,
      isExternal: true,
      externalId: book.id
    }));
    isContentLoading = booksLoading;
  }

  const handleClearFilters = () => {
    setTur(undefined);
    setTurler([]);
    setMinPuan(undefined);
    setMaxPuan(undefined);
    setMinYil(undefined);
    setMaxYil(undefined);
  };

  const getCurrentTurler = () => {
    return tur === 'film' ? filmTurleri : tur === 'kitap' ? kitapKategorileri : [];
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Başlık */}
        <Title order={1}>Keşfet</Title>

        {/* Tabs for different sources */}
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value as any)}>
          <Tabs.List>
            <Tabs.Tab value="database">Tümü</Tabs.Tab>
            <Tabs.Tab value="tmdb">TMDB'de Ara</Tabs.Tab>
            <Tabs.Tab value="books">Kitap Ara</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* Arama Kutusu */}
        <TextInput
          placeholder={
            activeTab === 'database' 
              ? "Veritabanında ara..." 
              : activeTab === 'tmdb'
                ? "TMDB'de film ara..."
                : "Google Books'ta kitap ara..."
          }
          leftSection={<IconSearch size={16} />}
          size="lg"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          rightSection={
            searchQuery && (
              <ActionIcon variant="subtle" onClick={() => setSearchQuery('')}>
                <IconX size={16} />
              </ActionIcon>
            )
          }
        />

        {/* Filtreler - Only for database tab */}
        {activeTab === 'database' && (
        <Paper withBorder p="md">
          <Group justify="space-between" mb={showFilters ? 'md' : 0}>
            <Button
              leftSection={<IconFilter size={16} />}
              variant="light"
              onClick={() => setShowFilters(!showFilters)}
            >
              Filtreler {hasFilters && `(${[tur, ...turler, minPuan, maxPuan, minYil, maxYil].filter(Boolean).length})`}
            </Button>
            
            {hasFilters && (
              <Button variant="subtle" color="red" onClick={handleClearFilters}>
                Filtreleri Temizle
              </Button>
            )}
          </Group>

          <Collapse in={showFilters}>
            <Grid gutter="md" mt="md">
              {/* İçerik Türü */}
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label="İçerik Türü"
                  placeholder="Seçiniz"
                  data={[
                    { value: 'film', label: 'Film' },
                    { value: 'kitap', label: 'Kitap' },
                  ]}
                  value={tur}
                  onChange={(value) => {
                    setTur(value as 'film' | 'kitap' | undefined);
                    setTurler([]); // Tür değişince kategorileri temizle
                  }}
                  clearable
                />
              </Grid.Col>

              {/* Kategori/Tür (Film türleri veya Kitap kategorileri) */}
              {tur && (
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Select
                    label={tur === 'film' ? 'Film Türü' : 'Kitap Kategorisi'}
                    placeholder="Seçiniz"
                    data={getCurrentTurler()}
                    value={turler[0] || null}
                    onChange={(value) => setTurler(value ? [value] : [])}
                    clearable
                    searchable
                  />
                </Grid.Col>
              )}

              {/* Minimum Puan */}
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <NumberInput
                  label="Minimum Puan"
                  placeholder="0"
                  min={0}
                  max={10}
                  step={0.5}
                  value={minPuan}
                  onChange={(value) => setMinPuan(value as number | undefined)}
                  allowDecimal
                />
              </Grid.Col>

              {/* Maximum Puan */}
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <NumberInput
                  label="Maximum Puan"
                  placeholder="10"
                  min={0}
                  max={10}
                  step={0.5}
                  value={maxPuan}
                  onChange={(value) => setMaxPuan(value as number | undefined)}
                  allowDecimal
                />
              </Grid.Col>

              {/* Minimum Yıl */}
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <NumberInput
                  label="Başlangıç Yılı"
                  placeholder="1900"
                  min={1900}
                  max={new Date().getFullYear()}
                  value={minYil}
                  onChange={(value) => setMinYil(value as number | undefined)}
                />
              </Grid.Col>

              {/* Maximum Yıl */}
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <NumberInput
                  label="Bitiş Yılı"
                  placeholder={new Date().getFullYear().toString()}
                  min={1900}
                  max={new Date().getFullYear()}
                  value={maxYil}
                  onChange={(value) => setMaxYil(value as number | undefined)}
                />
              </Grid.Col>
            </Grid>
          </Collapse>
        </Paper>
        )}

        {/* Vitrin Modülleri - Sadece database tab ve arama/filtre yokken */}
        {activeTab === 'database' && !isSearching && !hasFilters && (
          <VitrinModulleri navigate={navigate} />
        )}

        {/* Sonuçlar */}
        {isContentLoading ? (
          <Grid>
            {[...Array(12)].map((_, index) => (
              <Grid.Col key={index} span={{ base: 12, xs: 6, sm: 4, md: 3, lg: 2 }}>
                <ContentCardSkeleton />
              </Grid.Col>
            ))}
          </Grid>
        ) : displayResults && displayResults.length > 0 ? (
          <>
            <Text c="dimmed">
              {displayResults.length} sonuç bulundu
            </Text>
            <Grid>
              {displayResults.map((icerik) => (
                <Grid.Col key={icerik.id} span={{ base: 6, xs: 6, sm: 4, md: 3, lg: 2 }}>
                  <Card
                    shadow="sm"
                    padding="lg"
                    radius="md"
                    withBorder
                    style={{ 
                      cursor: importingId === icerik.externalId ? 'wait' : 'pointer', 
                      height: '100%',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (importingId !== icerik.externalId) {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '';
                    }}
                    onClick={() => {
                      if (importingId) return; // Başka bir import devam ediyorsa tıklamayı engelle
                      if (icerik.isExternal) {
                        handleExternalContentClick(icerik);
                      } else {
                        navigate(`/icerik/${icerik.id}`);
                      }
                    }}
                  >
                    {/* Loading overlay */}
                    {importingId === icerik.externalId && (
                      <Overlay color="#fff" backgroundOpacity={0.7} center zIndex={5}>
                        <Loader size="lg" />
                      </Overlay>
                    )}
                    <Card.Section>
                      <Image
                        src={icerik.posterUrl || 'https://placehold.co/300x450/e2e8f0/64748b?text=No+Image'}
                        height={300}
                        alt={icerik.baslik}
                        fallbackSrc="https://placehold.co/300x450/e2e8f0/64748b?text=No+Image"
                      />
                    </Card.Section>

                    <Stack gap="xs" mt="md">
                      <Text fw={500} lineClamp={2} size="sm">
                        {icerik.baslik}
                      </Text>

                      <Flex justify="space-between" align="center">
                        <Badge color={icerik.tur === 'film' ? 'blue' : 'green'} variant="light">
                          {icerik.tur === 'film' ? 'Film' : 'Kitap'}
                        </Badge>

                        {(icerik.ortalamaPuan ?? 0) > 0 && (
                          <Tooltip 
                            label={icerik.isExternal ? (icerik.tur === 'film' ? 'TMDB Puanı' : 'Google Puanı') : 'Platform Puanı'}
                            position="top"
                          >
                            <Group gap={4}>
                              <IconStar size={14} fill="gold" color="gold" />
                              <Text size="xs" fw={500}>
                                {icerik.ortalamaPuan.toFixed(1)}
                              </Text>
                            </Group>
                          </Tooltip>
                        )}
                      </Flex>

                      {icerik.yayinTarihi && (
                        <Text size="xs" c="dimmed">
                          {new Date(icerik.yayinTarihi).getFullYear()}
                        </Text>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          </>
        ) : (isSearching || hasFilters) ? (
          <EmptyState
            icon={<IconSearch size={48} stroke={1.5} color="gray" />}
            title="Sonuç Bulunamadı"
            description={isSearching ? 'Farklı bir arama terimi deneyin' : 'Filtreleri değiştirmeyi deneyin'}
          />
        ) : (
           // Should not happen with default load, but fallback
          <EmptyState
            icon={<IconSearch size={48} stroke={1.5} color="gray" />}
            title="İçerik Bulunamadı"
            description="Henüz içerik eklenmemiş olabilir."
          />
        )}
      </Stack>
    </Container>
  );
}