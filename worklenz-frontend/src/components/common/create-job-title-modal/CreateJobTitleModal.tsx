import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Input, message, Modal, theme } from '@/shared/antd-imports';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import { IJobTitle } from '@/types/job.types';
import logger from '@/utils/errorLogger';

export interface CreateJobTitleModalProps {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onCancel?: () => void;
  onSuccess: (newJobTitle: IJobTitle) => void;
}

export const CreateJobTitleModal: React.FC<CreateJobTitleModalProps> = ({
  open,
  initialName = '',
  onClose,
  onCancel,
  onSuccess,
}) => {
  const { t } = useTranslation('settings/job-titles');
  const [form] = Form.useForm<{ name: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ name: initialName?.trim() || '' });
    } else {
      form.resetFields();
    }
  }, [open, initialName, form]);

  const handleFinish = async (values: { name: string }) => {
    const trimmedName = values.name.trim();
    if (!trimmedName) return;

    try {
      setIsSubmitting(true);
      const response = await jobTitlesApiService.createJobTitle({ name: trimmedName });

      if (response.done && response.body) {
        message.success(
          t('createJobTitleSuccessMessage', { defaultValue: 'Create job title success!' })
        );
        form.resetFields();
        onSuccess(response.body);
        onClose();
      } else {
        message.error(
          response.message ||
            t('createJobTitleErrorMessage', { defaultValue: 'Create job title failed!' })
        );
      }
    } catch (error) {
      logger.error('Failed to create job title:', error);
      message.error(
        t('createJobTitleErrorMessage', { defaultValue: 'Create job title failed!' })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel?.();
    onClose();
  };

  return (
    <Modal
      title={t('createJobTitleDrawerTitle', { defaultValue: 'Create Job Title' })}
      open={open}
      onCancel={handleCancel}
      width={400}
      destroyOnClose
      footer={null}
      styles={{
        header: {
          marginBottom: 16,
        },
      }}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="name"
          label={t('nameLabel', { defaultValue: 'Name' })}
          rules={[
            {
              required: true,
              whitespace: true,
              message: t('nameRequiredError', { defaultValue: 'Please enter a Name' }),
            },
          ]}
        >
          <Input
            placeholder={t('namePlaceholder', { defaultValue: 'Name' })}
            autoFocus
            maxLength={100}
          />
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <Button onClick={handleCancel} disabled={isSubmitting}>
            {t('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button type="primary" htmlType="submit" loading={isSubmitting}>
            {t('createButton', { defaultValue: 'Create' })}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default CreateJobTitleModal;
