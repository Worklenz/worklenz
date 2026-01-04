import { Drawer, Typography, Input, Flex, Select, Table, message } from '@/shared/antd-imports';
import React, { useState, useMemo } from 'react';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';

import { useTranslation } from 'react-i18next';
import TableColumns from '../project-list/table-columns';
import {
  toggleClientSettingsDrawer,
  updateClientName,
} from '../../features/clients-portal/clients/clients-slice';
import { useGetProjectsQuery } from '../../api/projects/projects.v1.api.service';
import { 
  useGetClientDetailsQuery,
  useAssignProjectToClientMutation,
} from '../../api/client-portal/client-portal-api';
import { IProjectViewModel } from '../../types/project/projectViewModel.types';

const ClientPortalClientsSettingsDrawer = () => {
  // localization
  const { t } = useTranslation('client-portal-clients');

  // get drawer data from client reducer
  const {
    isClientSettingsDrawerOpen,
    selectedClientId,
  } = useAppSelector(state => state.clientsPortalReducer.clientsReducer);

  const dispatch = useAppDispatch();

  // Fetch client details
  const { 
    data: clientDetails, 
    isLoading: isLoadingClient,
    refetch: refetchClientDetails 
  } = useGetClientDetailsQuery(
    selectedClientId!,
    {
      skip: !selectedClientId,
    }
  );

  const client = clientDetails?.body;

  // Fetch available projects using RTK Query - get all projects for the team
  const { 
    data: availableProjects, 
    isLoading: isLoadingProjects,
    error: projectsError 
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
    // Debug: Check the actual response structure
    if (availableProjects) {
      console.log('[ClientPortalClientsSettingsDrawer] Full response:', availableProjects);
      console.log('[ClientPortalClientsSettingsDrawer] Response body:', availableProjects.body);
      console.log('[ClientPortalClientsSettingsDrawer] Response body.data:', availableProjects.body?.data);
      console.log('[ClientPortalClientsSettingsDrawer] Is loading:', isLoadingProjects);
    }

    // Check response structure - projects API returns IServerResponse<IProjectsViewModel>
    // Structure: response.body.data (array) and response.body.total
    const projectsData = availableProjects?.body?.data;
    
    if (!projectsData || !Array.isArray(projectsData) || projectsData.length === 0) {
      console.log('[ClientPortalClientsSettingsDrawer] No projects data or empty array');
      return [];
    }

    console.log('[ClientPortalClientsSettingsDrawer] Total projects from API:', projectsData.length);
    const assignedProjectIds = client?.projects?.map((p) => p.id).filter((id): id is string => !!id) || [];
    console.log('[ClientPortalClientsSettingsDrawer] Assigned project IDs:', assignedProjectIds);
    
    const filtered = projectsData
      .filter((project: IProjectViewModel) => {
        // Must have id and name
        if (!project.id || !project.name) return false;
        
        // Exclude if already assigned to this client
        if (assignedProjectIds.includes(project.id)) return false;
        
        // Exclude if already assigned to another client (client_id is set and not null)
        if (project.client_id) return false;
        
        return true;
      });
    
    console.log('[ClientPortalClientsSettingsDrawer] Available projects after filtering:', filtered.length);
    
    return filtered.map((project: IProjectViewModel) => ({
      label: project.name,
      value: project.id!,
    }));
  }, [availableProjects, client, isLoadingProjects]);

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

      message.success(t('projectAssignedSuccessMessage') || 'Project assigned successfully');
      
      // Refetch client details to update the project list
      await refetchClientDetails();
    } catch (error: any) {
      message.error(
        error?.data?.message || t('projectAssignedErrorMessage') || 'Failed to assign project'
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
            {client?.name || 'Unnamed Client'}
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
            {t('assignProjectLabel') || 'Assign Project'}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('assignProjectDescription') || 'Select a project to assign to this client'}
          </Typography.Text>
          <Select
            showSearch
            value={null} // reset after selection
            onChange={handleProjectSelect}
            style={{ maxWidth: 400 }}
            placeholder={t('selectProjectPlaceholder') || 'Select a project'}
            loading={isLoadingProjects || isAssigning}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={projectOptions}
            notFoundContent={
              isLoadingProjects
                ? t('loadingText') || 'Loading...'
                : t('noProjectsFoundText') || 'No projects found'
            }
          />
        </Flex>

        <Table
          columns={TableColumns() as any}
          dataSource={client?.projects}
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

export default ClientPortalClientsSettingsDrawer;
