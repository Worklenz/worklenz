import {
  Drawer,
  Typography,
  Input,
  Flex,
  Select,
  Table,
  message,
  TableColumnsType,
  theme,
} from '@/shared/antd-imports';
import React, { useState, useMemo } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';

import { useTranslation } from 'react-i18next';
import {
  toggleClientSettingsDrawer,
  updateClientName,
} from '../../features/clients-portal/clients/clients-slice';
import { useGetProjectsQuery } from '../../api/projects/projects.v1.api.service';
import {
  useGetClientDetailsQuery,
  useAssignProjectToClientMutation,
  ClientPortalProject,
} from '../../api/client-portal/client-portal-api';
import { IProjectViewModel } from '../../types/project/projectViewModel.types';
import { Avatar, Badge, Progress, Tooltip } from '@/shared/antd-imports';

const getClientPortalProjectColumns = (
  t: (key: string, options?: { defaultValue: string }) => string,
  avatarColors: string[],
  primaryColor: string
): TableColumnsType<ClientPortalProject> => {
  return [
    {
      title: t('name', { defaultValue: 'Name' }),
      key: 'name',
      dataIndex: 'name',
      sorter: (a: ClientPortalProject, b: ClientPortalProject) =>
        (a.name || '').localeCompare(b.name || ''),
      width: 240,
      showSorterTooltip: false,
      render: (text, record) => {
        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Flex gap={2} align="center">
              <Badge color={primaryColor} style={{ marginRight: '0.5rem' }} />
              <Typography.Text ellipsis={{ expanded: false }}>{record.name}</Typography.Text>
            </Flex>
          </div>
        );
      },
    },
    {
      title: t('status', { defaultValue: 'Status' }),
      key: 'status',
      dataIndex: 'status',
      sorter: (a: ClientPortalProject, b: ClientPortalProject) =>
        (a.status || '').localeCompare(b.status || ''),
      showSorterTooltip: false,
    },
    {
      title: t('tasksProgress', { defaultValue: 'Tasks Progress' }),
      key: 'tasksProgress',
      render: (text, record) => {
        const { totalTasks, completedTasks } = record;
        const percent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        return (
          <Tooltip title={`${completedTasks} / ${totalTasks} tasks completed.`}>
            <Progress percent={percent} className="project-progress" />
          </Tooltip>
        );
      },
    },
    {
      title: t('lastUpdated', { defaultValue: 'Last Updated' }),
      key: 'lastUpdated',
      dataIndex: 'lastUpdated',
      width: 160,
      sorter: (a: ClientPortalProject, b: ClientPortalProject) => {
        const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return dateA - dateB;
      },
      showSorterTooltip: false,
      render: (date: string) => {
        if (!date) return '-';

        const now = new Date();
        const updatedDate = new Date(date);

        const timeDifference = now.getTime() - updatedDate.getTime();
        const minuteInMs = 60 * 1000;
        const hourInMs = 60 * minuteInMs;
        const dayInMs = 24 * hourInMs;

        let displayText = '';

        if (timeDifference < hourInMs) {
          const minutesAgo = Math.floor(timeDifference / minuteInMs);
          displayText = `${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;
        } else if (timeDifference < dayInMs) {
          const hoursAgo = Math.floor(timeDifference / hourInMs);
          displayText = `${hoursAgo} hour${hoursAgo === 1 ? '' : 's'} ago`;
        } else if (timeDifference < 7 * dayInMs) {
          const daysAgo = Math.floor(timeDifference / dayInMs);
          displayText = `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
        } else {
          displayText = updatedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        }

        return (
          <Tooltip
            title={updatedDate.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              second: 'numeric',
              hour12: true,
            })}
          >
            {displayText}
          </Tooltip>
        );
      },
    },
    {
      title: t('members', { defaultValue: 'Members' }),
      key: 'members',
      dataIndex: 'members',
      render: (members: string[]) => (
        <Avatar.Group>
          {members?.map((member, index) => (
            <Tooltip key={index} title={member}>
              <Avatar
                style={{
                  backgroundColor: avatarColors[index % avatarColors.length],
                  width: '28px',
                  height: '28px',
                  border: 'none',
                }}
              >
                {member?.charAt(0)?.toUpperCase() || ''}
              </Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
      ),
    },
  ];
};

const ClientPortalClientsSettingsDrawer = () => {
  // localization
  const { t } = useTranslation('client-portal-clients');

  // Get theme tokens for avatar colors
  const { token } = theme.useToken();

  // Generate avatar colors from theme tokens
  // These colors automatically adapt to light/dark themes using Ant Design's semantic tokens
  const avatarColors = useMemo(() => {
    // Map original colors to semantic theme tokens for theme-aware avatar colors
    // Original: ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#87d068']
    // Using semantic tokens ensures proper light/dark theme compatibility
    return [
      token.colorWarning, // Orange/warning color (replaces #f56a00)
      token.colorPrimary, // Primary brand color (replaces #7265e6)
      token.colorError, // Error/red color for variety (replaces #ffbf00)
      token.colorPrimary, // Primary color for cyan/teal variation (replaces #00a2ae)
      token.colorSuccess, // Green/success color (replaces #87d068)
    ];
  }, [token]);

  // get drawer data from client reducer
  const { isClientSettingsDrawerOpen, selectedClientId } = useAppSelector(
    state => state.clientsPortalReducer.clientsReducer
  );

  const dispatch = useAppDispatch();

  // Fetch client details
  const {
    data: clientDetails,
    isLoading: isLoadingClient,
    refetch: refetchClientDetails,
  } = useGetClientDetailsQuery(selectedClientId!, {
    skip: !selectedClientId,
  });

  const client = clientDetails?.body;

  // Fetch available projects using RTK Query - get all projects for the team
  const {
    data: availableProjects,
    isLoading: isLoadingProjects,
    error: projectsError,
  } = useGetProjectsQuery(
    {
      index: 1,
      size: 1000, // Large size to get all projects
      field: 'name',
      order: 'ascend',
      search: null,
      filter: null,
      statuses: null,
      categories: null,
    },
    {
      skip: !isClientSettingsDrawerOpen,
    }
  );

  // Log error if any
  React.useEffect(() => {
    if (projectsError) {
      console.error('[ClientPortalClientsSettingsDrawer] Projects API error:', projectsError);
    }
  }, [projectsError]);

  const [clientName, setClientName] = useState(client?.name || '');
  const [isEditing, setIsEditing] = useState(false);

  // API mutation for assigning project to client
  const [assignProject, { isLoading: isAssigning }] = useAssignProjectToClientMutation();

  // Get available projects (excluding already assigned ones)
  const projectOptions = useMemo(() => {
    // Check response structure - projects API returns IServerResponse<IProjectsViewModel>
    // Structure: response.body.data (array) and response.body.total
    const projectsData = availableProjects?.body?.data;

    if (!projectsData || !Array.isArray(projectsData) || projectsData.length === 0) {
      return [];
    }

    const assignedProjectIds =
      client?.projects?.map(p => p.id).filter((id): id is string => !!id) || [];

    const filtered = projectsData.filter((project: IProjectViewModel) => {
      // Must have id and name
      if (!project.id || !project.name) return false;

      // Exclude if already assigned to this client
      if (assignedProjectIds.includes(project.id)) return false;

      // Exclude if already assigned to another client (client_id is set and not null)
      if (project.client_id) return false;

      return true;
    });

    return filtered.map((project: IProjectViewModel) => ({
      label: project.name,
      value: project.id!,
    }));
  }, [availableProjects, client]);

  // Update client name when client data changes
  React.useEffect(() => {
    if (client?.name) {
      setClientName(client.name);
    }
  }, [client?.name]);

  // handle name change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientName(e.target.value);
  };

  // handle input blur or Enter press
  const handleNameSave = () => {
    if (clientName.trim() && selectedClientId) {
      dispatch(updateClientName({ id: selectedClientId, name: clientName }));
    }
    setIsEditing(false);
  };

  // handle project selection
  const handleProjectSelect = async (projectId: string) => {
    if (!selectedClientId) return;

    try {
      // Call the API to assign the project
      await assignProject({
        clientId: selectedClientId,
        projectId,
      }).unwrap();

      message.success(
        t('projectAssignedSuccessMessage', { defaultValue: 'Project assigned successfully' })
      );

      // Refetch client details to update the project list
      await refetchClientDetails();
    } catch (error: any) {
      message.error(
        error?.data?.message ||
          t('projectAssignedErrorMessage', { defaultValue: 'Failed to assign project' })
      );
    }
  };

  return (
    <Drawer
      title={
        isEditing ? (
          <Input
            value={clientName}
            onChange={handleNameChange}
            onBlur={handleNameSave}
            onPressEnter={handleNameSave}
            autoFocus
          />
        ) : (
          <Typography.Title
            level={2}
            style={{
              margin: 0,
              textTransform: 'capitalize',
              cursor: 'pointer',
            }}
            onClick={() => setIsEditing(true)}
          >
            {client?.name || t('unnamedClient', { defaultValue: 'Unnamed Client' })}
          </Typography.Title>
        )
      }
      width={900}
      open={isClientSettingsDrawerOpen}
      onClose={() => dispatch(toggleClientSettingsDrawer(null))}
    >
      <Flex vertical gap={24}>
        <Flex vertical gap={8}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t('assignProjectLabel', { defaultValue: 'Assign Project' })}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('assignProjectDescription', {
              defaultValue: 'Select a project to assign to this client',
            })}
          </Typography.Text>
          <Select
            showSearch
            value={null} // reset after selection
            onChange={handleProjectSelect}
            style={{ maxWidth: 400 }}
            placeholder={t('selectProjectPlaceholder', { defaultValue: 'Select a project' })}
            loading={isLoadingProjects || isAssigning}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={projectOptions}
            notFoundContent={
              isLoadingProjects
                ? t('loadingText', { defaultValue: 'Loading...' })
                : t('noProjectsFoundText', { defaultValue: 'No projects found' })
            }
          />
        </Flex>

        <Table
          columns={getClientPortalProjectColumns(t, avatarColors, token.colorPrimary)}
          dataSource={client?.projects}
          rowKey="id"
          className="custom-two-colors-row-table"
          rowClassName={() => 'custom-row'}
          scroll={{
            x: 1020,
          }}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: 20,
            pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
            size: 'small',
          }}
          loading={isLoadingClient}
        />
      </Flex>
    </Drawer>
  );
};

export { ClientPortalClientsSettingsDrawer };
