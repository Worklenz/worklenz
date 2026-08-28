import React from 'react';
import {
  Flex,
  Typography,
  theme,
  DownOutlined,
  SettingOutlined,
  SyncOutlined,
  LeftOutlined,
  RightOutlined,
} from '@/shared/antd-imports';

const { useToken } = theme;
const { Text } = Typography;

// Decorative toolbar chrome shared by the Planner preview mockups (Schedule/
// Timeline/Workload) so the blurred backdrop reads as "the real app", not a
// generic placeholder — reused three times, so it's factored out once.
// Uses antd theme tokens (not hardcoded hex) so it doesn't turn into stray
// white rectangles when the app is in dark mode.
export const FilterPill: React.FC<{ label: string }> = ({ label }) => {
  const { token } = useToken();
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 6,
        border: `1px solid ${token.colorBorder}`,
        fontSize: 12,
        color: token.colorTextSecondary,
        background: token.colorBgContainer,
        whiteSpace: 'nowrap',
      }}
    >
      {label} <DownOutlined style={{ fontSize: 8 }} />
    </div>
  );
};

export const ViewToggleGroup: React.FC<{ options: string[]; active: string }> = ({
  options,
  active,
}) => {
  const { token } = useToken();
  return (
    <Flex style={{ border: `1px solid ${token.colorBorder}`, borderRadius: 6, overflow: 'hidden' }}>
      {options.map(opt => (
        <div
          key={opt}
          style={{
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: opt === active ? 600 : 400,
            background: opt === active ? token.colorPrimary : token.colorBgContainer,
            color: opt === active ? token.colorTextLightSolid : token.colorTextSecondary,
          }}
        >
          {opt}
        </div>
      ))}
    </Flex>
  );
};

export const DateNavRow: React.FC<{
  label: string;
  viewOptions: string[];
  activeView: string;
  extra?: React.ReactNode;
}> = ({ label, viewOptions, activeView, extra }) => {
  const { token } = useToken();
  return (
    <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
      <Flex align="center" gap={8}>
        {extra}
        <LeftOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
        <Text strong style={{ fontSize: 13 }}>
          {label}
        </Text>
        <RightOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
      </Flex>
      <Flex align="center" gap={8}>
        <ViewToggleGroup options={viewOptions} active={activeView} />
        <SyncOutlined style={{ color: token.colorTextTertiary }} />
        <SettingOutlined style={{ color: token.colorTextTertiary }} />
      </Flex>
    </Flex>
  );
};

// Translucent tint + solid accent text, same convention already used for the
// crown badge in FeatureUpgradePreview.tsx (`rgba(250,173,20,0.15)` behind a
// solid `#faad14` icon) — reads correctly on both a white and a near-black
// card surface, unlike an opaque pastel fill.
export const CHIP_COLORS = {
  green: { bg: 'rgba(82,196,26,0.16)', fg: '#52c41a' },
  blue: { bg: 'rgba(22,119,255,0.16)', fg: '#1677ff' },
  purple: { bg: 'rgba(146,84,222,0.16)', fg: '#9254de' },
  yellow: { bg: 'rgba(250,173,20,0.18)', fg: '#faad14' },
  gray: { bg: 'rgba(140,140,140,0.2)', fg: '#8c8c8c' },
} as const;

export const HIGHLIGHT_TINTS = {
  today: { header: 'rgba(22,119,255,0.12)', body: 'rgba(22,119,255,0.06)', text: '#1677ff' },
  over: { body: 'rgba(255,77,79,0.14)', text: '#ff4d4f' },
  footer: 'rgba(140,140,140,0.14)',
} as const;
