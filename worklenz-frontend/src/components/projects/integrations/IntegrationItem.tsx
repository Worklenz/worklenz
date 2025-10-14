import { Tag } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { IntegrationItemProps } from './integrations.types';

export const IntegrationItem: React.FC<IntegrationItemProps> = ({
  icon,
  title,
  description,
  badge,
  channels,
  comingSoon,
  onClick
}) => {
  const { t } = useTranslation('project-integrations');

  return (
    <div
      className={`integration-item ${comingSoon ? 'disabled' : 'clickable'}`}
      onClick={!comingSoon ? onClick : undefined}
      style={{
        padding: '12px 16px',
        cursor: comingSoon ? 'not-allowed' : 'pointer',
        opacity: comingSoon ? 0.6 : 1,
        borderBottom: '1px solid var(--border-color, #f0f0f0)',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!comingSoon) {
          e.currentTarget.style.backgroundColor = 'var(--hover-bg, #f5f5f5)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>{title}</span>
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
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #8c8c8c)', lineHeight: 1.4 }}>
            {description}
          </div>
          {channels && channels.length > 0 && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--primary-color, #1890ff)',
                marginTop: 6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {channels.join(' • ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
