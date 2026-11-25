import { Card, Flex, Typography, theme } from 'antd';
import { useId, type ReactNode } from 'react';
import { RightOutlined } from '@ant-design/icons';

interface IntegrationTileProps {
  icon: ReactNode;
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  onOpenDetails?: () => void;
}

export function IntegrationTile({ icon, title, extra, children, onOpenDetails }: IntegrationTileProps) {
  const titleId = useId();
  const { token } = theme.useToken();
  return (
    <Card
      className="h-full"
      hoverable={Boolean(onOpenDetails)}
      role={onOpenDetails ? 'button' : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
      aria-labelledby={onOpenDetails ? titleId : undefined}
      onClick={onOpenDetails}
      onKeyDown={onOpenDetails ? event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetails();
        }
      } : undefined}
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
          <Typography.Text id={titleId} strong style={{ fontSize: 15 }}>
            {title}
          </Typography.Text>
        </Flex>
        <Flex align="center" gap={8}>{extra}{onOpenDetails && <RightOutlined aria-hidden="true" style={{ color: token.colorTextSecondary }} />}</Flex>
      </Flex>
      {children}
    </Card>
  );
}
