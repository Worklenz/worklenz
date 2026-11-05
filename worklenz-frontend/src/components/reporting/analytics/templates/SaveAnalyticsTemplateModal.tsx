import React, { useEffect, useState } from 'react';
import { Checkbox, Form, Input, Modal } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { TEMPLATE_NAME_MAX_LENGTH } from '@/lib/reporting/analytics-constants';

export interface SaveAnalyticsTemplateValues {
  name: string;
  is_workspace_shared: boolean;
  is_default: boolean;
}

interface SaveAnalyticsTemplateModalProps {
  open: boolean;
  canShare: boolean;
  confirmLoading?: boolean;
  namePlaceholder?: string;
  onCancel: () => void;
  onSave: (values: SaveAnalyticsTemplateValues) => void;
}

export const SaveAnalyticsTemplateModal: React.FC<SaveAnalyticsTemplateModalProps> = ({
  open,
  canShare,
  confirmLoading,
  namePlaceholder,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        name: '',
        is_workspace_shared: false,
        is_default: false,
      });
    }
  }, [open, form]);

  const handleOk = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();
      onSave({
        name: String(values.name).trim(),
        is_workspace_shared: !!values.is_workspace_shared,
        is_default: !!values.is_default,
      });
    } catch {
      // validation errors stay on form
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('saveAsTemplate', { defaultValue: 'Save as Template' })}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={confirmLoading || submitting}
      destroyOnClose
      okText={t('saveTemplate', { defaultValue: 'Save' })}
      cancelText={t('cancel', { defaultValue: 'Cancel' })}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="name"
          label={t('templateName', { defaultValue: 'Template name' })}
          rules={[
            {
              required: true,
              message: t('templateNameRequired', {
                defaultValue: 'Enter a template name',
              }),
            },
            {
              max: TEMPLATE_NAME_MAX_LENGTH,
              message: t('templateNameTooLong', {
                defaultValue: 'Name must be at most {{max}} characters',
                max: TEMPLATE_NAME_MAX_LENGTH,
              }),
            },
          ]}
        >
          <Input
            maxLength={TEMPLATE_NAME_MAX_LENGTH}
            placeholder={
              namePlaceholder ??
              t('templateNamePlaceholder', {
                defaultValue: 'e.g. My team velocity',
              })
            }
          />
        </Form.Item>
        <Form.Item name="is_default" valuePropName="checked">
          <Checkbox>{t('setAsDefault', { defaultValue: 'Set as my default' })}</Checkbox>
        </Form.Item>
        {canShare && (
          <Form.Item name="is_workspace_shared" valuePropName="checked">
            <Checkbox>
              {t('shareWithWorkspace', { defaultValue: 'Share with workspace' })}
            </Checkbox>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};
