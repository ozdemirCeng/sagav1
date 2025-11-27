import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Title,
  Paper,
  Group,
  Avatar,
  Text,
  Button,
  Stack,
  Tabs,
  Grid,
  Card,
  Image,
  Badge,
  Modal,
  TextInput,
  Textarea,
  ScrollArea,
  ActionIcon,
  Loader,
  Center,
} from '@mantine/core';
import {
  IconUserCircle,
  IconStar,
  IconList,
  IconActivity,
  IconEdit,
  IconCheck,
  IconUsers,
  IconUserMinus,
  IconUserPlus,
  IconLoader,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { kullaniciService } from '../services/kullaniciService';
import { kutuphaneService } from '../services/kutuphaneService';
import { listeService, type ListeListDto } from '../services/listeService';
import { aktiviteService } from '../services/aktiviteService';
import { kullaniciApi, type Kullanici } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { EmptyState } from '../components/EmptyState';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    goruntulemeAdi: '',
    biyografi: '',
    avatarUrl: '',
  });
  
  // Takipçi/Takip Edilen modalları
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [followers, setFollowers] = useState<Kullanici[]>([]);
  const [following, setFollowing] = useState<Kullanici[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);

  // Kendi profilim mi?
  const isOwnProfile = !username || username === user?.kullaniciAdi;

  // Profil verisini getir
  const { data: profil, isLoading: profilLoading } = useQuery({
    queryKey: ['profil', username || 'me'],
    queryFn: () =>
      isOwnProfile
        ? kullaniciService.getMyProfile()
        : kullaniciService.getProfileByUsername(username!),
    enabled: !!user,
  });

  // Kütüphane istatistikleri
  const { data: kutuphaneStats } = useQuery({
    queryKey: ['kutuphane-stats', profil?.id],
    queryFn: () =>
      isOwnProfile
        ? kutuphaneService.getMyStats()
        : kutuphaneService.getUserStats(profil!.id),
    enabled: !!profil?.id,
  });

  // Listeler
  const { data: listeler = [] } = useQuery<ListeListDto[]>({
    queryKey: ['listeler', profil?.id],
    queryFn: () =>
      isOwnProfile
        ? listeService.getMyLists()
        : listeService.getUserLists(profil!.id),
    enabled: !!profil?.id,
  });

  // Aktiviteler - Infinite Query ile sayfalama
  const AKTIVITE_LIMIT = 10;
  const {
    data: aktiviteData,
    fetchNextPage: fetchNextAktivite,
    hasNextPage: hasNextAktivite,
    isFetchingNextPage: isFetchingNextAktivite,
    isLoading: aktiviteLoading,
  } = useInfiniteQuery({
    queryKey: ['aktiviteler-infinite', profil?.id],
    queryFn: async ({ pageParam = 1 }) => {
      if (isOwnProfile) {
        return aktiviteService.getMyActivitiesPaginated({ page: pageParam, limit: AKTIVITE_LIMIT });
      } else {
        return aktiviteService.getUserActivitiesPaginated(profil!.id, { page: pageParam, limit: AKTIVITE_LIMIT });
      }
    },
    getNextPageParam: (lastPage, pages) => {
      if (pages.length < lastPage.toplamSayfa) {
        return pages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!profil?.id,
  });

  // Flat aktivite listesi
  const aktiviteler = aktiviteData?.pages.flatMap(page => page.data) ?? [];
  const aktiviteToplam = aktiviteData?.pages[0]?.toplamKayit ?? 0;

  // Takip et/Bırak mutation
  const followMutation = useMutation({
    mutationFn: async (kullaniciId: string) => {
      if (profil?.takipEdiyorMu) {
        await kullaniciService.unfollow(kullaniciId);
      } else {
        await kullaniciService.follow(kullaniciId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profil'] });
      notifications.show({
        title: 'Başarılı',
        message: profil?.takipEdiyorMu ? 'Takipten çıkıldı' : 'Takip edildi',
        color: 'green',
      });
    },
  });

  // Profil güncelleme mutation
  const updateMutation = useMutation({
    mutationFn: kullaniciService.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profil'] });
      setEditModalOpen(false);
      notifications.show({
        title: 'Başarılı',
        message: 'Profil güncellendi',
        color: 'green',
      });
    },
  });

  const handleEditOpen = () => {
    if (profil) {
      setEditForm({
        goruntulemeAdi: profil.goruntulemeAdi || '',
        biyografi: profil.biyografi || '',
        avatarUrl: profil.avatarUrl || '',
      });
      setEditModalOpen(true);
    }
  };

  // Takipçileri yükle ve modalı aç
  const handleOpenFollowers = async () => {
    if (!profil) return;
    setFollowersModalOpen(true);
    setFollowersLoading(true);
    try {
      const data = await kullaniciApi.getTakipciler(profil.id);
      setFollowers(data);
    } catch (err) {
      console.error('Takipçiler yüklenirken hata:', err);
      notifications.show({
        title: 'Hata',
        message: 'Takipçiler yüklenirken bir hata oluştu',
        color: 'red',
      });
    } finally {
      setFollowersLoading(false);
    }
  };

  // Takip edilenleri yükle ve modalı aç
  const handleOpenFollowing = async () => {
    if (!profil) return;
    setFollowingModalOpen(true);
    setFollowingLoading(true);
    try {
      const data = await kullaniciApi.getTakipEdilenler(profil.id);
      setFollowing(data);
    } catch (err) {
      console.error('Takip edilenler yüklenirken hata:', err);
      notifications.show({
        title: 'Hata',
        message: 'Takip edilenler yüklenirken bir hata oluştu',
        color: 'red',
      });
    } finally {
      setFollowingLoading(false);
    }
  };

  // Takip et/bırak (liste içinden)
  const handleToggleFollow = async (userId: string, isFollowing: boolean) => {
    try {
      await kullaniciApi.takipEt(userId);
      
      // Listeyi güncelle
      if (isFollowing) {
        // Takipten çıkıldı - listeden kaldır (eğer kendi profilimizin takip ettikleri listesindeyse)
        if (isOwnProfile && followingModalOpen) {
          setFollowing(prev => prev.filter(u => u.id !== userId));
        }
      }
      
      // Profil verilerini yenile
      queryClient.invalidateQueries({ queryKey: ['profil'] });
      
      notifications.show({
        title: 'Başarılı',
        message: isFollowing ? 'Takipten çıkıldı' : 'Takip edildi',
        color: 'green',
      });
    } catch (err) {
      console.error('Takip işlemi hatası:', err);
      notifications.show({
        title: 'Hata',
        message: 'İşlem sırasında bir hata oluştu',
        color: 'red',
      });
    }
  };

  if (!user) {
    return (
      <Container size="xl" py="xl">
        <EmptyState
          icon={<IconUserCircle size={64} stroke={1.5} color="gray" />}
          title="Giriş Gerekli"
          description="Profili görüntülemek için giriş yapmalısınız"
          action={<Button onClick={() => navigate('/giris')}>Giriş Yap</Button>}
        />
      </Container>
    );
  }

  if (profilLoading) {
    return <LoadingOverlay message="Profil yükleniyor..." />;
  }

  if (!profil) {
    return (
      <Container size="xl" py="xl">
        <EmptyState
          icon={<IconUserCircle size={64} stroke={1.5} color="gray" />}
          title="Kullanıcı Bulunamadı"
          description="Aradığınız kullanıcı bulunamadı"
          action={<Button onClick={() => navigate('/')}>Ana Sayfaya Dön</Button>}
        />
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Profil Başlık */}
        <Paper withBorder p="xl">
          <Group align="flex-start">
            <Avatar
              src={profil.avatarUrl}
              size={120}
              radius="md"
            >
              <IconUserCircle size={80} />
            </Avatar>

            <Stack gap="xs" style={{ flex: 1 }}>
              <Group justify="space-between">
                <div>
                  <Title order={2}>{profil.goruntulemeAdi || profil.kullaniciAdi}</Title>
                  <Text c="dimmed">@{profil.kullaniciAdi}</Text>
                </div>

                {isOwnProfile ? (
                  <Button leftSection={<IconEdit size={16} />} onClick={handleEditOpen}>
                    Profili Düzenle
                  </Button>
                ) : (
                  <Button
                    variant={profil.takipEdiyorMu ? 'outline' : 'filled'}
                    onClick={() => followMutation.mutate(profil.id)}
                    loading={followMutation.isPending}
                  >
                    {profil.takipEdiyorMu ? 'Takipten Çık' : 'Takip Et'}
                  </Button>
                )}
              </Group>

              {profil.biyografi && (
                <Text size="sm">{profil.biyografi}</Text>
              )}

              <Group gap="xl">
                <div>
                  <Text fw={700} size="lg">{profil.toplamPuanlama}</Text>
                  <Text size="sm" c="dimmed">Puanlama</Text>
                </div>
                <div>
                  <Text fw={700} size="lg">{profil.toplamYorum}</Text>
                  <Text size="sm" c="dimmed">Yorum</Text>
                </div>
                <div>
                  <Text fw={700} size="lg">{profil.toplamListe}</Text>
                  <Text size="sm" c="dimmed">Liste</Text>
                </div>
                <div 
                  onClick={handleOpenFollowers}
                  style={{ cursor: 'pointer' }}
                  className="hover:opacity-80 transition-opacity"
                >
                  <Group gap={4}>
                    <Text fw={700} size="lg">{profil.takipEdenSayisi}</Text>
                    <IconUsers size={14} style={{ opacity: 0.5 }} />
                  </Group>
                  <Text size="sm" c="dimmed">Takipçi</Text>
                </div>
                <div 
                  onClick={handleOpenFollowing}
                  style={{ cursor: 'pointer' }}
                  className="hover:opacity-80 transition-opacity"
                >
                  <Group gap={4}>
                    <Text fw={700} size="lg">{profil.takipEdilenSayisi}</Text>
                    <IconUsers size={14} style={{ opacity: 0.5 }} />
                  </Group>
                  <Text size="sm" c="dimmed">Takip</Text>
                </div>
              </Group>
            </Stack>
          </Group>
        </Paper>

        {/* Kütüphane İstatistikleri */}
        {kutuphaneStats && (
          <Paper withBorder p="lg">
            <Title order={3} mb="md">Kütüphane İstatistikleri</Title>
            <Grid>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Stack gap={4}>
                  <Text size="xl" fw={700}>{kutuphaneStats.izlenenFilm}</Text>
                  <Text size="sm" c="dimmed">İzlenen Film</Text>
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Stack gap={4}>
                  <Text size="xl" fw={700}>{kutuphaneStats.okunanKitap}</Text>
                  <Text size="sm" c="dimmed">Okunan Kitap</Text>
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Stack gap={4}>
                  <Text size="xl" fw={700}>{kutuphaneStats.toplamFilm}</Text>
                  <Text size="sm" c="dimmed">Toplam Film</Text>
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Stack gap={4}>
                  <Text size="xl" fw={700}>{kutuphaneStats.toplamKitap}</Text>
                  <Text size="sm" c="dimmed">Toplam Kitap</Text>
                </Stack>
              </Grid.Col>
            </Grid>
          </Paper>
        )}

        {/* Tabs */}
        <Tabs defaultValue="listeler">
          <Tabs.List>
            <Tabs.Tab value="listeler" leftSection={<IconList size={16} />}>
              Listeler ({listeler.length})
            </Tabs.Tab>
            <Tabs.Tab value="aktiviteler" leftSection={<IconActivity size={16} />}>
              Aktiviteler ({aktiviteToplam})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="listeler" pt="lg">
            {listeler.length > 0 ? (
              <Grid>
                {listeler.map((liste) => (
                  <Grid.Col key={liste.id} span={{ base: 12, sm: 6, md: 4 }}>
                    <Card
                      withBorder
                      padding="lg"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/liste/${liste.id}`)}
                    >
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text fw={600}>{liste.ad}</Text>
                          <Badge>{liste.icerikSayisi} içerik</Badge>
                        </Group>
                        <Text size="sm" c="dimmed">
                          {liste.herkeseAcik ? 'Herkese Açık' : 'Özel'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(liste.olusturulmaZamani).toLocaleDateString('tr-TR')}
                        </Text>
                      </Stack>
                    </Card>
                  </Grid.Col>
                ))}
              </Grid>
            ) : (
              <EmptyState
                icon={<IconList size={48} stroke={1.5} color="gray" />}
                title="Liste Yok"
                description="Henüz liste oluşturulmamış"
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="aktiviteler" pt="lg">
            {aktiviteLoading ? (
              <Center py="xl">
                <Loader size="lg" />
              </Center>
            ) : aktiviteler.length > 0 ? (
              <Stack gap="md">
                {aktiviteler.map((aktivite) => (
                  <Paper key={aktivite.id} withBorder p="md">
                    <Group>
                      {aktivite.posterUrl && (
                        <Image
                          src={aktivite.posterUrl}
                          width={60}
                          height={90}
                          radius="sm"
                          fallbackSrc="https://placehold.co/60x90/e2e8f0/64748b?text=No+Image"
                        />
                      )}
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Group gap="xs">
                          <Badge>{aktivite.aktiviteTuru}</Badge>
                          <Text size="sm" c="dimmed">
                            {new Date(aktivite.olusturulmaZamani).toLocaleDateString('tr-TR')}
                          </Text>
                        </Group>
                        <Text fw={500}>{aktivite.icerikBaslik}</Text>
                        {aktivite.puan && (
                          <Group gap={4}>
                            <IconStar size={14} fill="gold" color="gold" />
                            <Text size="sm">{aktivite.puan.toFixed(1)}</Text>
                          </Group>
                        )}
                      </Stack>
                    </Group>
                  </Paper>
                ))}
                
                {/* Daha Fazla Yükle Butonu */}
                {hasNextAktivite && (
                  <Center py="md">
                    <Button
                      variant="light"
                      onClick={() => fetchNextAktivite()}
                      loading={isFetchingNextAktivite}
                      leftSection={!isFetchingNextAktivite && <IconLoader size={16} />}
                    >
                      {isFetchingNextAktivite ? 'Yükleniyor...' : 'Daha Fazla Yükle'}
                    </Button>
                  </Center>
                )}
              </Stack>
            ) : (
              <EmptyState
                icon={<IconActivity size={48} stroke={1.5} color="gray" />}
                title="Aktivite Yok"
                description="Henüz aktivite bulunmuyor"
              />
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Düzenleme Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Profili Düzenle"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Görüntüleme Adı"
            placeholder="İsminiz"
            value={editForm.goruntulemeAdi}
            onChange={(e) => setEditForm({ ...editForm, goruntulemeAdi: e.target.value })}
          />
          <Textarea
            label="Biyografi"
            placeholder="Kendiniz hakkında birkaç kelime..."
            value={editForm.biyografi}
            onChange={(e) => setEditForm({ ...editForm, biyografi: e.target.value })}
            minRows={3}
          />
          <TextInput
            label="Avatar URL"
            placeholder="https://..."
            value={editForm.avatarUrl}
            onChange={(e) => setEditForm({ ...editForm, avatarUrl: e.target.value })}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setEditModalOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={() => updateMutation.mutate(editForm)}
              loading={updateMutation.isPending}
              leftSection={<IconCheck size={16} />}
            >
              Kaydet
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Takipçiler Modal */}
      <Modal
        opened={followersModalOpen}
        onClose={() => setFollowersModalOpen(false)}
        title={
          <Group gap="xs">
            <IconUsers size={20} />
            <Text fw={600}>Takipçiler ({profil?.takipEdenSayisi || 0})</Text>
          </Group>
        }
        size="md"
      >
        <ScrollArea h={400}>
          {followersLoading ? (
            <Group justify="center" py="xl">
              <Loader size="md" />
            </Group>
          ) : followers.length === 0 ? (
            <EmptyState
              icon={<IconUsers size={48} stroke={1.5} color="gray" />}
              title="Takipçi Yok"
              description="Henüz takipçi bulunmuyor"
            />
          ) : (
            <Stack gap="sm">
              {followers.map((follower) => (
                <Paper key={follower.id} withBorder p="sm">
                  <Group justify="space-between">
                    <Group
                      gap="sm"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setFollowersModalOpen(false);
                        navigate(`/profil/${follower.kullaniciAdi}`);
                      }}
                    >
                      <Avatar src={follower.avatarUrl} size={40} radius="xl">
                        <IconUserCircle size={24} />
                      </Avatar>
                      <div>
                        <Text fw={500} size="sm">
                          {follower.goruntulemeAdi || follower.kullaniciAdi}
                        </Text>
                        <Text size="xs" c="dimmed">
                          @{follower.kullaniciAdi} · {follower.takipEdenSayisi} takipçi
                        </Text>
                      </div>
                    </Group>
                    {user && user.id !== follower.id && (
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size="lg"
                        onClick={() => handleToggleFollow(follower.id, false)}
                        title="Takip Et"
                      >
                        <IconUserPlus size={18} />
                      </ActionIcon>
                    )}
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </ScrollArea>
      </Modal>

      {/* Takip Edilenler Modal */}
      <Modal
        opened={followingModalOpen}
        onClose={() => setFollowingModalOpen(false)}
        title={
          <Group gap="xs">
            <IconUsers size={20} />
            <Text fw={600}>Takip Edilenler ({profil?.takipEdilenSayisi || 0})</Text>
          </Group>
        }
        size="md"
      >
        <ScrollArea h={400}>
          {followingLoading ? (
            <Group justify="center" py="xl">
              <Loader size="md" />
            </Group>
          ) : following.length === 0 ? (
            <EmptyState
              icon={<IconUsers size={48} stroke={1.5} color="gray" />}
              title="Takip Edilen Yok"
              description="Henüz kimse takip edilmiyor"
            />
          ) : (
            <Stack gap="sm">
              {following.map((followedUser) => (
                <Paper key={followedUser.id} withBorder p="sm">
                  <Group justify="space-between">
                    <Group
                      gap="sm"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setFollowingModalOpen(false);
                        navigate(`/profil/${followedUser.kullaniciAdi}`);
                      }}
                    >
                      <Avatar src={followedUser.avatarUrl} size={40} radius="xl">
                        <IconUserCircle size={24} />
                      </Avatar>
                      <div>
                        <Text fw={500} size="sm">
                          {followedUser.goruntulemeAdi || followedUser.kullaniciAdi}
                        </Text>
                        <Text size="xs" c="dimmed">
                          @{followedUser.kullaniciAdi} · {followedUser.takipEdenSayisi} takipçi
                        </Text>
                      </div>
                    </Group>
                    {/* Kendi profilimizse takipten çıkma butonu göster */}
                    {isOwnProfile && (
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="lg"
                        onClick={() => handleToggleFollow(followedUser.id, true)}
                        title="Takipten Çık"
                      >
                        <IconUserMinus size={18} />
                      </ActionIcon>
                    )}
                    {/* Başkasının profilindeyse takip et butonu göster */}
                    {!isOwnProfile && user && user.id !== followedUser.id && (
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size="lg"
                        onClick={() => handleToggleFollow(followedUser.id, false)}
                        title="Takip Et"
                      >
                        <IconUserPlus size={18} />
                      </ActionIcon>
                    )}
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </ScrollArea>
      </Modal>
    </Container>
  );
}