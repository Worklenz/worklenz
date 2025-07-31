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
} from 'antd';
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
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { toggleClientDetailsDrawer, toggleEditClientDrawer } from '../../features/clients-portal/clients/clients-slice';
import { 
  useGetClientDetailsQuery,
  useDeleteClientMutation,
} from '../../api/client-portal/client-portal-api';
import { ClientPortalClient } from '../../api/client-portal/client-portal-api';

const { Title, Text, Paragraph } = Typography;

const ClientDetailsDrawer = () => {
  const { t } = useTranslation('client-portal-clients');
  
  const dispatch = useAppDispatch();
  
  const {
    isClientDetailsDrawerOpen,
    selectedClientId,
  } = useAppSelector((state) => state.clientsPortalReducer.clientsReducer);

  // RTK Query hook for comprehensive client details
  const { 
    data: clientDetails, 
    isLoading: isLoadingClient, 
    error: clientError 
  } = useGetClientDetailsQuery(selectedClientId || '', { 
    skip: !selectedClientId
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

  const [deleteClient, { isLoading: isDeleting }] = useDeleteClientMutation();

  const handleClose = () => {
    dispatch(toggleClientDetailsDrawer(null));
  };

  const handleEdit = () => {
    dispatch(toggleClientDetailsDrawer(null));
    dispatch(toggleEditClientDrawer(selectedClientId));
  };

  const handleDeleteClient = async () => {
    if (!selectedClientId) return;
    
    try {
      await deleteClient(selectedClientId).unwrap();
      message.success(t('deleteClientSuccessMessage') || 'Client deleted successfully');
      handleClose();
    } catch (error: any) {
      message.error(error?.data?.message || t('deleteClientErrorMessage') || 'Failed to delete client');
    }
  };

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
        <Flex align="center" gap={12}>
          <Avatar size="large" icon={<UserOutlined />} />
          <div>
            <Title level={2} style={{ margin: 0 }}>
              {client?.name || t('loadingText') || 'Loading...'}
            </Title>
            <Text type="secondary">
              {client?.email}
            </Text>
          </div>
        </Flex>
      }
      placement="right"
      onClose={handleClose}
      open={isClientDetailsDrawerOpen}
      width={600}
      footer={
        <Flex gap={12} justify="flex-end">
          <Button onClick={handleClose}>
            {t('closeButton') || 'Close'}
          </Button>
          <Button 
            type="primary"
            icon={<EditOutlined />}
            onClick={handleEdit}
          >
            {t('editButton') || 'Edit Client'}
          </Button>
          <Button 
            danger 
            icon={<DeleteOutlined />}
            onClick={handleDeleteClient}
            loading={isDeleting}
          >
            {t('deleteButton') || 'Delete Client'}
          </Button>
        </Flex>
      }
    >
      <Spin spinning={isLoadingClient}>
        {clientError && (
          <Alert
            message={t('errorTitle') || 'Error'}
            description={'data' in clientError && typeof clientError.data === 'object' && clientError.data !== null && 'message' in clientError.data ? String(clientError.data.message) : 'Failed to fetch client details'}
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
                <Flex gap={16} align="center">
                  <MailOutlined style={{ color: '#1890ff' }} />
                  <div>
                    <Text strong>{t('emailLabel') || 'Email'}</Text>
                    <br />
                    <Text>{client.email}</Text>
                  </div>
                </Flex>

                {client.company_name && (
                  <Flex gap={16} align="center">
                    <BuildOutlined style={{ color: '#1890ff' }} />
                    <div>
                      <Text strong>{t('companyNameLabel') || 'Company'}</Text>
                      <br />
                      <Text>{client.company_name}</Text>
                    </div>
                  </Flex>
                )}

                {client.phone && (
                  <Flex gap={16} align="center">
                    <PhoneOutlined style={{ color: '#1890ff' }} />
                    <div>
                      <Text strong>{t('phoneLabel') || 'Phone'}</Text>
                      <br />
                      <Text>{client.phone}</Text>
                    </div>
                  </Flex>
                )}

                {client.address && (
                  <Flex gap={16} align="center">
                    <EnvironmentOutlined style={{ color: '#1890ff' }} />
                    <div>
                      <Text strong>{t('addressLabel') || 'Address'}</Text>
                      <br />
                      <Text>{client.address}</Text>
                    </div>
                  </Flex>
                )}

                <Flex gap={16} align="center">
                  <CalendarOutlined style={{ color: '#1890ff' }} />
                  <div>
                    <Text strong>{t('createdAtLabel') || 'Created'}</Text>
                    <br />
                    <Text>{formatDate(client.created_at)}</Text>
                  </div>
                </Flex>

                <Flex gap={16} align="center">
                  <Tag color={getStatusColor(client.status)} style={{ textTransform: 'capitalize' }}>
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
                    renderItem={(member) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<Avatar icon={<UserOutlined />} />}
                          title={member.name}
                          description={
                            <Flex vertical gap={4}>
                              <Text type="secondary">{member.email}</Text>
                              {member.role && (
                                <Tag color="blue">{member.role}</Tag>
                              )}
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
                    renderItem={(project) => (
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
                                  {project.completedTasks}/{project.totalTasks} {t('tasksCompletedText') || 'tasks completed'}
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