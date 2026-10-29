import React, { useEffect } from 'react';
import { Button, Card, Col, Form, Input, Row, Skeleton, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import { useUpdateMeMutation } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { errorMessage, useRoleLabel } from '@/components/v2';
import type { ClientCapabilities } from '@/types/v2';

const CAPABILITY_ROWS: Array<{ key: 'view' | keyof ClientCapabilities; label: string }> = [
  { key: 'view', label: 'View assigned projects, milestones, tasks and files' },
  { key: 'comment', label: 'Comment and reply in discussions' },
  { key: 'upload', label: 'Upload files (where the project allows it)' },
  { key: 'submitChangeRequest', label: 'Submit and follow change requests' },
  { key: 'approve', label: 'Approve items or request changes' },
  { key: 'manageUsers', label: 'Manage users in your organization' },
];

const ROLE_SUMMARIES = {
  admin:
    'You can view your projects, comment, upload files, submit change requests and approve items. You can manage colleagues if your account manager enables it.',
  member:
    'You can view your projects, comment, upload files and submit change requests. Approvals are made by a Client Admin.',
  viewer: 'You have read-only access to project information, milestones, tasks and files.',
} as const;

interface ProfileValues {
  name: string;
  job_title: string;
}

const normalizeProfileValues = (values: {
  name?: string | null;
  job_title?: string | null;
}): ProfileValues => ({
  name: (values.name ?? '').trim(),
  job_title: (values.job_title ?? '').trim(),
});

/** Name and job title. The email is the sign-in address and can't be changed here. */
const ProfileSettings: React.FC = () => {
  const { t } = useTranslation();
  const message = useMessage();
  const { me, isLoading, role, can } = useClientAccess();
  const roleLabel = useRoleLabel();
  const { token } = theme.useToken();
  const [updateMe, { isLoading: saving }] = useUpdateMeMutation();
  const [form] = Form.useForm<ProfileValues>();
  const currentName = Form.useWatch('name', form);
  const currentJobTitle = Form.useWatch('job_title', form);

  useEffect(() => {
    if (me) form.setFieldsValue({ name: me.name, job_title: me.jobTitle });
  }, [me, form]);

  if (isLoading || !me) return <Card><Skeleton active /></Card>;

  const originalValues = normalizeProfileValues({
    name: me.name,
    job_title: me.jobTitle,
  });

  const currentValues = normalizeProfileValues({
    name: currentName,
    job_title: currentJobTitle,
  });

  const hasChanges =
    currentValues.name !== originalValues.name ||
    currentValues.job_title !== originalValues.job_title;

  const onFinish = async (values: ProfileValues) => {
    const updatedValues = normalizeProfileValues(values);

    if (
      updatedValues.name === originalValues.name &&
      updatedValues.job_title === originalValues.job_title
    ) {
      return;
    }

    try {
      await updateMe({
        name: updatedValues.name,
        job_title: updatedValues.job_title,
      }).unwrap();

      void message.success(
        t('settings.profile.saved', { defaultValue: 'Profile saved.' })
      );
    } catch (error) {
      void message.error(
        errorMessage(error) ??
        t('settings.saveFailed', {
          defaultValue: 'We could not save your changes. Please try again.',
        })
      );
    }
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={14}>
        <Card title={t('settings.nav.profile', { defaultValue: 'Profile' })}>
          <Form form={form} layout="vertical" style={{ maxWidth: 420 }} onFinish={onFinish} requiredMark>
            <Form.Item
              name="name"
              label={t('settings.profile.name', { defaultValue: 'Full name' })}
              rules={[{ required: true, whitespace: true, message: t('settings.profile.nameRequired', { defaultValue: 'Enter your name' }) }]}
            >
              <Input maxLength={100} autoComplete="name" />
            </Form.Item>
            <Form.Item label={t('settings.profile.email', { defaultValue: 'Email' })}>
              <Input value={me.email} disabled aria-label={t('settings.profile.email', { defaultValue: 'Email' })} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('settings.profile.emailHint', { defaultValue: 'Your sign-in address. Contact your project contact to change it.' })}
              </Typography.Text>
            </Form.Item>
            <Form.Item name="job_title" label={t('settings.profile.jobTitle', { defaultValue: 'Job title' })}>
              <Input maxLength={100} autoComplete="organization-title" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              disabled={!hasChanges || saving}
            >
              {t('settings.saveChanges', { defaultValue: 'Save changes' })}
            </Button>
          </Form>
        </Card>
      </Col>
      {role && (
        <Col xs={24} lg={10}>
          <Card title={t('account.org.yourRole', { role: roleLabel(role), defaultValue: 'Your role: {{role}}' })}>
            <Typography.Paragraph type="secondary">
              {t(`account.org.roleSummary.${role}`, { defaultValue: ROLE_SUMMARIES[role] })}
            </Typography.Paragraph>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {CAPABILITY_ROWS.map(row => {
                const allowed = row.key === 'view' ? true : can[row.key];
                return (
                  <li key={row.key} style={{ display: 'flex', gap: 8, padding: '4px 0', opacity: allowed ? 1 : 0.5 }}>
                    <span aria-hidden style={{ width: 14, color: allowed ? token.colorSuccess : undefined }}>{allowed ? '✓' : '—'}</span>
                    <span>
                      {t(`account.org.capability.${row.key}`, { defaultValue: row.label })}
                      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                        {allowed
                          ? ` (${t('account.org.allowed', { defaultValue: 'allowed' })})`
                          : ` (${t('account.org.notAllowed', { defaultValue: 'not allowed' })})`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Col>
      )}
    </Row>
  );
};

export default ProfileSettings;
