import { Checkbox, Flex, Form, Input, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { PersonFieldsForm } from './PersonFieldsForm';
import type { NewClientFields } from './wizard-state';

const { Text } = Typography;

interface NewClientStepProps {
  value: NewClientFields;
  onChange: (patch: Partial<NewClientFields>) => void;
}

/** Step 2 of "New client": the company and its first contact, who becomes its POC. */
export const NewClientStep = ({ value, onChange }: NewClientStepProps) => {
  const { t } = useTranslation('client-portal-add-client');
  const { token } = theme.useToken();

  return (
    <Flex vertical gap={8}>
      <Form layout="vertical" requiredMark={false}>
        <Form.Item
          label={t('newClient.companyName', { defaultValue: 'Company name' })}
          htmlFor="add-client-company-name"
          extra={t('newClient.companyNameHint', {
            defaultValue: 'Leave empty to name the client after the person below.',
          })}
        >
          <Input
            id="add-client-company-name"
            value={value.companyName}
            maxLength={60}
            autoComplete="off"
            placeholder={t('newClient.companyNamePlaceholder', {
              defaultValue: 'e.g. Beacon Logistics',
            })}
            onChange={event => onChange({ companyName: event.target.value })}
          />
        </Form.Item>
      </Form>

      <PersonFieldsForm idPrefix="add-client" value={value} onChange={onChange} />

      <div>
        <Text
          type="secondary"
          strong
          style={{ display: 'block', marginBottom: 8, fontSize: 11, letterSpacing: 0.6 }}
        >
          {t('newClient.setupTitle', { defaultValue: 'SET UP THEIR PORTAL' })}
        </Text>
        <Checkbox
          checked={value.welcomeMessage}
          onChange={event => onChange({ welcomeMessage: event.target.checked })}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
            alignItems: 'flex-start',
          }}
        >
          <Flex vertical>
            <Text strong>
              {t('newClient.welcomeMessage', { defaultValue: 'Send a welcome message' })}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('newClient.welcomeMessageHint', {
                defaultValue: 'Posted to Messages, so it is waiting for them when they sign in.',
              })}
            </Text>
          </Flex>
        </Checkbox>
      </div>
    </Flex>
  );
};
