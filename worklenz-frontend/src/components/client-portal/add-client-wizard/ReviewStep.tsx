import { Checkbox, Flex, Radio, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { InviteDelivery } from '@/api/client-portal/company-users-api';
import {
  PERMISSION_LEVELS,
  PERMISSION_TEMPLATES,
  PermissionTemplateKey,
} from '@/lib/client-portal/client-permissions';
import { ReviewSubject, WizardMethod, canDeferInvite } from './wizard-state';

const { Text } = Typography;

interface ReviewStepProps {
  method: WizardMethod;
  subject: ReviewSubject;
  /** The template chosen for a new company user, and how many projects it applies to. */
  template: PermissionTemplateKey | null;
  templateProjectCount: number;
  sendInvite: boolean;
  delivery: InviteDelivery;
  onSendInviteChange: (value: boolean) => void;
  onDeliveryChange: (value: InviteDelivery) => void;
}

/** The last step every method (except CSV) ends on: check who is being added, then choose delivery. */
export const ReviewStep = ({
  method,
  subject,
  template,
  templateProjectCount,
  sendInvite,
  delivery,
  onSendInviteChange,
  onDeliveryChange,
}: ReviewStepProps) => {
  const { t } = useTranslation('client-portal-add-client');
  const { t: tPermissions } = useTranslation('client-portal-company-users');
  const { token } = theme.useToken();

  const isInviting = canDeferInvite(method) ? sendInvite : true;
  const selectedTemplate = PERMISSION_TEMPLATES.find(item => item.key === template);
  const templateLevel = PERMISSION_LEVELS.find(level => level.key === selectedTemplate?.level);

  const rows: Array<{ key: string; label: string; value: string }> = [
    { key: 'name', label: t('review.name', { defaultValue: 'Name' }), value: subject.name },
    {
      key: 'company',
      label: t('review.company', { defaultValue: 'Company' }),
      value:
        subject.company ??
        (method === 'company'
          ? t('review.companyFromName', { defaultValue: 'Named after the person' })
          : '—'),
    },
    {
      key: 'email',
      label: t('review.email', { defaultValue: 'Email' }),
      value: subject.email || t('review.emailMissing', { defaultValue: 'not provided' }),
    },
  ];

  if (subject.role) {
    rows.push({
      key: 'role',
      label: t('review.role', { defaultValue: 'Role' }),
      value:
        method === 'company'
          ? t('review.rolePocDefault', { defaultValue: 'POC (default for a new company)' })
          : subject.role === 'poc'
            ? t('review.rolePoc', { defaultValue: 'POC' })
            : t('review.roleMember', { defaultValue: 'Client user' }),
    });
  }

  if (method === 'user') {
    rows.push({
      key: 'access',
      label: t('review.projectAccess', { defaultValue: 'Project access' }),
      value:
        selectedTemplate && templateLevel
          ? t('review.projectAccessTemplate', {
              template: tPermissions(selectedTemplate.nameKey, {
                defaultValue: selectedTemplate.nameDefault,
              }),
              count: templateProjectCount,
              defaultValue: '{{template}} on all {{count}} current projects',
            })
          : t('review.projectAccessNone', {
              defaultValue: 'None yet. Assign projects afterwards.',
            }),
    });
  }

  rows.push({
    key: 'auth',
    label: isInviting
      ? t('review.authentication', { defaultValue: 'Authentication' })
      : t('review.portalAccess', { defaultValue: 'Portal access' }),
    value: isInviting
      ? t('review.authInvitation', {
          defaultValue: 'Invitation link. They set a password on first sign-in.',
        })
      : t('review.notInvited', {
          defaultValue: 'Not invited yet. Invite them later from the table.',
        }),
  });

  return (
    <Flex vertical gap={16}>
      <div
        style={{
          padding: '4px 16px',
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {rows.map((row, index) => (
          <Flex
            key={row.key}
            justify="space-between"
            gap={16}
            style={{
              padding: '10px 0',
              borderTop: index === 0 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Text type="secondary">{row.label}</Text>
            <Text strong style={{ textAlign: 'end', wordBreak: 'break-word' }}>
              {row.value}
            </Text>
          </Flex>
        ))}
      </div>

      {canDeferInvite(method) && (
        <Checkbox checked={sendInvite} onChange={event => onSendInviteChange(event.target.checked)}>
          <Flex vertical>
            <Text strong>{t('review.sendNow', { defaultValue: 'Send portal invite now' })}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('review.sendNowHint', {
                defaultValue:
                  'Leave unchecked to add the record without sending anything. Invite them later from the table.',
              })}
            </Text>
          </Flex>
        </Checkbox>
      )}

      {isInviting && (
        <div>
          <Text
            type="secondary"
            strong
            style={{ display: 'block', marginBottom: 8, fontSize: 11, letterSpacing: 0.6 }}
          >
            {t('review.deliverVia', { defaultValue: 'DELIVER VIA' })}
          </Text>
          <Radio.Group
            value={delivery}
            onChange={event => onDeliveryChange(event.target.value as InviteDelivery)}
            optionType="button"
            buttonStyle="solid"
            aria-label={t('review.deliverVia', { defaultValue: 'DELIVER VIA' })}
          >
            <Radio.Button value="email">
              {t('review.deliveryEmail', { defaultValue: 'Email invitation link' })}
            </Radio.Button>
            <Radio.Button value="link">
              {t('review.deliveryLink', { defaultValue: 'Copy invitation link' })}
            </Radio.Button>
          </Radio.Group>
        </div>
      )}
    </Flex>
  );
};
