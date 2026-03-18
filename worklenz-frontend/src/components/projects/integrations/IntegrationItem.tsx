import { Tag, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import type { IntegrationItemProps } from './integrations.types';

export const IntegrationItem: React.FC<IntegrationItemProps> = ({
  icon,
  title,
  description,
  badge,
  channels,
  comingSoon,
  onClick,
}) => {
  const { t } = useTranslation('project-integrations');
  const { token } = theme.useToken();

  // Better dark mode detection using multiple token properties
  const isDarkMode =
    token.colorBgContainer === '#1f1f1f' ||
    token.colorBgBase === '#141414' ||
    token.colorBgElevated === '#1f1f1f' ||
    document.documentElement.getAttribute('data-theme') === 'dark' ||
    document.body.classList.contains('dark');

  // Memoize item styles with dark mode support
  const itemStyles = useMemo(
    () => ({
      padding: '12px 16px',
      cursor: comingSoon ? 'not-allowed' : 'pointer',
      opacity: comingSoon ? 0.6 : 1,
      borderBottom: `1px solid ${token.colorBorder}`,
      transition: 'background-color 0.2s',
      color: token.colorText,
    }),
    [comingSoon, token.colorBorder, token.colorText]
  );

  // Memoize hover background color
  const hoverBgColor = token.colorBgTextHover;

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!comingSoon) {
      e.currentTarget.style.backgroundColor = hoverBgColor;
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.backgroundColor = 'transparent';
  };

  // Memoize description styles with dark mode support
  const descriptionStyles = useMemo(
    () => ({
      fontSize: 12,
      color: token.colorTextSecondary,
      lineHeight: 1.4,
    }),
    [token.colorTextSecondary]
  );

  // Memoize channels styles with dark mode support
  const channelsStyles = useMemo(
    () => ({
      fontSize: 12,
      color: token.colorPrimary,
      marginTop: 6,
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    [token.colorPrimary]
  );

  return (
    <div
      className={`integration-item ${comingSoon ? 'disabled' : 'clickable'}`}
      onClick={!comingSoon ? onClick : undefined}
      style={itemStyles}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 500, fontSize: 14, color: token.colorText }}>{title}</span>
            {comingSoon && (
              <Tag color="purple" style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
                🔜 {t('comingSoon', { defaultValue: 'Coming Soon' })}
              </Tag>
            )}
            {badge !== undefined && badge > 0 && !comingSoon && (
              <Tag color="success" style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
                ✓ {badge}
              </Tag>
            )}
          </div>
          <div style={descriptionStyles}>{description}</div>
          {channels && channels.length > 0 && (
            <div style={channelsStyles}>{channels.join(' • ')}</div>
          )}
        </div>
      </div>
    </div>
  );
};
