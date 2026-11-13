import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Form, Input, Modal, Typography, message } from '@/shared/antd-imports';
import { useUpdatePortalClientUserMutation } from '@/api/client-portal/portal-access-api';
import { getPortalErrorCode, getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { ConfirmEffectModal, ROLE_LABEL_COPY, RoleCards } from '@/components/client-portal/v2';
import type { ClientRole, ClientUser } from '@/types/client-portal/v2';

interface EditClientUserModalProps {
  user: ClientUser | null;
  onClose: () => void;
}

interface EditFormValues {
  name: string;
  job_title: string;
  email: string;
  phone: string;
}

type WarningCode = 'LAST_CLIENT_ADMIN' | 'PENDING_APPROVALS';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Name, contact details and role for one client user. A role change applies on the user's next request. */
export const EditClientUserModal = ({ user, onClose }: EditClientUserModalProps) => {
  const { t } = useTranslation('client-portal-v2-clients');
  const { t: tShared } = useTranslation('client-portal-v2');
  const [form] = Form.useForm<EditFormValues>();
  const [role, setRole] = useState<ClientRole>(user?.role ?? 'member');
  const [warning, setWarning] = useState<{ code: WarningCode; message: string } | null>(null);
  const [confirmedCodes, setConfirmedCodes] = useState<WarningCode[]>([]);
  const [updateUser, { isLoading }] = useUpdatePortalClientUserMutation();

  if (!user) return null;

  const roleChanged = role !== user.role;

  /** Saves the user. Each server warning is overridden only after the user confirmed that very warning. */
  const save = async (confirmCode?: WarningCode) => {
    const confirmed = confirmCode ? [...new Set([...confirmedCodes, confirmCode])] : confirmedCodes;
    setConfirmedCodes(confirmed);
    const values = await form.validateFields();
    try {
      await updateUser({
        userId: user.id,
        body: {
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim() || null,
          job_title: values.job_title.trim() || null,
          role,
          confirm_last_admin: confirmed.includes('LAST_CLIENT_ADMIN') || undefined,
          confirm_pending_approvals: confirmed.includes('PENDING_APPROVALS') || undefined,
        },
      }).unwrap();

      if (roleChanged) {
        message.success(
          t('edit.roleChanged', {
            name: values.name.trim(),
            role: tShared(ROLE_LABEL_COPY[role].key, { defaultValue: ROLE_LABEL_COPY[role].defaultValue }),
            defaultValue:
              '{{name}} is now a {{role}}. It applies on their next request, not only after a new sign-in.',
          })
        );
      } else {
        message.success(t('edit.updated', { name: values.name.trim(), defaultValue: '{{name}} updated.' }));
      }
      setWarning(null);
      setConfirmedCodes([]);
      onClose();
    } catch (error) {
      const code = getPortalErrorCode(error);
      if (code === 'LAST_CLIENT_ADMIN' || code === 'PENDING_APPROVALS') {
        setWarning({ code, message: getPortalErrorMessage(error, '') });
        return;
      }
      message.error(
        getPortalErrorMessage(error, t('edit.failed', { defaultValue: 'The user could not be updated.' }))
      );
    }
  };

  return (
    <>
      <Modal
        open
        title={t('edit.title', { organization: user.organization_name, defaultValue: 'Edit user · {{organization}}' })}
        okText={t('edit.save', { defaultValue: 'Save' })}
        cancelText={tShared('cancel', { defaultValue: 'Cancel' })}
        onOk={() => void save()}
        onCancel={() => {
          setConfirmedCodes([]);
          onClose();
        }}
        okButtonProps={{ loading: isLoading }}
        maskClosable={!isLoading}
        width={520}
        destroyOnHidden
      >
        <Form<EditFormValues>
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{
            name: user.name,
            job_title: user.job_title ?? '',
            email: user.email,
            phone: user.phone ?? '',
          }}
        >
          <Form.Item
            name="name"
            label={t('fields.name', { defaultValue: 'Full name' })}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t('fields.nameRequired', { defaultValue: 'Enter the user’s name.' }),
              },
            ]}
          >
            <Input autoComplete="off" maxLength={150} />
          </Form.Item>
          <Form.Item name="job_title" label={t('fields.jobTitle', { defaultValue: 'Job title' })}>
            <Input autoComplete="off" maxLength={150} />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('fields.email', { defaultValue: 'Email (login address)' })}
            rules={[
              {
                required: true,
                message: t('fields.emailRequired', { defaultValue: 'Enter the user’s email address.' }),
              },
              {
                validator: (_rule, value: string | undefined) =>
                  !value || EMAIL_PATTERN.test(value.trim())
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(t('fields.emailInvalid', { defaultValue: 'Enter a valid email address.' }))
                      ),
              },
            ]}
          >
            <Input type="email" autoComplete="off" />
          </Form.Item>
          <Form.Item name="phone" label={t('fields.phone', { defaultValue: 'Phone (optional)' })}>
            <Input autoComplete="off" maxLength={40} />
          </Form.Item>
        </Form>

        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
          {t('fields.role', { defaultValue: 'Role' })}
        </Typography.Text>
        <RoleCards value={role} onChange={setRole} />
        {roleChanged && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message={t('edit.roleNotice', {
              defaultValue:
                'Role changes take effect on the user’s next authorization check, not only after a new sign-in.',
            })}
          />
        )}
      </Modal>

      <ConfirmEffectModal
        open={warning !== null}
        danger
        title={
          warning?.code === 'PENDING_APPROVALS'
            ? t('lastAdmin.pendingApprovalsTitle', { defaultValue: 'This leaves an approval without an approver' })
            : t('lastAdmin.title', { defaultValue: 'This is the last Client Admin' })
        }
        confirmLabel={t('lastAdmin.confirm', { defaultValue: 'Continue anyway' })}
        loading={isLoading}
        onClose={() => {
          setWarning(null);
          setConfirmedCodes([]);
        }}
        onConfirm={() => warning && void save(warning.code)}
      >
        {warning?.message}
      </ConfirmEffectModal>
    </>
  );
};
