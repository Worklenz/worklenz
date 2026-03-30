import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Modal, Select, message, ReloadOutlined, Spin } from '@/shared/antd-imports';
import type { FormInstance } from '@/shared/antd-imports';
import type { ISlackChannelConfig, ISlackChannel } from '@api/slack/slack.api.service';
import { slackApiService } from '@api/slack/slack.api.service';
import apiClient from '@api/api-client';
import logger from '@/utils/errorLogger';

interface Project {
  id: string;
  name: string;
  key?: string;
}

interface ChannelFormValues {
  projectId: string;
  slackChannelId: string;
  notificationTypes: string[];
}

interface SlackChannelFormModalProps {
  open: boolean;
  form: FormInstance<ChannelFormValues>;
  editingChannel: ISlackChannelConfig | null;
  availableChannels: ISlackChannel[];
  onClose: () => void;
  onSubmit: (values: ChannelFormValues) => void;
  onRefreshChannels: () => Promise<void>;
}

interface ApiResponse<T> {
  body?: {
    data?: T;
    total?: number;
  };
}

const NOTIFICATION_TYPE_DEFINITIONS = [
  {
    value: 'task_created',
    labelKey: 'modal.notificationOptions.taskCreated',
    defaultValue: 'Task Created',
  },
  {
    value: 'task_updated',
    labelKey: 'modal.notificationOptions.taskUpdated',
    defaultValue: 'Task Updated',
  },
  {
    value: 'task_completed',
    labelKey: 'modal.notificationOptions.taskCompleted',
    defaultValue: 'Task Completed',
  },
  {
    value: 'task_assigned',
    labelKey: 'modal.notificationOptions.taskAssigned',
    defaultValue: 'Task Assigned',
  },
  {
    value: 'status_changed',
    labelKey: 'modal.notificationOptions.statusChanged',
    defaultValue: 'Status Changed',
  },
  {
    value: 'comment_added',
    labelKey: 'modal.notificationOptions.commentAdded',
    defaultValue: 'Comment Added',
  },
  {
    value: 'due_date_changed',
    labelKey: 'modal.notificationOptions.dueDateChanged',
    defaultValue: 'Due Date Changed',
  },
  {
    value: 'priority_changed',
    labelKey: 'modal.notificationOptions.priorityChanged',
    defaultValue: 'Priority Changed',
  },
];

export function SlackChannelFormModal({
  open,
  form,
  editingChannel,
  availableChannels,
  onClose,
  onSubmit,
  onRefreshChannels,
}: SlackChannelFormModalProps) {
  const { t } = useTranslation('settings/slack-integration');
  const [messageApi, contextHolder] = message.useMessage();
  const [refreshing, setRefreshing] = useState(false);

  // Project search and pagination state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [projectsPage, setProjectsPage] = useState(1);
  const [projectsSearch, setProjectsSearch] = useState('');
  const projectsPageSize = 20;
  const scrollPositionRef = useRef(0);

  const notificationOptions = NOTIFICATION_TYPE_DEFINITIONS.map(
    ({ value, labelKey, defaultValue }) => ({
      value,
      label: t(labelKey, { defaultValue }),
    })
  );

  // Load projects with pagination
  const loadProjects = useCallback(
    async (page: number, search: string, append = false) => {
      try {
        setProjectsLoading(true);
        const response = await apiClient.get<ApiResponse<Project[]>>('/api/v1/projects', {
          params: {
            size: projectsPageSize,
            index: page,
            search: search || undefined,
          },
        });

        const newProjects = response.data?.body?.data || [];
        const total = response.data?.body?.total || 0;

        setProjects(prev => (append ? [...prev, ...newProjects] : newProjects));
        setProjectsTotal(total);
      } catch (error) {
        messageApi.error(t('errors.loadProjectsFailed'));
      } finally {
        setProjectsLoading(false);
      }
    },
    [messageApi, t]
  );

  // Handle project search
  const handleProjectSearch = (value: string) => {
    setProjectsPage(1);
    setProjectsSearch(value);
    loadProjects(1, value, false);
  };

  // Handle scroll to load more projects
  const handleProjectScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    // Check if scrolling down and near bottom
    if (scrollTop > scrollPositionRef.current && scrollTop + clientHeight >= scrollHeight - 50) {
      const hasMore = projects.length < projectsTotal;
      if (hasMore && !projectsLoading) {
        const nextPage = projectsPage + 1;
        setProjectsPage(nextPage);
        loadProjects(nextPage, projectsSearch, true);
      }
    }

    scrollPositionRef.current = scrollTop;
  };

  // Load initial projects when modal opens
  useEffect(() => {
    if (open && !editingChannel) {
      setProjects([]);
      setProjectsPage(1);
      setProjectsSearch('');
      scrollPositionRef.current = 0;
      loadProjects(1, '', false);
    }
  }, [open, editingChannel, loadProjects]);

  const handleRefreshChannels = async () => {
    try {
      setRefreshing(true);
      await slackApiService.refreshChannels();
      await onRefreshChannels();
    } catch (error) {
      logger.error('Failed to refresh channels', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Modal
      title={
        editingChannel
          ? t('modal.editChannel', { defaultValue: 'Edit Slack Channel' })
          : t('modal.configureChannel', { defaultValue: 'Configure Slack Channel' })
      }
      open={open}
      onCancel={onClose}
      footer={null}
    >
      {contextHolder}
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item
          name="projectId"
          label={t('modal.project', { defaultValue: 'Project' })}
          rules={[
            {
              required: true,
              message: t('validation.selectProject', {
                defaultValue: 'Please select a project',
              }),
            },
          ]}
        >
          <Select
            placeholder={t('modal.selectProject', { defaultValue: 'Select a project' })}
            showSearch
            filterOption={false}
            onSearch={handleProjectSearch}
            onPopupScroll={handleProjectScroll}
            disabled={!!editingChannel}
            loading={projectsLoading}
            notFoundContent={projectsLoading ? <Spin size="small" /> : null}
            dropdownRender={menu => (
              <>
                {menu}
                {projectsLoading && projects.length > 0 && (
                  <div style={{ textAlign: 'center', padding: '8px' }}>
                    <Spin size="small" />
                  </div>
                )}
                {!projectsLoading && projects.length < projectsTotal && (
                  <div
                    style={{ textAlign: 'center', padding: '8px', color: '#999', fontSize: '12px' }}
                  >
                    {t('modal.scrollForMore', { defaultValue: 'Scroll for more...' })}
                  </div>
                )}
              </>
            )}
          >
            {projects.map(project => (
              <Select.Option key={project.id} value={project.id}>
                {project.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="slackChannelId"
          label={
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <span>{t('modal.slackChannel', { defaultValue: 'Slack Channel' })}</span>
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRefreshChannels}
                loading={refreshing}
                style={{ padding: 0, height: 'auto', marginLeft: 'auto' }}
              >
                {t('modal.refreshChannels', { defaultValue: 'Refresh' })}
              </Button>
            </div>
          }
          rules={[
            {
              required: true,
              message: t('validation.selectChannel', {
                defaultValue: 'Please select a Slack channel',
              }),
            },
          ]}
        >
          <Select
            placeholder={t('modal.selectSlackChannel', {
              defaultValue: 'Select a Slack channel',
            })}
            showSearch
            optionFilterProp="children"
            disabled={!!editingChannel}
          >
            {availableChannels.map(channel => (
              <Select.Option key={channel.id} value={channel.id}>
                {channel.is_private && '🔒 '} #{channel.channel_name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="notificationTypes"
          label={t('modal.notificationTypes', { defaultValue: 'Notification Types' })}
          rules={[
            {
              required: true,
              message: t('validation.selectNotifications', {
                defaultValue: 'Please select notification types',
              }),
            },
          ]}
        >
          <Select
            mode="multiple"
            placeholder={t('modal.selectNotificationTypes', {
              defaultValue: 'Select notification types',
            })}
            options={notificationOptions}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            {editingChannel
              ? t('modal.updateConfiguration', { defaultValue: 'Update Configuration' })
              : t('modal.addConfiguration', { defaultValue: 'Add Configuration' })}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
