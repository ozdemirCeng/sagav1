import { Card, Skeleton, Stack } from '@mantine/core';

export function ContentCardSkeleton() {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Card.Section>
        <Skeleton height={300} />
      </Card.Section>

      <Stack gap="xs" mt="md">
        <Skeleton height={20} width="80%" />
        <Skeleton height={16} width="40%" />
        <Skeleton height={16} width="60%" />
      </Stack>
    </Card>
  );
}
