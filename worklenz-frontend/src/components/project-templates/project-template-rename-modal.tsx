import React, { useState } from 'react';
import { Modal, Input, Form, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { projectTemplatesApiService } from '@/api/project-templates/project-templates.api.service';

interface ProjectTemplateRenameModalProps {
  visible: boolean;
  templateId: string | null;
  currentName: string;
  onClose: (renamed: boolean) => void;
}

export const ProjectTemplateRenameModal: React.FC<ProjectTemplateRenameModalProps> = ({
  visible,
  templateId,
  currentName,
  onClose,
}) => {
  const { t } = useTranslation('settings/project-templates');
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setName(currentName);
  }, [currentName, visible]);

  const handleOk = async () => {
    if (!templateId) return;
    if (!name.trim()) {
      message.error(t('nameRequired'));
      return;
    }
    setLoading(true);
    try {
      await projectTemplatesApiService.renameCustomTemplate(templateId, name.trim());
      onClose(true);
    } catch (error) {
      message.error(t('renameError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('renameTemplate')}
      open={visible}
      onOk={handleOk}
      onCancel={() => onClose(false)}
      confirmLoading={loading}
      okText={t('okText')}
      cancelText={t('cancelText')}
      destroyOnHidden
    >
      <Form layout="vertical">
        <Form.Item
          label={t('templateName')}
          required
          rules={[{ required: true, message: t('nameRequired') }]}
        >
          <Input value={name} onChange={e => setName(e.target.value)} maxLength={100} autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
};
