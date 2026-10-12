import type { ReactNode } from 'react';
import { BankOutlined, MailOutlined, UploadOutlined, UserAddOutlined } from '@ant-design/icons';
import { Flex, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { WizardMethod } from './wizard-state';

const { Text } = Typography;

interface MethodStepProps {
  method: WizardMethod | null;
  onSelect: (method: WizardMethod) => void;
}

interface MethodOption {
  key: WizardMethod;
  icon: ReactNode;
  nameDefault: string;
  descriptionDefault: string;
}

const METHOD_OPTIONS: MethodOption[] = [
  {
    key: 'company',
    icon: <BankOutlined />,
    nameDefault: 'New client',
    descriptionDefault: 'Create a company record and its first contact together.',
  },
  {
    key: 'user',
    icon: <UserAddOutlined />,
    nameDefault: 'Add a client user',
    descriptionDefault: 'Add another contact to a company that already exists.',
  },
  {
    key: 'existing',
    icon: <MailOutlined />,
    nameDefault: 'Invite an existing contact',
    descriptionDefault: 'Already a lead or client? Just send portal access.',
  },
  {
    key: 'csv',
    icon: <UploadOutlined />,
    nameDefault: 'Import from CSV',
    descriptionDefault: 'Bulk add clients from a spreadsheet.',
  },
];

/** Step 1: how the client is being added. */
export const MethodStep = ({ method, onSelect }: MethodStepProps) => {
  const { t } = useTranslation('client-portal-add-client');
  const { token } = theme.useToken();

  return (
    <Flex vertical gap={12}>
      <Text type="secondary">
        {t('method.helper', {
          defaultValue: 'Every path ends the same way. Pick whichever fits what you already know.',
        })}
      </Text>

      <div
        role="radiogroup"
        aria-label={t('method.groupLabel', { defaultValue: 'How do you want to add this client?' })}
        style={{ display: 'grid', gap: 10 }}
      >
        {METHOD_OPTIONS.map(option => {
          const isSelected = method === option.key;

          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(option.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '12px 14px',
                textAlign: 'start',
                cursor: 'pointer',
                color: token.colorText,
                borderRadius: token.borderRadiusLG,
                border: `1px solid ${isSelected ? token.colorPrimary : token.colorBorderSecondary}`,
                background: isSelected ? token.colorPrimaryBg : token.colorBgContainer,
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  fontSize: 18,
                  borderRadius: token.borderRadius,
                  color: token.colorPrimary,
                  background: token.colorFillTertiary,
                }}
              >
                {option.icon}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Text strong>
                  {t(`method.${option.key}.name`, { defaultValue: option.nameDefault })}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t(`method.${option.key}.description`, {
                    defaultValue: option.descriptionDefault,
                  })}
                </Text>
              </span>
            </button>
          );
        })}
      </div>
    </Flex>
  );
};
