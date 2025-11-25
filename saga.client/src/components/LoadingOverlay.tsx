import { Center, Loader, Stack, Text } from '@mantine/core';

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingOverlay({ message = 'Yükleniyor...', fullScreen = false }: LoadingOverlayProps) {
  return (
    <Center style={{ minHeight: fullScreen ? '100vh' : '50vh' }}>
      <Stack align="center" gap="md">
        <Loader size="lg" type="dots" />
        <Text c="dimmed" size="sm">
          {message}
        </Text>
      </Stack>
    </Center>
  );
}
