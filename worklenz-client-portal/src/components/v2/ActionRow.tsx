import type { ReactNode } from 'react';
import { Flex, Typography, theme } from '@/shared/antd-imports';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface ActionRowProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Tags or a date on the right. */
  right?: ReactNode;
  onClick?: () => void;
  /** Accessible name when the visible title is not enough. */
  label?: string;
}

const decodeDisplayNode = (node: ReactNode): ReactNode =>
  typeof node === 'string' ? decodeHtmlEntities(node) : node;

/** A clickable row inside a card: used for "needs your action", milestones, quick links, activity. */
export const ActionRow = ({ icon, title, subtitle, right, onClick, label }: ActionRowProps) => {
  const { token } = theme.useToken();
  return (
    <Flex
      align="center"
      wrap="wrap"
      gap={12}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={label}
      onClick={onClick}
      onKeyDown={
        onClick
          ? event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        padding: '10px 4px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {icon && (
        <span aria-hidden style={{ color: token.colorTextSecondary, display: 'flex' }}>
          {icon}
        </span>
      )}
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <Typography.Text strong style={{ display: 'block' }}>
          {decodeDisplayNode(title)}
        </Typography.Text>
        {subtitle && (
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {decodeDisplayNode(subtitle)}
          </Typography.Text>
        )}
      </div>
      {right && <Flex gap={8} align="center">{right}</Flex>}
    </Flex>
  );
};
