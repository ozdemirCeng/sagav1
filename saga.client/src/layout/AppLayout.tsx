import { AppShell, Group, Burger, Title, Button, Menu, Avatar, rem, Stack, NavLink, ScrollArea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  IconLogout, 
  IconUser, 
  IconSettings, 
  IconHome,
  IconSearch,
  IconStar,
  IconList,
} from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';

export default function AppLayout() {
    const [opened, { toggle, close }] = useDisclosure();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, signOut } = useAuth();

    const navigationItems = [
        { icon: IconHome, label: 'Ana Sayfa', path: '/' },
        { icon: IconSearch, label: 'Keşfet', path: '/kesfet' },
        ...(user ? [
            { icon: IconStar, label: 'Kütüphanem', path: '/kutuphane' },
            { icon: IconList, label: 'Listelerim', path: '/listeler' },
        ] : []),
    ];

    const handleNavigation = (path: string) => {
        navigate(path);
        close(); // Mobilde menüyü kapat
    };

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{
                width: 300,
                breakpoint: 'sm',
                collapsed: { mobile: !opened },
            }}
            padding="md"
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    {/* SOL TARA: Logo ve Burger Menü */}
                    <Group>
                        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                        <Title order={3} style={{ cursor: 'pointer' }} onClick={() => handleNavigation('/')}>
                            🎬 Saga
                        </Title>
                    </Group>

                    {/* SAĞ TARAF: Menü ve Butonlar */}
                    <Group>
                        <Button variant="subtle" onClick={() => handleNavigation('/kesfet')}>Keşfet</Button>

                        {user ? (
                            // Kullanıcı giriş yapmışsa: Profil Menüsü
                            <Menu shadow="md" width={200} position="bottom-end">
                                <Menu.Target>
                                    <Avatar
                                        src={user.profilResmi}
                                        alt={user.kullaniciAdi}
                                        radius="xl"
                                        style={{ cursor: 'pointer' }}
                                        color="blue"
                                    >
                                        {user.kullaniciAdi?.[0]?.toUpperCase()}
                                    </Avatar>
                                </Menu.Target>

                                <Menu.Dropdown>
                                    <Menu.Label>Hesabım ({user.kullaniciAdi})</Menu.Label>

                                    <Menu.Item
                                        leftSection={<IconUser style={{ width: rem(14), height: rem(14) }} />}
                                        onClick={() => navigate(`/profil/${user.kullaniciAdi}`)}
                                    >
                                        Profilim
                                    </Menu.Item>

                                    <Menu.Item 
                                        leftSection={<IconSettings style={{ width: rem(14), height: rem(14) }} />}
                                        onClick={() => navigate('/ayarlar')}
                                    >
                                        Ayarlar
                                    </Menu.Item>

                                    <Menu.Divider />

                                    <Menu.Item
                                        color="red"
                                        leftSection={<IconLogout style={{ width: rem(14), height: rem(14) }} />}
                                        onClick={() => {
                                            signOut();
                                            navigate('/giris');
                                        }}
                                    >
                                        Çıkış Yap
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                        ) : (
                            // Giriş yapmamışsa: Giriş Butonu
                            <Button variant="light" onClick={() => navigate('/giris')}>Giriş Yap</Button>
                        )}
                    </Group>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar p="md">
                <ScrollArea>
                    <Stack gap="xs">
                        {navigationItems.map((item) => (
                            <NavLink
                                key={item.path}
                                label={item.label}
                                leftSection={<item.icon size={20} stroke={1.5} />}
                                active={location.pathname === item.path}
                                onClick={() => handleNavigation(item.path)}
                                style={{ borderRadius: 'var(--mantine-radius-md)' }}
                            />
                        ))}
                    </Stack>
                </ScrollArea>
            </AppShell.Navbar>

            <AppShell.Main>
                {/* Sayfalar burada render olacak */}
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}