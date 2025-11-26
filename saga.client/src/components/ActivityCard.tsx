import {
  Card,
  Group,
  Avatar,
  Text,
  Stack,
  Image,
  Badge,
  ActionIcon,
  Box,
  Anchor,
  Tooltip,
} from '@mantine/core';
import { IconStar, IconHeart, IconMessageCircle, IconBook, IconMovie, IconList, IconUserPlus, IconBookmark } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { AktiviteFeedDto } from '../services/aktiviteService';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface ActivityCardProps {
  aktivite: AktiviteFeedDto;
  onLike?: (id: number) => void;
  onComment?: (id: number) => void;
}

// Aktivite türüne göre aksiyon metni
function getAksiyonMetni(aktiviteTuru: string): string {
  switch (aktiviteTuru) {
    case 'puanlama':
      return 'bir içeriği puanladı';
    case 'yorum':
      return 'bir yorum yaptı';
    case 'listeye_ekleme':
      return 'bir içeriği listesine ekledi';
    case 'takip':
      return 'bir kullanıcıyı takip etmeye başladı';
    case 'durum_guncelleme':
      return 'kütüphanesini güncelledi';
    default:
      return 'bir aktivite gerçekleştirdi';
  }
}

// Aktivite türüne göre ikon
function getAktiviteIkon(aktiviteTuru: string) {
  switch (aktiviteTuru) {
    case 'puanlama':
      return <IconStar size={16} />;
    case 'yorum':
      return <IconMessageCircle size={16} />;
    case 'listeye_ekleme':
      return <IconList size={16} />;
    case 'takip':
      return <IconUserPlus size={16} />;
    case 'durum_guncelleme':
      return <IconBookmark size={16} />;
    default:
      return null;
  }
}

// Puan gösterimi
function PuanGoster({ puan }: { puan: number }) {
  const stars = [];
  const fullStars = Math.floor(puan / 2); // 10 üzerinden 5 yıldıza çevir
  const hasHalfStar = puan % 2 >= 1;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <IconStar key={i} size={18} fill="gold" color="gold" />
      );
    } else if (i === fullStars && hasHalfStar) {
      stars.push(
        <IconStar key={i} size={18} fill="gold" color="gold" style={{ clipPath: 'inset(0 50% 0 0)' }} />
      );
    } else {
      stars.push(
        <IconStar key={i} size={18} color="gray" />
      );
    }
  }

  return (
    <Group gap={2}>
      {stars}
      <Text size="sm" fw={600} ml={8}>
        {puan}/10
      </Text>
    </Group>
  );
}

export function ActivityCard({ aktivite, onLike, onComment }: ActivityCardProps) {
  const navigate = useNavigate();
  const { kullaniciId, kullaniciAdi, kullaniciAvatar, aktiviteTuru, olusturulmaZamani, veri } = aktivite;

  // Zaman formatı
  const tarihStr = formatDistanceToNow(new Date(olusturulmaZamani), {
    addSuffix: true,
    locale: tr,
  });

  // İçerik türü ikonu
  const turIkon = veri?.tur === 'film' ? <IconMovie size={14} /> : <IconBook size={14} />;

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      {/* Header */}
      <Group justify="space-between" mb="sm">
        <Group>
          <Avatar
            src={kullaniciAvatar}
            radius="xl"
            size="md"
            onClick={() => navigate(`/profil/${kullaniciAdi}`)}
            style={{ cursor: 'pointer' }}
          />
          <Stack gap={0}>
            <Group gap="xs">
              <Anchor
                size="sm"
                fw={600}
                onClick={() => navigate(`/profil/${kullaniciAdi}`)}
                style={{ cursor: 'pointer' }}
              >
                {kullaniciAdi}
              </Anchor>
              <Badge size="xs" variant="light" leftSection={getAktiviteIkon(aktiviteTuru)}>
                {getAksiyonMetni(aktiviteTuru)}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {tarihStr}
            </Text>
          </Stack>
        </Group>
      </Group>

      {/* Body - Aktivite türüne göre değişir */}
      {aktiviteTuru === 'puanlama' && veri && (
        <Group align="flex-start" gap="md">
          {veri.posterUrl && (
            <Image
              src={veri.posterUrl}
              alt={veri.baslik || 'İçerik'}
              width={100}
              height={150}
              radius="sm"
              fallbackSrc="https://placehold.co/100x150/e2e8f0/64748b?text=No+Image"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                // İçerik detayına git (ID'yi veri içinden almamız gerekiyor, backend'den gelmeli)
              }}
            />
          )}
          <Stack gap="xs" style={{ flex: 1 }}>
            <Group gap="xs">
              {turIkon}
              <Text fw={500}>{veri.baslik}</Text>
            </Group>
            {veri.puan !== undefined && <PuanGoster puan={veri.puan} />}
          </Stack>
        </Group>
      )}

      {aktiviteTuru === 'yorum' && veri && (
        <Group align="flex-start" gap="md">
          {veri.posterUrl && (
            <Image
              src={veri.posterUrl}
              alt={veri.baslik || 'İçerik'}
              width={80}
              height={120}
              radius="sm"
              fallbackSrc="https://placehold.co/80x120/e2e8f0/64748b?text=No+Image"
            />
          )}
          <Stack gap="xs" style={{ flex: 1 }}>
            <Group gap="xs">
              {turIkon}
              <Text fw={500} size="sm">{veri.baslik}</Text>
            </Group>
            <Box
              p="sm"
              style={{
                backgroundColor: 'var(--mantine-color-gray-0)',
                borderRadius: 'var(--mantine-radius-sm)',
                borderLeft: '3px solid var(--mantine-color-blue-5)',
              }}
            >
              <Text size="sm" lineClamp={3}>
                "{veri.yorumOzet}"
              </Text>
              {veri.yorumOzet && veri.yorumOzet.length > 150 && (
                <Anchor size="xs" mt={4}>
                  ...daha fazlasını oku
                </Anchor>
              )}
            </Box>
          </Stack>
        </Group>
      )}

      {aktiviteTuru === 'listeye_ekleme' && veri && (
        <Group align="flex-start" gap="md">
          {veri.posterUrl && (
            <Image
              src={veri.posterUrl}
              alt={veri.baslik || 'İçerik'}
              width={80}
              height={120}
              radius="sm"
              fallbackSrc="https://placehold.co/80x120/e2e8f0/64748b?text=No+Image"
            />
          )}
          <Stack gap="xs" style={{ flex: 1 }}>
            <Group gap="xs">
              {turIkon}
              <Text fw={500} size="sm">{veri.baslik}</Text>
            </Group>
            {veri.listeAdi && (
              <Badge variant="outline" leftSection={<IconList size={12} />}>
                {veri.listeAdi}
              </Badge>
            )}
          </Stack>
        </Group>
      )}

      {aktiviteTuru === 'takip' && veri && (
        <Group>
          <Avatar
            src={veri.takipEdilenAvatar}
            radius="xl"
            size="lg"
          />
          <Stack gap={0}>
            <Text size="sm" fw={500}>
              {veri.takipEdilenKullaniciAdi}
            </Text>
            <Text size="xs" c="dimmed">
              takip edilmeye başlandı
            </Text>
          </Stack>
        </Group>
      )}

      {aktiviteTuru === 'durum_guncelleme' && veri && (
        <Group align="flex-start" gap="md">
          {veri.posterUrl && (
            <Image
              src={veri.posterUrl}
              alt={veri.baslik || 'İçerik'}
              width={80}
              height={120}
              radius="sm"
              fallbackSrc="https://placehold.co/80x120/e2e8f0/64748b?text=No+Image"
            />
          )}
          <Stack gap="xs" style={{ flex: 1 }}>
            <Group gap="xs">
              {turIkon}
              <Text fw={500} size="sm">{veri.baslik}</Text>
            </Group>
            {veri.durum && (
              <Badge color={veri.durum.includes('izle') || veri.durum.includes('oku') ? 'green' : 'blue'}>
                {veri.durum}
              </Badge>
            )}
          </Stack>
        </Group>
      )}

      {/* Footer - Etkileşim Butonları */}
      <Group mt="md" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
        <Tooltip label="Beğen">
          <ActionIcon variant="subtle" color="red" onClick={() => onLike?.(aktivite.id)}>
            <IconHeart size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Yorum Yap">
          <ActionIcon variant="subtle" color="blue" onClick={() => onComment?.(aktivite.id)}>
            <IconMessageCircle size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Card>
  );
}
