import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircleOutlined, LockOutlined } from '@ant-design/icons';
import { Progress, Tag, theme } from '@/shared/antd-imports';
import type { PortalSettingsV2, SharedCounts } from '@/types/client-portal/v2';
import { SectionCard } from './SectionCard';
import { SettingsToggleRow } from './SettingsToggleRow';
import { PortalLoader } from '@/components/client-portal/v2';

interface SharingVisibilitySectionProps {
  settings: PortalSettingsV2;
  /** Undefined while the settings query is still loading. */
  shared: SharedCounts | undefined;
  onChange: (patch: Partial<PortalSettingsV2>) => void;
}

interface FixedRule {
  key: string;
  defaultValue: string;
}

const FIXED_RULES: FixedRule[] = [
  {
    key: 'sharing.rules.defaultInternal',
    defaultValue:
      'Tasks, files, milestones and comments are Internal Only by default, for existing and new items.',
  },
  {
    key: 'sharing.rules.explicitShare',
    defaultValue:
      'Nothing reaches the portal until an authorized team member marks it Client Visible.',
  },
  {
    key: 'sharing.rules.revertImmediate',
    defaultValue:
      'Turning an item back to Internal Only removes it from the portal immediately and keeps its internal history.',
  },
  {
    key: 'sharing.rules.neverExposed',
    defaultValue:
      'Internal comments, time logs, estimates, costs and dependencies are never exposed, whatever you share.',
  },
  {
    key: 'sharing.rules.noHints',
    defaultValue:
      'A hidden item is never counted or hinted at in dashboards, lists or notifications.',
  },
];

const percentOf = (shared: number, total: number): number =>
  total > 0 ? Math.round((shared / total) * 100) : 0;

export const SharingVisibilitySection: React.FC<SharingVisibilitySectionProps> = ({
  settings,
  shared,
  onChange,
}) => {
  const { t } = useTranslation('client-portal-v2-settings');
  const { token } = theme.useToken();

  const sharedRows: { key: string; label: string; counts: { shared: number; total: number } | undefined }[] = [
    { key: 'tasks', label: t('sharing.shared.tasks', { defaultValue: 'Tasks' }), counts: shared?.tasks },
    { key: 'files', label: t('sharing.shared.files', { defaultValue: 'Files' }), counts: shared?.files },
    {
      key: 'milestones',
      label: t('sharing.shared.milestones', { defaultValue: 'Milestones' }),
      counts: shared?.milestones,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard
        title={
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>{t('sharing.rules.title', { defaultValue: 'How sharing works' })}</span>
            <Tag icon={<LockOutlined />} style={{ margin: 0 }}>
              {t('sharing.rules.fixedTag', { defaultValue: 'Fixed rules' })}
            </Tag>
          </span>
        }
      >
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {FIXED_RULES.map((rule, index) => (
            <li
              key={rule.key}
              style={{
                display: 'flex',
                gap: 8,
                padding: '8px 0',
                fontSize: 12.5,
                borderBottom:
                  index === FIXED_RULES.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <CheckCircleOutlined style={{ color: token.colorSuccess, marginTop: 3 }} aria-hidden />
              <span style={{ color: token.colorTextSecondary }}>
                {t(rule.key, { defaultValue: rule.defaultValue })}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title={t('sharing.shared.title', { defaultValue: 'Currently shared across portal projects' })}
        description={t('sharing.shared.description', {
          defaultValue: 'Counted over projects that have the Client Portal turned on.',
        })}
      >
        {shared === undefined ? (
          <PortalLoader />
        ) : (
          sharedRows.map((row, index) => {
            const counts = row.counts ?? { shared: 0, total: 0 };
            return (
              <div
                key={row.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 0',
                  fontSize: 13,
                  borderBottom:
                    index === sharedRows.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <span style={{ width: 90, flexShrink: 0 }}>{row.label}</span>
                <div style={{ flex: 1, minWidth: 60 }}>
                  <Progress
                    percent={percentOf(counts.shared, counts.total)}
                    showInfo={false}
                    size="small"
                    strokeColor={token.colorSuccess}
                    aria-label={row.label}
                  />
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: token.colorTextSecondary,
                    minWidth: 120,
                    textAlign: 'right',
                  }}
                >
                  {t('sharing.shared.count', {
                    shared: counts.shared,
                    total: counts.total,
                    defaultValue: '{{shared}} of {{total}} client visible',
                  })}
                </span>
              </div>
            );
          })
        )}
      </SectionCard>

      <SectionCard title={t('sharing.defaults.title', { defaultValue: 'Sections and defaults' })}>
        <SettingsToggleRow
          label={t('sharing.defaults.showInvoices.label', {
            defaultValue: 'Show Invoices in the client portal',
          })}
          description={t('sharing.defaults.showInvoices.description', {
            defaultValue: 'Adds an Invoices page for clients. Hidden by default.',
          })}
          checked={settings.show_invoices}
          onChange={checked => onChange({ show_invoices: checked })}
        />
        <SettingsToggleRow
          label={t('sharing.defaults.clientUploads.label', {
            defaultValue: 'Allow client uploads on new portal projects',
          })}
          description={t('sharing.defaults.clientUploads.description', {
            defaultValue:
              'Client Admins and Client Members can add files. Client Viewers never can. You can override this per project.',
          })}
          checked={settings.allow_client_uploads_default}
          onChange={checked => onChange({ allow_client_uploads_default: checked })}
          isLast
        />
      </SectionCard>
    </div>
  );
};

export default SharingVisibilitySection;
