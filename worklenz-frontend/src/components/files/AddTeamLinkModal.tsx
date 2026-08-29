import React, { useEffect } from 'react';
import { Modal, Form, Input, Select } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useGetProjectsQuery } from '@/api/projects/projects.v1.api.service';
import { isValidHttpUrl, normalizeUrl } from '@/pages/projects/projectView/files/utils';
import type { ICreateLinkBody, IUpdateLinkBody } from '@/types/projects/project-links.types';
import type { ITeamProjectLinkRow } from '@/api/files/team-files.api.service';

interface LinkFormValues {
  projectId?: string;
  title: string;
  url: string;
  description?: string;
}

interface AddTeamLinkModalProps {
  open: boolean;
  loading: boolean;
  editingLink: ITeamProjectLinkRow | null;
  onSubmitAdd: (projectId: string, values: ICreateLinkBody) => void;
  onSubmitEdit: (projectId: string, linkId: string, values: IUpdateLinkBody) => void;
  onCancel: () => void;
}

export const AddTeamLinkModal: React.FC<AddTeamLinkModalProps> = ({
  open,
  loading,
  editingLink,
  onSubmitAdd,
  onSubmitEdit,
  onCancel,
}) => {
  const { t } = useTranslation('team-files');
  const [form] = Form.useForm<LinkFormValues>();
  const isEdit = !!editingLink;

  const { data: projectsData } = useGetProjectsQuery({
    index: 1,
    size: 200,
    field: 'name',
    order: 'asc',
    search: '',
    filter: null,
    statuses: '',
    categories: '',
    priorities: '',
  });

  useEffect(() => {
    if (open) {
      if (editingLink) {
        form.setFieldsValue({
          projectId: editingLink.project_id,
          title: editingLink.title,
          url: editingLink.url,
          description: editingLink.description,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editingLink, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const body = { title: values.title, url: normalizeUrl(values.url), description: values.description };
    if (isEdit && editingLink) {
      onSubmitEdit(editingLink.project_id, editingLink.id, body);
    } else if (values.projectId) {
      onSubmitAdd(values.projectId, body);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={isEdit ? t('editLink', { defaultValue: 'Edit Link' }) : t('addLink', { defaultValue: 'Add Link' })}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText={isEdit ? t('save', { defaultValue: 'Save' }) : t('addLink', { defaultValue: 'Add Link' })}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        {!isEdit && (
          <Form.Item
            name="projectId"
            label={t('selectProjectLabel', { defaultValue: 'Project' })}
            rules={[{ required: true, message: t('selectProjectFirst', { defaultValue: 'Please select a project.' }) }]}
          >
            <Select
              showSearch
              placeholder={t('selectProjectPlaceholder', { defaultValue: 'Select a project' })}
              filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              options={(projectsData?.body?.data || []).map(p => ({ value: p.id as string, label: p.name as string }))}
            />
          </Form.Item>
        )}
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
        <Form.Item name="description" label={t('linkDescription', { defaultValue: 'Description' })}>
          <Input.TextArea
            rows={3}
            maxLength={1000}
            placeholder={t('linkDescriptionPlaceholder', { defaultValue: 'Optional description' })}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
