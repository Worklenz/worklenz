import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  MessageOutlined,
  ProjectOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Avatar, Flex, Tooltip, theme } from '@/shared/antd-imports';

export type PreviewTab = 'dashboard' | 'projects' | 'discussions' | 'approvals' | 'change-requests';

interface NavItem {
  key: PreviewTab;
  labelKey: string;
  defaultLabel: string;
  icon: ReactNode;
}

// Mirrors the client portal rail (worklenz-client-portal clientPortalItems), limited to the pages the preview renders.
const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', labelKey: 'nav.dashboard', defaultLabel: 'Overview', icon: <BarChartOutlined /> },
  { key: 'projects', labelKey: 'nav.projects', defaultLabel: 'Projects', icon: <ProjectOutlined /> },
  { key: 'discussions', labelKey: 'nav.discussions', defaultLabel: 'Discussions', icon: <MessageOutlined /> },
  { key: 'approvals', labelKey: 'nav.approvals', defaultLabel: 'Approvals', icon: <AuditOutlined /> },
  { key: 'change-requests', labelKey: 'nav.changeRequests', defaultLabel: 'Change Req.', icon: <SwapOutlined /> },
];

const RAIL_WIDTH = 64;
const CONTENT_CORNER_RADIUS = 12;
const FRAME_HEIGHT = 'min(820px, calc(100vh - 220px))';
const FRAME_MIN_HEIGHT = 600;
// Same tint strengths as the real portal, so the brand reads the same way.
const TINT_LIGHT = 12;
const TINT_DARK = 22;

interface PortalPreviewShellProps {
  brandColor: string;
  isDark: boolean;
  title: string;
  logoUrl: string | null;
  userName: string;
  showPoweredBy: boolean;
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  children: ReactNode;
}

/** The real portal's chrome (tinted top bar + icon rail, curved content pane, footer) driven by the admin's branding. */
export const PortalPreviewShell = ({
  brandColor,
  isDark,
  title,
  logoUrl,
  userName,
  showPoweredBy,
  activeTab,
  onTabChange,
  children,
}: PortalPreviewShellProps) => {
  const { t } = useTranslation('client-portal-v2-preview');
  const { token } = theme.useToken();

  const tint = `color-mix(in srgb, ${brandColor} ${isDark ? TINT_DARK : TINT_LIGHT}%, ${token.colorBgContainer})`;

  return (
    <div
      style={{
        height: FRAME_HEIGHT,
        minHeight: FRAME_MIN_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        background: tint,
        color: token.colorText,
      }}
    >
      <Flex align="center" justify="space-between" gap={12} style={{ height: 52, padding: '0 16px', flexShrink: 0 }}>
        <Flex align="center" gap={10} style={{ minWidth: 0 }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }}
            />
          )}
          <span
            style={{ fontWeight: 600, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {title}
          </span>
        </Flex>
        <Flex align="center" gap={14} style={{ flexShrink: 0 }}>
          <BellOutlined style={{ fontSize: 17 }} aria-hidden />
          <Avatar size={28} style={{ background: brandColor, color: '#fff' }} aria-hidden>
            {userName.trim().charAt(0).toUpperCase()}
          </Avatar>
        </Flex>
      </Flex>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <nav
          aria-label={t('nav.label', { defaultValue: 'Portal navigation' })}
          style={{ width: RAIL_WIDTH, flexShrink: 0, padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          {NAV_ITEMS.map(item => {
            const isActive = item.key === activeTab;
            const label = t(item.labelKey, { defaultValue: item.defaultLabel });
            return (
              <Tooltip key={item.key} title={label} placement="right">
                <button
                  type="button"
                  onClick={() => onTabChange(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                  style={{
                    margin: '0 auto',
                    width: 48,
                    padding: '6px 0',
                    border: 0,
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    fontSize: 10,
                    background: isActive ? token.colorBgContainer : 'transparent',
                    color: isActive ? brandColor : token.colorTextSecondary,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                  <span style={{ maxWidth: 46, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </button>
              </Tooltip>
            );
          })}
        </nav>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            background: token.colorBgContainer,
            borderTopLeftRadius: CONTENT_CORNER_RADIUS,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRight: 0,
            borderBottom: 0,
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>
          {showPoweredBy && (
            <div
              style={{
                textAlign: 'center',
                fontSize: 12,
                padding: '8px 0',
                color: token.colorTextTertiary,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              {t('nav.poweredBy', { defaultValue: 'Powered by Worklenz' })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
