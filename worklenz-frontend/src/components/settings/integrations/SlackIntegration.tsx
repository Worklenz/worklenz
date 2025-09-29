import React, { useState, useEffect } from 'react';
import { Button, Card, Switch, Select, Table, Tag, Modal, Form, message } from 'antd';
import { SlackOutlined, PlusOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import apiClient from '@api/api-client';


interface SlackChannel {
    id: string;
    projectId: string;
    projectName: string;
    slackChannelId: string;
    slackChannelName: string;
    notificationTypes: string[];
    isActive: boolean;
}

export function SlackIntegration() {
    const { t } = useTranslation();
    const [isConnected, setIsConnected] = useState(false);
    const [workspace, setWorkspace] = useState<any>(null);
    const [channels, setChannels] = useState<SlackChannel[]>([]);
    const [availableChannels, setAvailableChannels] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        checkSlackConnection();
        loadChannelConfigurations();
        loadProjects();
        
        // Check for OAuth callback params
        const params = new URLSearchParams(window.location.search);
        const slackStatus = params.get('slack');
        
        if (slackStatus === 'success') {
            message.success('Slack workspace connected successfully!');
            window.history.replaceState({}, '', window.location.pathname);
            checkSlackConnection();
        } else if (slackStatus === 'error') {
            message.error('Failed to connect Slack workspace');
            window.history.replaceState({}, '', window.location.pathname);
        } else if (slackStatus === 'cancelled') {
            message.info('Slack installation cancelled');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const checkSlackConnection = async () => {
        try {
            const response = await apiClient.get('/api/slack/status');
            setIsConnected(response.data.connected);
            setWorkspace(response.data.workspace);
            
            if (response.data.connected) {
                loadAvailableChannels();
            }
        } catch (error) {
            console.error('Failed to check Slack connection:', error);
        }
    };

    const loadChannelConfigurations = async () => {
        try {
            const response = await apiClient.get('/api/slack/channel-configs');
            setChannels(response.data);
        } catch (error) {
            console.error('Failed to load channel configurations:', error);
        }
    };

    const loadAvailableChannels = async () => {
        try {
            const response = await apiClient.get('/api/slack/channels');
            setAvailableChannels(response.data);
        } catch (error) {
            console.error('Failed to load available channels:', error);
        }
    };

    const loadProjects = async () => {
        try {
            const response = await apiClient.get('/api/v1/projects');
            setProjects(response.data);
        } catch (error) {
            console.error('Failed to load projects:', error);
        }
    };

    const handleConnect = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/api/slack/install-url');
            
            // Open Slack OAuth in new window
            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;
            
            const authWindow = window.open(
                response.data.url,
                'slack-auth',
                `width=${width},height=${height},left=${left},top=${top}`
            );
            
            // Check if window was closed
            const checkInterval = setInterval(() => {
                if (authWindow?.closed) {
                    clearInterval(checkInterval);
                    setLoading(false);
                    checkSlackConnection();
                }
            }, 1000);
        } catch (error) {
            message.error('Failed to initiate Slack connection');
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        Modal.confirm({
            title: 'Disconnect Slack?',
            content: 'This will remove all Slack configurations and stop notifications for your team.',
            onOk: async () => {
                try {
                    await apiClient.delete('/api/slack/disconnect');
                    setIsConnected(false);
                    setWorkspace(null);
                    setChannels([]);
                    setAvailableChannels([]);
                    message.success('Slack workspace disconnected successfully');
                } catch (error) {
                    message.error('Failed to disconnect Slack workspace');
                }
            }
        });
    };

    const handleAddChannel = async (values: any) => {
        try {
            await apiClient.post('/api/integrations/slack/channels', values);
            message.success('Channel configuration added');
            setModalVisible(false);
            form.resetFields();
            loadChannelConfigurations();
        } catch (error) {
            message.error('Failed to add channel configuration');
        }
    };

    const handleToggleChannel = async (channelId: string, isActive: boolean) => {
        try {
            await apiClient.patch(`/api/integrations/slack/channels/${channelId}`, { isActive });
            message.success('Channel status updated');
            loadChannelConfigurations();
        } catch (error) {
            message.error('Failed to update channel status');
        }
    };

    const handleDeleteChannel = async (channelId: string) => {
        try {
            await apiClient.delete(`/api/integrations/slack/channels/${channelId}`);
            message.success('Channel configuration removed');
            loadChannelConfigurations();
        } catch (error) {
            message.error('Failed to remove channel configuration');
        }
    };

    const columns = [
        {
            title: 'Project',
            dataIndex: 'projectName',
            key: 'projectName',
        },
        {
            title: 'Slack Channel',
            dataIndex: 'slackChannelName',
            key: 'slackChannelName',
            render: (text: string) => <Tag icon={<SlackOutlined />}>{text}</Tag>
        },
        {
            title: 'Notifications',
            dataIndex: 'notificationTypes',
            key: 'notificationTypes',
            render: (types: string[]) => (
                <>
                    {types.map(type => (
                        <Tag key={type}>{type.replace('_', ' ')}</Tag>
                    ))}
                </>
            )
        },
        {
            title: 'Active',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive: boolean, record: SlackChannel) => (
                <Switch 
                    checked={isActive}
                    onChange={(checked) => handleToggleChannel(record.id, checked)}
                />
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: SlackChannel) => (
                <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteChannel(record.id)}
                />
            )
        }
    ];

    return (
        <Card 
            title={
                <div className="flex items-center gap-2">
                    <SlackOutlined className="text-xl" />
                    <span>Slack Integration</span>
                </div>
            }
            extra={
                isConnected ? (
                    <div className="flex gap-2">
                        <Button 
                            icon={<PlusOutlined />}
                            onClick={() => setModalVisible(true)}
                        >
                            Add Channel Configuration
                        </Button>
                        <Button danger onClick={handleDisconnect}>
                            Disconnect
                        </Button>
                    </div>
                ) : (
                    <Button 
                        type="primary" 
                        onClick={handleConnect}
                        loading={loading}
                    >
                        Connect Slack Workspace
                    </Button>
                )
            }
        >
            {isConnected ? (
                <>
                    <div className="mb-4">
                        <div className="flex items-center gap-2">
                            <Tag color="success">Connected</Tag>
                            <span className="text-gray-700 font-medium">
                                {workspace?.name || 'Slack Workspace'}
                            </span>
                        </div>
                        <p className="text-gray-500 mt-2">
                            Your team's Slack workspace is connected. Configure which channels receive notifications for each project.
                        </p>
                    </div>

                    <Table 
                        columns={columns}
                        dataSource={channels}
                        rowKey="id"
                        loading={loading}
                    />

                    <Modal
                        title="Configure Slack Channel"
                        open={modalVisible}
                        onCancel={() => setModalVisible(false)}
                        footer={null}
                    >
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleAddChannel}
                        >
                            <Form.Item
                                name="projectId"
                                label="Project"
                                rules={[{ required: true, message: 'Please select a project' }]}
                            >
                                <Select 
                                    placeholder="Select a project"
                                    showSearch
                                    optionFilterProp="children"
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
                                label="Slack Channel"
                                rules={[{ required: true, message: 'Please select a Slack channel' }]}
                            >
                                <Select 
                                    placeholder="Select a Slack channel"
                                    showSearch
                                    optionFilterProp="children"
                                >
                                    {availableChannels.map(channel => (
                                        <Select.Option key={channel.id} value={channel.id}>
                                            {channel.is_private && '🔒 '} #{channel.name}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                name="notificationTypes"
                                label="Notification Types"
                                rules={[{ required: true }]}
                            >
                                <Select
                                    mode="multiple"
                                    placeholder="Select notification types"
                                    options={[
                                        { value: 'task_created', label: 'Task Created' },
                                        { value: 'task_completed', label: 'Task Completed' },
                                        { value: 'task_assigned', label: 'Task Assigned' },
                                        { value: 'comment_added', label: 'Comment Added' },
                                        { value: 'due_date_reminder', label: 'Due Date Reminder' }
                                    ]}
                                />
                            </Form.Item>

                            <Form.Item>
                                <Button type="primary" htmlType="submit" block>
                                    Add Configuration
                                </Button>
                            </Form.Item>
                        </Form>
                    </Modal>
                </>
            ) : (
                <div className="text-center py-8">
                    <SlackOutlined className="text-6xl text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Connect Your Slack Workspace</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                        Integrate Slack with your Worklenz team to receive real-time notifications, 
                        create tasks from Slack, and keep your team synchronized across both platforms.
                    </p>
                    <div className="space-y-4 max-w-md mx-auto text-left mb-6">
                        <div className="flex items-start gap-3">
                            <CheckCircleOutlined className="text-green-500 mt-1" />
                            <div>
                                <strong>Real-time Notifications</strong>
                                <p className="text-sm text-gray-500">Get notified about task updates, comments, and deadlines</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircleOutlined className="text-green-500 mt-1" />
                            <div>
                                <strong>Create Tasks from Slack</strong>
                                <p className="text-sm text-gray-500">Use slash commands to quickly create tasks without leaving Slack</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircleOutlined className="text-green-500 mt-1" />
                            <div>
                                <strong>Team Collaboration</strong>
                                <p className="text-sm text-gray-500">Keep your entire team in sync across Worklenz and Slack</p>
                            </div>
                        </div>
                    </div>
                    <Button 
                        type="primary" 
                        size="large" 
                        onClick={handleConnect}
                        loading={loading}
                    >
                        Connect Slack Workspace
                    </Button>
                </div>
            )}
        </Card>
    );
}