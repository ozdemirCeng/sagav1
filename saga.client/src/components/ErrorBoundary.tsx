import { Component, type ReactNode } from 'react';
import { Container, Title, Text, Button, Stack, Paper } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container size="sm" py="xl">
          <Paper withBorder p="xl" radius="md" shadow="sm">
            <Stack align="center" gap="lg">
              <IconAlertTriangle size={64} color="red" />
              <Title order={2}>Bir Hata Oluştu</Title>
              <Text c="dimmed" ta="center">
                Üzgünüz, bir şeyler yanlış gitti. Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.
              </Text>
              {this.state.error && (
                <Text size="sm" c="red" ta="center" style={{ fontFamily: 'monospace' }}>
                  {this.state.error.message}
                </Text>
              )}
              <Button onClick={() => window.location.reload()}>
                Sayfayı Yenile
              </Button>
            </Stack>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}
