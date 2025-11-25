import { Stack, Text, Title } from '@mantine/core';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Stack align="center" gap="md" py="xl">
      {icon}
      <Title order={3} c="dimmed">
        {title}
      </Title>
      {description && (
        <Text c="dimmed" ta="center" size="sm">
          {description}
        </Text>
      )}
      {action}
    </Stack>
  );
}
