import React, { useState } from 'react';
import { Button, Flex, Form, Input, Modal, Popconfirm, Table, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, LinkOutlined, ArrowRightOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { durationDateFormat } from '@utils/durationDateFormat';
import { AddLinkModal } from './AddLinkModal';
import { isValidHttpUrl, normalizeUrl } from '../utils';
import { useProjectLinks } from '../hooks/useProjectLinks';
import type { ICreateLinkBody, IProjectLink, IUpdateLinkBody } from '@/types/projects/project-links.types';
import { colors } from '@/styles/colors';

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

interface EditLinkModalProps {
  link: IProjectLink | null;
  open: boolean;
  loading: boolean;
  onSubmit: (values: IUpdateLinkBody) => void;
  onCancel: () => void;
}

const EditLinkModal: React.FC<EditLinkModalProps> = ({ link, open, loading, onSubmit, onCancel }) => {
  const { t } = useTranslation('project-view-files');
  const [form] = Form.useForm<IUpdateLinkBody>();

  React.useEffect(() => {
    if (open && link) {
      form.setFieldsValue({ title: link.title, url: link.url, description: link.description });
    }
  }, [open, link, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onSubmit({ ...values, url: normalizeUrl(values.url) });
  };

  return (
    <Modal
      title={t('editLink', { defaultValue: 'Edit Link' })}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="title"
          label={t('linkTitle', { defaultValue: 'Title' })}
          rules={[{ required: true, message: t('linkTitleRequired', { defaultValue: 'Title is required' }) }]}
        >
          <Input maxLength={255} />
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
          <Input.TextArea rows={3} maxLength={1000} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

interface ProjectLinksTabProps {
  active: boolean;
  addModalOpen: boolean;
  onAddModalOpenChange: (open: boolean) => void;
}

export const ProjectLinksTab: React.FC<ProjectLinksTabProps> = ({
  active,
  addModalOpen,
  onAddModalOpenChange,
}) => {
  const { t } = useTranslation('project-view-files');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { projectId } = useAppSelector(state => state.projectReducer);

  const { links, loading, total, pageIndex, pageSize, setPageIndex, addLink, editLink, removeLink } =
    useProjectLinks(active);

  const [addLoading, setAddLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingLink, setEditingLink] = useState<IProjectLink | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async (values: ICreateLinkBody) => {
    setAddLoading(true);
    const ok = await addLink(values);
    setAddLoading(false);
    if (ok) onAddModalOpenChange(false);
  };

  const handleEditOpen = (link: IProjectLink) => {
    setEditingLink(link);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (values: IUpdateLinkBody) => {
    if (!editingLink) return;
    setEditLoading(true);
    const ok = await editLink(editingLink.id, values);
    setEditLoading(false);
    if (ok) {
      setEditModalOpen(false);
      setEditingLink(null);
    }
  };

  const handleDelete = async (linkId: string) => {
    setDeletingId(linkId);
    await removeLink(linkId);
    setDeletingId(null);
  };

  const handleOpenTaskDrawer = (taskId: string) => {
    dispatch(setSelectedTaskId(taskId));
    dispatch(setShowTaskDrawer(true));
  };

  const handleRowClick = (record: IProjectLink) => {
    if (record.source_type === 'manual') {
      window.open(record.url, '_blank', 'noopener,noreferrer');
    } else if (record.source_task_id && projectId) {
      navigate(`/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list&task=${record.source_task_id}`);
    }
  };

  const columns: TableProps<IProjectLink>['columns'] = [
    {
      key: 'title',
      title: t('linkTitle', { defaultValue: 'Title' }),
      dataIndex: 'title',
      render: (title: string, record) => (
        <Typography.Link onClick={() => handleRowClick(record)} style={{ cursor: 'pointer' }}>
          {title}
        </Typography.Link>
      ),
    },
    {
      key: 'source',
      title: t('linkSource', { defaultValue: 'Source' }),
      width: 220,
      render: (_: unknown, record) => {
        if (record.source_type !== 'manual') {
          return (
            <Tag color="blue">
              {t('fromTask', { defaultValue: 'From: {{taskName}}', taskName: record.source_task_name || record.source_task_key || 'Task' })}
            </Tag>
          );
        }
        const domain = getDomain(record.url);
        return (
          <Flex align="center" gap={6}>
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
              alt=""
              width={16}
              height={16}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <Typography.Text type="secondary">{domain}</Typography.Text>
          </Flex>
        );
      },
    },
    {
      key: 'description',
      title: t('linkDescription', { defaultValue: 'Description' }),
      dataIndex: 'description',
      render: (desc: string | undefined) => (
        <Typography.Text type="secondary">{desc || '—'}</Typography.Text>
      ),
    },
    {
      key: 'added_by_name',
      title: t('linkAddedBy', { defaultValue: 'Added By' }),
      dataIndex: 'added_by_name',
      width: 160,
      render: (name: string | undefined) => (
        <Typography.Text>{name || '—'}</Typography.Text>
      ),
    },
    {
      key: 'created_at',
      title: t('linkAddedOn', { defaultValue: 'Added On' }),
      dataIndex: 'created_at',
      width: 140,
      render: (date: string) => (
        <Tooltip title={date}>
          <Typography.Text>{durationDateFormat(date)}</Typography.Text>
        </Tooltip>
      ),
    },
    {
      key: 'updated_at',
      title: t('linkLastModified', { defaultValue: 'Last Modified' }),
      dataIndex: 'updated_at',
      width: 140,
      render: (date: string) => (
        <Tooltip title={date}>
          <Typography.Text>{durationDateFormat(date)}</Typography.Text>
        </Tooltip>
      ),
    },
    {
      key: 'actions',
      title: t('actionsColumn', { defaultValue: 'Actions' }),
      width: 120,
      render: (_: unknown, record) => {
        if (record.source_type === 'manual') {
          return (
            <Flex gap={8} align="center">
              <Tooltip title={t('editLink', { defaultValue: 'Edit link' })}>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={e => { e.stopPropagation(); handleEditOpen(record); }}
                />
              </Tooltip>
              <Popconfirm
                title={t('deleteConfirmationTitle', { defaultValue: 'Are you sure?' })}
                okText={t('deleteConfirmationOk', { defaultValue: 'Yes' })}
                cancelText={t('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
                icon={<DeleteOutlined style={{ color: colors.vibrantOrange }} />}
                onConfirm={e => { e?.stopPropagation(); void handleDelete(record.id); }}
              >
                <Tooltip title={t('deleteLink', { defaultValue: 'Delete link' })}>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deletingId === record.id}
                    onClick={e => e.stopPropagation()}
                  />
                </Tooltip>
              </Popconfirm>
            </Flex>
          );
        }
        if (record.source_task_id) {
          return (
            <Tooltip title={t('openTask', { defaultValue: 'Open task' })}>
              <Button
                size="small"
                icon={<ArrowRightOutlined />}
                onClick={e => { e.stopPropagation(); handleOpenTaskDrawer(record.source_task_id!); }}
              />
            </Tooltip>
          );
        }
        return null;
      },
    },
  ];

  return (
    <>
      <Table<IProjectLink>
        columns={columns}
        dataSource={links}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 'max-content' }}
        pagination={{
          current: pageIndex,
          pageSize,
          total,
          onChange: (page) => setPageIndex(page),
          showSizeChanger: false,
        }}
        onRow={record => ({
          style: { cursor: record.source_type === 'manual' || record.source_task_id ? 'pointer' : 'default' },
        })}
        locale={{
          emptyText: (
            <Flex vertical align="center" gap={8} style={{ padding: '32px 0' }}>
              <LinkOutlined style={{ fontSize: 32, color: colors.lightGray }} />
              <Typography.Text type="secondary">
                {t('noLinks', { defaultValue: 'No links yet. Click "Add Link" to add your first link.' })}
              </Typography.Text>
            </Flex>
          ),
        }}
      />

      <AddLinkModal
        open={addModalOpen}
        loading={addLoading}
        onSubmit={handleAdd}
        onCancel={() => onAddModalOpenChange(false)}
      />

      <EditLinkModal
        link={editingLink}
        open={editModalOpen}
        loading={editLoading}
        onSubmit={handleEditSubmit}
        onCancel={() => { setEditModalOpen(false); setEditingLink(null); }}
      />
    </>
  );
};
