import { Card, Flex, Typography, theme } from 'antd';
import type { ReactNode } from 'react';

interface IntegrationTileProps {
  icon: ReactNode;
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}

export function IntegrationTile({ icon, title, extra, children }: IntegrationTileProps) {
  const { token } = theme.useToken();
  return (
    <Card
      className="h-full"
      style={{ borderColor: token.colorBorderSecondary, borderRadius: token.borderRadiusLG }}
      styles={{
        body: { padding: 20, height: '100%', display: 'flex', flexDirection: 'column', gap: 12 },
      }}
    >
      <Flex align="center" justify="space-between" gap={12} wrap="wrap">
        <Flex align="center" gap={12} style={{ minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: token.borderRadius,
              background: token.colorFillAlter,
              fontSize: 28,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
          <Typography.Text strong style={{ fontSize: 15 }}>
            {title}
          </Typography.Text>
        </Flex>
        {extra}
      </Flex>
      {children}
    </Card>
  );
}
