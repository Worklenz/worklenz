import {
  Drawer,
  Typography,
  Flex,
  Card,
  Button,
  Select,
  Table,
  Spin,
  Empty,
  Tooltip,
  message,
  Popconfirm,
  Tag,
  ProjectOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  ExclamationCircleFilled,
} from '@/shared/antd-imports';
import {} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { toggleClientSettingsDrawer } from '../../features/clients-portal/clients/clients-slice';
import {
  useGetClientDetailsQuery,
  useGetClientProjectsQuery,
  useAssignProjectToClientMutation,
  useRemoveProjectFromClientMutation,
  useGetProjectsQuery,
} from '../../api/client-portal/client-portal-api';
import { useState } from 'react';
import { colors } from '../../styles/colors';

const { Option } = Select;

const ClientSettingsDrawer = () => {
  const { t } = useTranslation('client-portal-clients');

  const { isClientSettingsDrawerOpen, selectedClientId } = useAppSelector(
    state => state.clientsPortalReducer.clientsReducer
  );

  const dispatch = useAppDispatch();

  // Local state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // RTK Query hooks - only load data when drawer is open
  const { data: clientDetails, isLoading: isLoadingClient } = useGetClientDetailsQuery(
    selectedClientId!,
    {
      skip: !selectedClientId,
    }
  );

  // Extract data from comprehensive response
  const client = clientDetails?.body;
  const clientProjects = client ? { projects: client.projects } : null;

  const { refetch: refetchClientProjects } = useGetClientProjectsQuery(
    {
      clientId: selectedClientId!,
    },
    {
      skip: !selectedClientId || !isClientSettingsDrawerOpen,
    }
  );

  const isLoadingProjects = isLoadingClient;

  const { data: availableProjects, isLoading: isLoadingAvailableProjects } = useGetProjectsQuery(
    undefined,
    {
      skip: !isClientSettingsDrawerOpen,
    }
  );

  const [assignProject, { isLoading: isAssigning }] = useAssignProjectToClientMutation();
  const [removeProject, { isLoading: isRemoving }] = useRemoveProjectFromClientMutation();

  // Handle project assignment
  const handleAssignProject = async () => {
    if (!selectedProjectId || !selectedClientId) return;

    try {
      await assignProject({
        clientId: selectedClientId,
        projectId: selectedProjectId,
      }).unwrap();

      message.success(t('projectAssignedSuccessMessage') || 'Project assigned successfully');
      setSelectedProjectId(null);
      refetchClientProjects();
    } catch (error: any) {
      message.error(
        error?.data?.message || t('projectAssignedErrorMessage') || 'Failed to assign project'
      );
    }
  };

  // Handle project removal
  const handleRemoveProject = async (projectId: string) => {
    if (!selectedClientId) return;

    try {
      await removeProject({
        clientId: selectedClientId,
        projectId,
      }).unwrap();

      message.success(t('projectRemovedSuccessMessage') || 'Project removed successfully');
      refetchClientProjects();
    } catch (error: any) {
      message.error(t('projectRemovedErrorMessage') || 'Failed to remove project');
    }
  };

  // Get available projects (excluding already assigned ones)
  const getAvailableProjects = () => {
    if (!availableProjects?.body?.projects || !clientProjects?.projects) return [];

    const assignedProjectIds = clientProjects.projects.map(p => p.id);
    return availableProjects.body.projects.filter(
      project => !assignedProjectIds.includes(project.id)
    );
  };

  // Table columns for assigned projects
  const projectColumns = [
    {
      key: 'name',
      title: t('projectNameColumn') || 'Project Name',
      dataIndex: 'name',
      render: (name: string, record: any) => (
        <Flex vertical gap={4}>
          <Typography.Text strong>{name}</Typography.Text>
          {record.description && (
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              {record.description}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      key: 'status',
      title: t('statusColumn') || 'Status',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>{status}</Tag>
      ),
      width: 120,
    },
    {
      key: 'progress',
      title: t('progressColumn') || 'Progress',
      render: (_: any, record: any) => (
        <Typography.Text>
          {record.completedTasks}/{record.totalTasks} {t('tasksCompletedText') || 'tasks'}
        </Typography.Text>
      ),
      width: 150,
    },
    {
      key: 'actions',
      title: t('actionsColumn') || 'Actions',
      width: 120,
      render: (_: any, record: any) => (
        <Flex gap={8} align="center">
          <Tooltip title={t('viewProjectTooltip') || 'View Project'}>
            <Button type="link" icon={<EyeOutlined />} size="small">
              {t('viewButton') || 'View'}
            </Button>
          </Tooltip>

          <Popconfirm
            title={t('removeProjectConfirmationTitle') || 'Remove Project'}
            description={
              t('removeProjectConfirmationDescription') ||
              'Are you sure you want to remove this project from the client?'
            }
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            okText={t('removeConfirmationOk') || 'Remove'}
            cancelText={t('removeConfirmationCancel') || 'Cancel'}
            onConfirm={() => handleRemoveProject(record.id)}
          >
            <Tooltip title={t('removeProjectTooltip') || 'Remove Project'}>
              <Button
                type="link"
                icon={<DeleteOutlined />}
                size="small"
                danger
                loading={isRemoving}
              >
                {t('removeButton') || 'Remove'}
              </Button>
            </Tooltip>
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  if (!selectedClientId) {
    return null;
  }

  return (
    <Drawer
      title={
        <Flex align="center" gap={8}>
          <Typography.Title level={2} style={{ margin: 0, textTransform: 'capitalize' }}>
            {client?.name || t('loadingText') || 'Loading...'}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('projectSettingsTitle') || 'Project Settings'}
          </Typography.Text>
        </Flex>
      }
      open={isClientSettingsDrawerOpen}
      onClose={() => dispatch(toggleClientSettingsDrawer(null))}
      width={900}
    >
      <Spin spinning={isLoadingClient || isLoadingProjects}>
        <Flex vertical gap={24}>
          {/* Assign New Project */}
          <Card
            title={
              <Typography.Title level={4} style={{ margin: 0 }}>
                {t('assignProjectTitle') || 'Assign New Project'}
              </Typography.Title>
            }
          >
            <Flex gap={16} align="flex-end">
              <div style={{ flex: 1 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('selectProjectLabel') || 'Select Project'}
                </Typography.Text>
                <Select
                  placeholder={t('selectProjectPlaceholder') || 'Choose a project to assign'}
                  style={{ width: '100%' }}
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  loading={isLoadingAvailableProjects}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={getAvailableProjects().map(project => ({
                    label: project.name,
                    value: project.id,
                  }))}
                />
              </div>

              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAssignProject}
                loading={isAssigning}
                disabled={!selectedProjectId}
              >
                {t('assignButton') || 'Assign Project'}
              </Button>
            </Flex>
          </Card>

          {/* Assigned Projects */}
          <Card
            title={
              <Flex align="center" gap={8}>
                <ProjectOutlined />
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {t('assignedProjectsTitle') || 'Assigned Projects'}
                </Typography.Title>
                {clientProjects?.projects && (
                  <Tag color="blue">{clientProjects.projects.length}</Tag>
                )}
              </Flex>
            }
          >
            {clientProjects?.projects && clientProjects.projects.length > 0 ? (
              <Table
                dataSource={clientProjects.projects}
                columns={projectColumns}
                pagination={false}
                size="small"
                rowKey="id"
                scroll={{ x: 600 }}
              />
            ) : (
              <Empty
                description={t('noAssignedProjectsText') || 'No projects assigned to this client'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Flex>
      </Spin>
    </Drawer>
  );
};

export default ClientSettingsDrawer;
