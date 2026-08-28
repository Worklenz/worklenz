import { Form, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ICreateLinkBody } from '@/types/projects/project-links.types';
import { isValidHttpUrl, normalizeUrl } from '../utils';

interface AddLinkModalProps {
  open: boolean;
  loading: boolean;
  onSubmit: (values: ICreateLinkBody) => void;
  onCancel: () => void;
}

export const AddLinkModal: React.FC<AddLinkModalProps> = ({ open, loading, onSubmit, onCancel }) => {
  const { t } = useTranslation('project-view-files');
  const [form] = Form.useForm<ICreateLinkBody>();

  const handleOk = async () => {
    const values = await form.validateFields();
    onSubmit({ ...values, url: normalizeUrl(values.url) });
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={t('addLink', { defaultValue: 'Add Link' })}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText={t('addLink', { defaultValue: 'Add Link' })}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="title"
          label={t('linkTitle', { defaultValue: 'Title' })}
          rules={[{ required: true, message: t('linkTitleRequired', { defaultValue: 'Title is required' }) }]}
        >
          <Input placeholder={t('linkTitle', { defaultValue: 'Title' })} maxLength={255} />
        </Form.Item>
        <Form.Item
          name="url"
          label={t('linkUrl', { defaultValue: 'URL' })}
          rules={[
            { required: true, message: t('invalidUrl', { defaultValue: 'Please enter a valid URL' }) },
            {
              validator: (_, value) => {
                if (!value || isValidHttpUrl(value)) return Promise.resolve();
                return Promise.reject(t('invalidUrl', { defaultValue: 'Please enter a valid URL' }));
              },
            },
          ]}
        >
          <Input placeholder="https://example.com" />
        </Form.Item>
        <Form.Item
          name="description"
          label={t('linkDescription', { defaultValue: 'Description' })}
        >
          <Input.TextArea rows={3} maxLength={1000} placeholder={t('linkDescriptionPlaceholder', { defaultValue: 'Optional description' })} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
