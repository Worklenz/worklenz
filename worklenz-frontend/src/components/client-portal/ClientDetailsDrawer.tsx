import {
  Drawer,
  Typography,
  Flex,
  Card,
  Statistic,
  Avatar,
  Tag,
  Button,
  Space,
  Divider,
  List,
  Spin,
  Alert,
  Empty,
  Tooltip,
  message,
  Input,
  Dropdown,
} from '@/shared/antd-imports';
import {
  UserOutlined,
  TeamOutlined,
  ProjectOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  BuildOutlined,
  CalendarOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import {
  toggleClientDetailsDrawer,
  toggleEditClientDrawer,
} from '../../features/clients-portal/clients/clients-slice';
import {
  useGetClientDetailsQuery,
  useDeactivateClientMutation,
  useUpdateClientMutation,
} from '../../api/client-portal/client-portal-api';
import { ClientPortalClient } from '../../api/client-portal/client-portal-api';
import { useState } from 'react';

const { Title, Text, Paragraph } = Typography;

const ClientDetailsDrawer = () => {
  const { t } = useTranslation('client-portal-clients');

  const dispatch = useAppDispatch();

  const { isClientDetailsDrawerOpen, selectedClientId } = useAppSelector(
    state => state.clientsPortalReducer.clientsReducer
  );

  // RTK Query hook for comprehensive client details
  const {
    data: clientDetails,
    isLoading: isLoadingClient,
    error: clientError,
    refetch: refetchClientDetails,
  } = useGetClientDetailsQuery(selectedClientId || '', {
    skip: !selectedClientId,
  });

  // Extract data from the comprehensive response - handle ServerResponse wrapper
  const client = clientDetails?.body;
  const clientStats = client?.stats;
  const clientTeam = client ? { team_members: client.team_members } : null;
  const clientProjects = client ? { projects: client.projects } : null;

  // Set loading states based on main query
  const isLoadingStats = isLoadingClient;
  const isLoadingTeam = isLoadingClient;
  const isLoadingProjects = isLoadingClient;

  const [deactivateClient, { isLoading: isDeactivating }] = useDeactivateClientMutation();
  const [updateClient, { isLoading: isUpdating }] = useUpdateClientMutation();

  // Inline editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleClose = () => {
    dispatch(toggleClientDetailsDrawer(null));
  };

  const handleEdit = () => {
    dispatch(toggleClientDetailsDrawer(null));
    dispatch(toggleEditClientDrawer(selectedClientId));
  };

  const handleDeactivateClient = async () => {
    if (!selectedClientId) return;

    try {
      await deactivateClient(selectedClientId).unwrap();
      message.success(t('deactivateClientSuccessMessage') || 'Client deactivated successfully');
      handleClose();
    } catch (error: any) {
      message.error(
        error?.data?.message || t('deactivateClientErrorMessage') || 'Failed to deactivate client'
      );
    }
  };

  // Inline editing handlers
  const handleStartEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValues({ ...editValues, [field]: currentValue || '' });
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValues({});
  };

  const handleSaveEdit = async (field: string) => {
    if (!selectedClientId || !client) return;

    const newValue = editValues[field];
    const currentValue = (client as any)[field];

    // Only update if value changed
    if (newValue === currentValue) {
      setEditingField(null);
      setEditValues({});
      return;
    }

    try {
      await updateClient({
        id: selectedClientId,
        data: {
          [field]: newValue || null,
        },
      }).unwrap();

      message.success(t('updateClientSuccessMessage') || 'Client updated successfully');
      setEditingField(null);
      setEditValues({});
      refetchClientDetails();
    } catch (error: any) {
      message.error(
        error?.data?.message || t('updateClientErrorMessage') || 'Failed to update client'
      );
    }
  };

  // Header menu items
  const headerMenuItems = [
    {
      key: 'edit',
      label: t('editButton') || 'Edit Client',
      icon: <EditOutlined />,
      onClick: handleEdit,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'deactivate',
      label: t('deactivateButton') || 'Deactivate Client',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleDeactivateClient,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'red';
      case 'pending':
        return 'orange';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Don't render if no client is selected or drawer is not open
  if (!selectedClientId || !isClientDetailsDrawerOpen) {
    return null;
  }

  return (
    <Drawer
      title={
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Flex align="center" gap={12}>
            <Avatar size="large" icon={<UserOutlined />} />
            <div>
              <Title level={2} style={{ margin: 0 }}>
                {client?.name || t('loadingText') || 'Loading...'}
              </Title>
              <Text type="secondary">{client?.email}</Text>
            </div>
          </Flex>
          <Dropdown
            menu={{ items: headerMenuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              onClick={e => e.stopPropagation()}
              loading={isDeactivating}
            />
          </Dropdown>
        </Flex>
      }
      placement="right"
      onClose={handleClose}
      open={isClientDetailsDrawerOpen}
      width={600}
    >
      <Spin spinning={isLoadingClient}>
        {clientError && (
          <Alert
            message={t('errorTitle') || 'Error'}
            description={
              'data' in clientError &&
              typeof clientError.data === 'object' &&
              clientError.data !== null &&
              'message' in clientError.data
                ? String(clientError.data.message)
                : 'Failed to fetch client details'
            }
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {client && (
          <>
            {/* Client Information */}
            <Card
              title={
                <Title level={4} style={{ margin: 0 }}>
                  {t('clientInformationTitle') || 'Client Information'}
                </Title>
              }
              style={{ marginBottom: 16 }}
            >
              <Flex vertical gap={16}>
                <Flex gap={16} align="center" justify="space-between">
                  <Flex gap={16} align="center" style={{ flex: 1 }}>
                    <MailOutlined style={{ color: '#1890ff' }} />
                    <div style={{ flex: 1 }}>
                      <Text strong>{t('emailLabel') || 'Email'}</Text>
                      <br />
                      {editingField === 'email' ? (
                        <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                          <Input
                            value={editValues.email}
                            onChange={e => setEditValues({ ...editValues, email: e.target.value })}
                            style={{ flex: 1 }}
                            size="small"
                            type="email"
                          />
                          <Button
                            type="text"
                            icon={<CheckOutlined />}
                            onClick={() => handleSaveEdit('email')}
                            loading={isUpdating}
                            size="small"
                          />
                          <Button
                            type="text"
                            icon={<CloseOutlined />}
                            onClick={handleCancelEdit}
                            size="small"
                          />
                        </Flex>
                      ) : (
                        <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                          <Text>{client.email || '-'}</Text>
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => handleStartEdit('email', client.email || '')}
                          />
                        </Flex>
                      )}
                    </div>
                  </Flex>
                </Flex>

                <Flex gap={16} align="center" justify="space-between">
                  <Flex gap={16} align="center" style={{ flex: 1 }}>
                    <BuildOutlined style={{ color: '#1890ff' }} />
                    <div style={{ flex: 1 }}>
                      <Text strong>{t('companyNameLabel') || 'Company'}</Text>
                      <br />
                      {editingField === 'company_name' ? (
                        <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                          <Input
                            value={editValues.company_name}
                            onChange={e =>
                              setEditValues({ ...editValues, company_name: e.target.value })
                            }
                            style={{ flex: 1 }}
                            size="small"
                          />
                          <Button
                            type="text"
                            icon={<CheckOutlined />}
                            onClick={() => handleSaveEdit('company_name')}
                            loading={isUpdating}
                            size="small"
                          />
                          <Button
                            type="text"
                            icon={<CloseOutlined />}
                            onClick={handleCancelEdit}
                            size="small"
                          />
                        </Flex>
                      ) : (
                        <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                          <Text>{client.company_name || '-'}</Text>
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => handleStartEdit('company_name', client.company_name || '')}
                          />
                        </Flex>
                      )}
                    </div>
                  </Flex>
                </Flex>

                <Flex gap={16} align="center" justify="space-between">
                  <Flex gap={16} align="center" style={{ flex: 1 }}>
                    <PhoneOutlined style={{ color: '#1890ff' }} />
                    <div style={{ flex: 1 }}>
                      <Text strong>{t('phoneLabel') || 'Phone'}</Text>
                      <br />
                      {editingField === 'phone' ? (
                        <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                          <Input
                            value={editValues.phone}
                            onChange={e => setEditValues({ ...editValues, phone: e.target.value })}
                            style={{ flex: 1 }}
                            size="small"
                          />
                          <Button
                            type="text"
                            icon={<CheckOutlined />}
                            onClick={() => handleSaveEdit('phone')}
                            loading={isUpdating}
                            size="small"
                          />
                          <Button
                            type="text"
                            icon={<CloseOutlined />}
                            onClick={handleCancelEdit}
                            size="small"
                          />
                        </Flex>
                      ) : (
                        <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                          <Text>{client.phone || '-'}</Text>
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => handleStartEdit('phone', client.phone || '')}
                          />
                        </Flex>
                      )}
                    </div>
                  </Flex>
                </Flex>

                <Flex gap={16} align="center" justify="space-between">
                  <Flex gap={16} align="center" style={{ flex: 1 }}>
                    <EnvironmentOutlined style={{ color: '#1890ff' }} />
                    <div style={{ flex: 1 }}>
                      <Text strong>{t('addressLabel') || 'Address'}</Text>
                      <br />
                      {editingField === 'address' ? (
                        <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                          <Input.TextArea
                            value={editValues.address}
                            onChange={e =>
                              setEditValues({ ...editValues, address: e.target.value })
                            }
                            style={{ flex: 1 }}
                            rows={2}
                            size="small"
                          />
                          <Flex vertical gap={4}>
                            <Button
                              type="text"
                              icon={<CheckOutlined />}
                              onClick={() => handleSaveEdit('address')}
                              loading={isUpdating}
                              size="small"
                            />
                            <Button
                              type="text"
                              icon={<CloseOutlined />}
                              onClick={handleCancelEdit}
                              size="small"
                            />
                          </Flex>
                        </Flex>
                      ) : (
                        <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                          <Text style={{ flex: 1 }}>{client.address || '-'}</Text>
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => handleStartEdit('address', client.address || '')}
                          />
                        </Flex>
                      )}
                    </div>
                  </Flex>
                </Flex>

                <Flex gap={16} align="center" justify="space-between">
                  <Flex gap={16} align="center" style={{ flex: 1 }}>
                    <UserOutlined style={{ color: '#1890ff' }} />
                    <div style={{ flex: 1 }}>
                      <Text strong>{t('contactPersonLabel') || 'Contact Person'}</Text>
                      <br />
                      {editingField === 'contact_person' ? (
                        <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                          <Input
                            value={editValues.contact_person}
                            onChange={e =>
                              setEditValues({ ...editValues, contact_person: e.target.value })
                            }
                            style={{ flex: 1 }}
                            size="small"
                            placeholder={t('contactPersonPlaceholder') || 'Enter contact person name'}
                          />
                          <Button
                            type="text"
                            icon={<CheckOutlined />}
                            onClick={() => handleSaveEdit('contact_person')}
                            loading={isUpdating}
                            size="small"
                          />
                          <Button
                            type="text"
                            icon={<CloseOutlined />}
                            onClick={handleCancelEdit}
                            size="small"
                          />
                        </Flex>
                      ) : (
                        <Flex gap={8} align="center" style={{ marginTop: 4 }}>
                          <Text>{(client as any).contact_person || '-'}</Text>
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() =>
                              handleStartEdit('contact_person', (client as any).contact_person || '')
                            }
                          />
                        </Flex>
                      )}
                    </div>
                  </Flex>
                </Flex>

                <Flex gap={16} align="center">
                  <CalendarOutlined style={{ color: '#1890ff' }} />
                  <div>
                    <Text strong>{t('createdAtLabel') || 'Created'}</Text>
                    <br />
                    <Text>{formatDate(client.created_at)}</Text>
                  </div>
                </Flex>

                <Flex gap={16} align="center">
                  <Tag
                    color={getStatusColor(client.status)}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {client.status}
                  </Tag>
                </Flex>
              </Flex>
            </Card>

            {/* Statistics */}
            <Card
              title={
                <Title level={4} style={{ margin: 0 }}>
                  {t('statisticsTitle') || 'Statistics'}
                </Title>
              }
              style={{ marginBottom: 16 }}
            >
              <Spin spinning={isLoadingStats}>
                {clientStats && (
                  <Flex gap={16} wrap="wrap">
                    <Statistic
                      title={t('totalProjectsLabel') || 'Total Projects'}
                      value={clientStats.totalProjects}
                      prefix={<ProjectOutlined />}
                    />
                    <Statistic
                      title={t('activeProjectsLabel') || 'Active Projects'}
                      value={clientStats.activeProjects}
                      valueStyle={{ color: '#3f8600' }}
                    />
                    <Statistic
                      title={t('totalTeamMembersLabel') || 'Team Members'}
                      value={clientStats.totalTeamMembers}
                      prefix={<TeamOutlined />}
                    />
                    <Statistic
                      title={t('totalRequestsLabel') || 'Total Requests'}
                      value={clientStats.totalRequests}
                    />
                  </Flex>
                )}
              </Spin>
            </Card>

            {/* Team Members */}
            <Card
              title={
                <Flex align="center" gap={8}>
                  <TeamOutlined />
                  <Title level={4} style={{ margin: 0 }}>
                    {t('teamMembersTitle') || 'Team Members'}
                  </Title>
                </Flex>
              }
              style={{ marginBottom: 16 }}
            >
              <Spin spinning={isLoadingTeam}>
                {clientTeam?.team_members && clientTeam.team_members.length > 0 ? (
                  <List
                    dataSource={clientTeam.team_members}
                    renderItem={member => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<Avatar icon={<UserOutlined />} />}
                          title={member.name}
                          description={
                            <Flex vertical gap={4}>
                              <Text type="secondary">{member.email}</Text>
                              {member.role && <Tag color="blue">{member.role}</Tag>}
                              <Tag color={member.status === 'active' ? 'green' : 'red'}>
                                {member.status}
                              </Tag>
                            </Flex>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty
                    description={t('noTeamMembersText') || 'No team members found'}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </Spin>
            </Card>

            {/* Projects */}
            <Card
              title={
                <Flex align="center" gap={8}>
                  <ProjectOutlined />
                  <Title level={4} style={{ margin: 0 }}>
                    {t('projectsTitle') || 'Projects'}
                  </Title>
                </Flex>
              }
            >
              <Spin spinning={isLoadingProjects}>
                {clientProjects?.projects && clientProjects.projects.length > 0 ? (
                  <List
                    dataSource={clientProjects.projects}
                    renderItem={project => (
                      <List.Item
                        actions={[
                          <Tooltip title={t('viewProjectTooltip') || 'View Project'}>
                            <Button type="link" icon={<EyeOutlined />} size="small">
                              {t('viewButton') || 'View'}
                            </Button>
                          </Tooltip>,
                        ]}
                      >
                        <List.Item.Meta
                          title={project.name}
                          description={
                            <Flex vertical gap={4}>
                              <Text type="secondary">{project.description}</Text>
                              <Flex gap={8} align="center">
                                <Tag color={project.status === 'active' ? 'green' : 'default'}>
                                  {project.status}
                                </Tag>
                                <Text type="secondary">
                                  {project.completedTasks}/{project.totalTasks}{' '}
                                  {t('tasksCompletedText') || 'tasks completed'}
                                </Text>
                              </Flex>
                            </Flex>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty
                    description={t('noProjectsText') || 'No projects found'}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </Spin>
            </Card>
          </>
        )}
      </Spin>
    </Drawer>
  );
};

export default ClientDetailsDrawer;
