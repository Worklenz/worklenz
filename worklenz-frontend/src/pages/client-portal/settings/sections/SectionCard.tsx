import React from 'react';
import { theme } from '@/shared/antd-imports';

interface SectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/** A plain bordered card — the look used throughout this settings page instead of AntD `Card` chrome. */
export const SectionCard: React.FC<SectionCardProps> = ({ title, description, children, style }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
        padding: 20,
        background: token.colorBgContainer,
        ...style,
      }}
    >
      {title && (
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: description ? 4 : 14 }}>{title}</div>
      )}
      {description && (
        <div style={{ fontSize: 12.5, color: token.colorTextSecondary, marginBottom: 14 }}>
          {description}
        </div>
      )}
      {children}
    </div>
  );
};

export default SectionCard;
