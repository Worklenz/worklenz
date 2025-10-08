import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Typography,
  Space,
  Table,
  Modal,
  Form,
  Select,
  Tag,
  message,
  Popconfirm,
  Alert,
  Spin
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import logger from '@/utils/errorLogger';
import {
  slackApiService,
  ISlackWorkspace,
  ISlackChannel,
  ISlackChannelConfig
} from '@/api/slack/slack.api.service';

const { Title, Text, Paragraph } = Typography;

const SlackIntegration = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const [workspace, setWorkspace] = useState<ISlackWorkspace | null>(null);
  const [channels, setChannels] = useState<ISlackChannel[]>([]);
  const [configs, setConfigs] = useState<ISlackChannelConfig[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useDocumentTitle('Slack Integration');

  const fetchWorkspace = async () => {
    try {
      setIsLoading(true);
      const res = await slackApiService.getWorkspace();
      if (res.done && res.body) {
        setWorkspace(res.body);
        fetchChannels(res.body.id);
        fetchConfigs();
      }
    } catch (error) {
      logger.error('Error fetching Slack workspace', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChannels = async (workspaceId: string) => {
    try {
      const res = await slackApiService.getChannels(workspaceId);
      if (res.done) {
        setChannels(res.body);
      }
    } catch (error) {
      logger.error('Error fetching Slack channels', error);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await slackApiService.getOrganizationChannelConfigs();
      if (res.done) {
        setConfigs(res.body);
      }
    } catch (error) {
      logger.error('Error fetching channel configs', error);
    }
  };

  const handleDisconnect = async () => {
    if (!workspace) return;

    try {
      setIsLoading(true);
      const res = await slackApiService.disconnectWorkspace(workspace.id);
      if (res.done) {
        message.success('Slack workspace disconnected successfully');
        setWorkspace(null);
        setChannels([]);
        setConfigs([]);
      }
    } catch (error) {
      logger.error('Error disconnecting Slack workspace', error);
      message.error('Failed to disconnect Slack workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateConfig = async (values: any) => {
    try {
      setIsLoading(true);
      const res = await slackApiService.createChannelConfig(
        values.projectId,
        values.slackChannelId,
        values.notificationTypes || []
      );

      if (res.done) {
        message.success('Channel configuration created successfully');
        setIsConfigModalVisible(false);
        form.resetFields();
        fetchConfigs();
      }
    } catch (error) {
      logger.error('Error creating channel config', error);
      message.error('Failed to create channel configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    try {
      setIsLoading(true);
      const res = await slackApiService.deleteChannelConfig(configId);
      if (res.done) {
        message.success('Channel configuration deleted successfully');
        fetchConfigs();
      }
    } catch (error) {
      logger.error('Error deleting channel config', error);
      message.error('Failed to delete channel configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async (configId: string) => {
    try {
      setIsLoading(true);
      const res = await slackApiService.sendTestNotification(configId);
      if (res.done) {
        message.success('Test notification sent successfully');
      }
    } catch (error) {
      logger.error('Error sending test notification', error);
      message.error('Failed to send test notification');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectSlack = () => {
    // This would typically redirect to Slack OAuth flow
    // For now, we'll show a placeholder message
    message.info('Slack OAuth integration would be configured here');
    // In a real implementation:
    // window.location.href = 'YOUR_SLACK_OAUTH_URL';
  };

  useEffect(() => {
    fetchWorkspace();
  }, []);

  const configColumns = [
    {
      title: 'Project',
      dataIndex: 'project_name',
      key: 'project_name',
    },
    {
      title: 'Slack Channel',
      dataIndex: 'channel_name',
      key: 'channel_name',
      render: (text: string) => `#${text}`,
    },
    {
      title: 'Workspace',
      dataIndex: 'workspace_name',
      key: 'workspace_name',
    },
    {
      title: 'Notification Types',
      dataIndex: 'notification_types',
      key: 'notification_types',
      render: (types: string[]) => (
        <>
          {types?.map((type) => (
            <Tag key={type}>{type}</Tag>
          ))}
        </>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ISlackChannelConfig) => (
        <Space>
          <Button size="small" onClick={() => handleTestNotification(record.id)}>
            Test
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this configuration?"
            onConfirm={() => handleDeleteConfig(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card style={{ width: '100%' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={4}>Slack Integration</Title>
          <Paragraph>
            Connect your Worklenz workspace to Slack to receive notifications about project updates,
            task changes, and team activities directly in your Slack channels.
          </Paragraph>
        </div>

        {isLoading && !workspace ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : workspace ? (
          <>
            <Alert
              message={`Connected to Slack workspace: ${workspace.team_name}`}
              type="success"
              showIcon
              action={
                <Popconfirm
                  title="Are you sure you want to disconnect this Slack workspace?"
                  onConfirm={handleDisconnect}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button size="small" danger>
                    Disconnect
                  </Button>
                </Popconfirm>
              }
            />

            <div>
              <Space style={{ marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0 }}>
                  Channel Configurations
                </Title>
                <Button type="primary" onClick={() => setIsConfigModalVisible(true)}>
                  Add Configuration
                </Button>
              </Space>

              <Table
                columns={configColumns}
                dataSource={configs}
                rowKey="id"
                loading={isLoading}
                pagination={{ pageSize: 10 }}
              />
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Space direction="vertical" size="large">
              <Text type="secondary">
                Connect your Slack workspace to get started with Slack notifications
              </Text>
              <Button
                type="primary"
                size="large"
                onClick={handleConnectSlack}
                loading={isConnecting}
              >
                Connect to Slack
              </Button>
            </Space>
          </div>
        )}
      </Space>

      <Modal
        title="Add Slack Channel Configuration"
        open={isConfigModalVisible}
        onCancel={() => {
          setIsConfigModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={isLoading}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateConfig}>
          <Form.Item
            name="projectId"
            label="Project"
            rules={[{ required: true, message: 'Please select a project' }]}
          >
            <Select
              placeholder="Select a project"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {/* Projects would be loaded from your project API */}
              {projects.map((project) => (
                <Select.Option key={project.id} value={project.id} label={project.name}>
                  {project.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="slackChannelId"
            label="Slack Channel"
            rules={[{ required: true, message: 'Please select a Slack channel' }]}
          >
            <Select placeholder="Select a Slack channel">
              {channels.map((channel) => (
                <Select.Option key={channel.id} value={channel.id}>
                  #{channel.channel_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="notificationTypes" label="Notification Types">
            <Select
              mode="multiple"
              placeholder="Select notification types"
              options={[
                { label: 'Task Created', value: 'task_created' },
                { label: 'Task Updated', value: 'task_updated' },
                { label: 'Task Completed', value: 'task_completed' },
                { label: 'Comment Added', value: 'comment_added' },
                { label: 'Status Changed', value: 'status_changed' },
                { label: 'Due Date Changed', value: 'due_date_changed' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default SlackIntegration;
