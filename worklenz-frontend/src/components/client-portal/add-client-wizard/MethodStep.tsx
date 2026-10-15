import React from 'react';
import { useTranslation } from 'react-i18next';
import { BankOutlined, UserAddOutlined } from '@ant-design/icons';
import { Typography, theme } from '@/shared/antd-imports';
import type { WizardMethod } from './wizard-state';

interface MethodStepProps {
  method: WizardMethod | null;
  onSelect: (method: WizardMethod) => void;
}

const METHODS: {
  method: WizardMethod;
  icon: React.ReactNode;
  nameKey: string;
  nameDefault: string;
  descKey: string;
  descDefault: string;
}[] = [
  {
    method: 'new_organization',
    icon: <BankOutlined />,
    nameKey: 'method.newOrganization.name',
    nameDefault: 'New client organization',
    descKey: 'method.newOrganization.description',
    descDefault: 'Create the organization and invite its first user as Client Admin.',
  },
  {
    method: 'existing_organization',
    icon: <UserAddOutlined />,
    nameKey: 'method.existingOrganization.name',
    nameDefault: 'Add a user to an existing organization',
    descKey: 'method.existingOrganization.description',
    descDefault: 'Invite another person to an organization that already has portal access.',
  },
];

export const MethodStep = ({ method, onSelect }: MethodStepProps) => {
  const { t } = useTranslation('client-portal-v2-add-client');
  const { token } = theme.useToken();

  return (
    <div role="radiogroup" aria-label={t('method.groupLabel', { defaultValue: 'How to add this client' })}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12.5 }}>
        {t('method.intro', {
          defaultValue: 'Every client user belongs to an organization, and sees only the projects you assign to them.',
        })}
      </Typography.Paragraph>
      {METHODS.map(item => {
        const selected = method === item.method;
        return (
          <button
            key={item.method}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(item.method)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              width: '100%',
              textAlign: 'left',
              padding: '12px 14px',
              marginBottom: 10,
              cursor: 'pointer',
              color: token.colorText,
              background: selected ? token.colorPrimaryBg : token.colorBgContainer,
              border: `1px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 18, color: selected ? token.colorPrimary : token.colorTextSecondary }}>
              {item.icon}
            </span>
            <span>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13.5 }}>
                {t(item.nameKey, { defaultValue: item.nameDefault })}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: token.colorTextSecondary }}>
                {t(item.descKey, { defaultValue: item.descDefault })}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
