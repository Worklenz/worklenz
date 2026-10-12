import { useEffect } from 'react';
import { Form, Input, Modal, Typography, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  CompanyUser,
  UpdateCompanyUserRequest,
  useUpdateCompanyUserMutation,
} from '@/api/client-portal/company-users-api';
import { getApiErrorMessage, isValidEmailAddress } from './company-users-helpers';

const { Text } = Typography;

interface EditCompanyUserModalProps {
  user: CompanyUser | null;
  open: boolean;
  onClose: () => void;
}

interface EditCompanyUserFormValues {
  name: string;
  email: string;
  job_title?: string;
  phone?: string;
}

/**
 * Edits who the person is (name, email, phone, job title). Their company and access role are
 * managed elsewhere, from the row menu, so they are not editable here.
 */
export const EditCompanyUserModal = ({ user, open, onClose }: EditCompanyUserModalProps) => {
  const { t } = useTranslation('client-portal-company-users');
  const [form] = Form.useForm<EditCompanyUserFormValues>();
  const [updateUser, { isLoading }] = useUpdateCompanyUserMutation();

  useEffect(() => {
    if (!open || !user) return;
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      job_title: user.job_title ?? '',
      phone: user.phone ?? '',
    });
  }, [open, user, form]);

  const handleSubmit = async () => {
    if (!user) return;

    let values: EditCompanyUserFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const data: UpdateCompanyUserRequest = {
      name: values.name.trim(),
      job_title: values.job_title?.trim() || null,
      phone: values.phone?.trim() || null,
    };

    // The email is the sign-in identity, so it is only sent while the person has no login yet.
    if (!user.has_login && values.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      data.email = values.email.trim();
    }

    try {
      await updateUser({ id: user.id, data }).unwrap();
      message.success(
        t('editUser.savedMessage', { name: data.name, defaultValue: '{{name}} updated.' })
      );
      onClose();
    } catch (error) {
      message.error(
        getApiErrorMessage(error) ||
          t('editUser.saveError', { defaultValue: 'Could not update this user.' })
      );
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={isLoading}
      destroyOnHidden
      width={440}
      title={t('editUser.title', { defaultValue: 'Edit user' })}
      okText={t('saveButton', { defaultValue: 'Save' })}
      cancelText={t('cancelButton', { defaultValue: 'Cancel' })}
    >
      <Form form={form} layout="vertical" requiredMark preserve={false}>
        <Form.Item
          name="name"
          label={t('editUser.nameLabel', { defaultValue: 'Full name' })}
          rules={[
            {
              required: true,
              whitespace: true,
              message: t('editUser.nameRequired', { defaultValue: 'Enter a name.' }),
            },
            {
              max: 255,
              message: t('editUser.nameTooLong', {
                defaultValue: 'The name can be at most 255 characters.',
              }),
            },
          ]}
        >
          <Input placeholder={t('editUser.namePlaceholder', { defaultValue: 'Jane Doe' })} />
        </Form.Item>

        <Form.Item
          name="email"
          label={t('editUser.emailLabel', { defaultValue: 'Email address' })}
          extra={
            user?.has_login
              ? t('editUser.emailLockedHint', {
                  defaultValue:
                    'This is their sign-in email, so it can’t be changed once they have portal access.',
                })
              : undefined
          }
          rules={[
            {
              required: true,
              message: t('editUser.emailRequired', { defaultValue: 'Enter an email address.' }),
            },
            {
              validator: async (_rule, value: string | undefined) => {
                if (!value || isValidEmailAddress(value)) return;
                throw new Error(
                  t('editUser.emailInvalid', { defaultValue: 'Enter a valid email address.' })
                );
              },
            },
          ]}
        >
          <Input
            type="email"
            disabled={user?.has_login}
            placeholder={t('editUser.emailPlaceholder', { defaultValue: 'jane@company.com' })}
          />
        </Form.Item>

        <Form.Item
          name="job_title"
          label={t('editUser.jobTitleLabel', { defaultValue: 'Job title' })}
          rules={[
            {
              max: 100,
              message: t('editUser.jobTitleTooLong', {
                defaultValue: 'The job title can be at most 100 characters.',
              }),
            },
          ]}
        >
          <Input
            placeholder={t('editUser.jobTitlePlaceholder', {
              defaultValue: 'e.g. Marketing Manager',
            })}
          />
        </Form.Item>

        <Form.Item
          name="phone"
          label={t('editUser.phoneLabel', { defaultValue: 'Phone number (optional)' })}
          rules={[
            {
              max: 50,
              message: t('editUser.phoneTooLong', {
                defaultValue: 'The phone number can be at most 50 characters.',
              }),
            },
          ]}
        >
          <Input
            type="tel"
            placeholder={t('editUser.phonePlaceholder', { defaultValue: '+1 415 555 0142' })}
          />
        </Form.Item>

        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('editUser.footerHint', {
            company: user?.company_name,
            defaultValue:
              'Company ({{company}}) and access role are managed separately, from the row menu.',
          })}
        </Text>
      </Form>
    </Modal>
  );
};
