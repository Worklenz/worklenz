import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, theme } from '@/shared/antd-imports';
import { InfoCircleOutlined, CheckOutlined } from '@ant-design/icons';
import { IClientPortalSettings } from '@/types/settings/client-portal-settings.types';
import { SectionCard } from './SectionCard';
import { SettingsToggleRow } from './SettingsToggleRow';

interface ClientUserManagementSectionProps {
  settings: IClientPortalSettings;
  onChange: (patch: Partial<IClientPortalSettings>) => void;
}

export const ClientUserManagementSection: React.FC<ClientUserManagementSectionProps> = ({
  settings,
  onChange,
}) => {
  const { t } = useTranslation('client-portal-settings');
  const { token } = theme.useToken();

  const guardrails = [
    t('clientUsers.guardrail1', {
      defaultValue:
        "A point of contact only ever sees and manages their own company's users — never another client's.",
    }),
    t('clientUsers.guardrail2', {
      defaultValue:
        'A point of contact never sees your internal team directory or gets organization-admin access.',
    }),
    t('clientUsers.guardrail3', {
      defaultValue:
        "Removing a company's only point of contact never deletes the company or its other users — it just leaves that company without one.",
    }),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message={t('clientUsers.bannerTitle', { defaultValue: 'Not enforced yet' })}
        description={t('clientUsers.bannerDescription', {
          defaultValue:
            "These settings define what a company's point of contact (POC) will be allowed to do once the client-facing portal supports it. For now, POC is a directory label only — nothing here is enforced anywhere yet.",
        })}
      />

      <SectionCard
        title={t('clientUsers.selfManagementTitle', { defaultValue: 'POC self-management' })}
        description={t('clientUsers.selfManagementDescription', {
          defaultValue:
            "Let a company's own point of contact manage who from their company has portal access, instead of routing every add/remove through your team.",
        })}
      >
        <SettingsToggleRow
          label={t('clientUsers.canAdd.label', { defaultValue: 'Let POCs add company users' })}
          description={t('clientUsers.canAdd.description', {
            defaultValue: "A POC can invite a new teammate from their own company into the client portal.",
          })}
          checked={settings.poc_can_add_users}
          onChange={checked => onChange({ poc_can_add_users: checked })}
        />
        <SettingsToggleRow
          label={t('clientUsers.canRemove.label', { defaultValue: 'Let POCs remove company users' })}
          description={t('clientUsers.canRemove.description', {
            defaultValue: "A POC can revoke another user from their own company's portal access.",
          })}
          checked={settings.poc_can_remove_users}
          onChange={checked => onChange({ poc_can_remove_users: checked })}
          isLast
        />
      </SectionCard>

      <SectionCard
        title={t('clientUsers.guardrailsTitle', { defaultValue: 'Always true, regardless of the toggles above' })}
      >
        {guardrails.map((text, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              gap: 8,
              padding: '8px 0',
              borderBottom: index === guardrails.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
              fontSize: 12.5,
            }}
          >
            <CheckOutlined style={{ color: token.colorTextTertiary, marginTop: 2 }} />
            <span style={{ color: token.colorTextSecondary }}>{text}</span>
          </div>
        ))}
      </SectionCard>
    </div>
  );
};

export default ClientUserManagementSection;
