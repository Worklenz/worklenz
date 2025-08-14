import {
  ArrowLeftOutlined,
  BellFilled,
  BellOutlined,
  CalendarOutlined,
  DownOutlined,
  EditOutlined,
  ImportOutlined,
  SaveOutlined,
  DownloadOutlined,
  SettingOutlined,
  SyncOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@ant-design/pro-components';
import { Button, Dropdown, Flex, Tag, Tooltip, Typography, notification } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { colors } from '@/styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import { setProject, setImportTaskTemplateDrawerOpen, setRefreshTimestamp } from '@features/project/project.slice';
import { addTask, fetchTaskGroups, fetchTaskListColumns, IGroupBy } from '@features/tasks/tasks.slice';
import ProjectStatusIcon from '@/components/common/project-status-icon/project-status-icon';
import { formatDate } from '@/utils/timeUtils';
import { toggleSaveAsTemplateDrawer } from '@/features/projects/projectsSlice';
import SaveProjectAsTemplate from '@/components/save-project-as-template/save-project-as-template';
import {
  fetchProjectData,
  toggleProjectDrawer,
  setProjectId,
} from '@/features/project/project-drawer.slice';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { useState } from 'react';
import { ITaskCreateRequest } from '@/types/tasks/task-create-request.types';
import { DEFAULT_TASK_NAME, UNMAPPED } from '@/shared/constants';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { getGroupIdByGroupedColumn } from '@/services/task-list/taskList.service';
import logger from '@/utils/errorLogger';
import { createPortal } from 'react-dom';
import ImportTaskTemplate from '@/components/task-templates/import-task-template';
import ProjectDrawer from '@/components/projects/project-drawer/project-drawer';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { addTaskCardToTheTop, fetchBoardTaskGroups } from '@/features/board/board-slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import CSVImportModal from '@/components/csv-import/csv-import-modal';

const ProjectViewHeader = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('project-view/project-view-header');
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const { tab } = useTabSearchParam();

  const { socket } = useSocket();

  const {
    project: selectedProject,
    projectId,
  } = useAppSelector(state => state.projectReducer);
  const { loadingGroups, groupBy } = useAppSelector(state => state.taskReducer);

  const [creatingTask, setCreatingTask] = useState(false);
  const [csvImportModalVisible, setCsvImportModalVisible] = useState(false);

  // Common export function for different formats
  const exportProject = async (format: 'csv' | 'excel') => {
    if (!projectId) return;
    
    // Create a unique notification key for this export
    const notificationKey = `export-${format}-${Date.now()}`;
    
    // Show initial loading notification
    notification.info({
      key: notificationKey,
      message: t('exportProject', 'Export'),
      description: t('exportStarted', 'Preparing export...'),
      duration: 0 // Keep until explicitly closed
    });
    
    try {
      // Setup API call
      const { getCsrfToken } = await import('@/api/api-client');
      const csrfToken = getCsrfToken ? getCsrfToken() ?? '' : '';
      const config = await import('@/config/env');
      const apiUrl = config.default.apiUrl;
      
      // Determine endpoint based on format
      const endpoint = format === 'csv' 
        ? `${apiUrl}/api/v1/tasks/export-csv/${projectId}`
        : `${apiUrl}/api/v1/tasks/export-excel/${projectId}`;
      
      // Create controller for timeouts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      // Make the API request
      let response;
      try {
        // Set the appropriate accept header based on the format
        const acceptHeader = format === 'csv' 
          ? 'text/csv' 
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          
        response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': acceptHeader,
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
          signal: controller.signal
        });
        
        // Clear timeout since request completed
        clearTimeout(timeoutId);
        
        // Handle error responses
        if (!response.ok) {
          let errorMessage = `Status: ${response.status}`;
          let errorDetails = '';
          
          try {
            // Try to parse error details from response
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorJson = await response.json();
              errorDetails = errorJson.message || JSON.stringify(errorJson);
            } else {
              const errorText = await response.text();
              if (errorText && errorText.length < 100) { // Only use text if it's reasonably short
                errorDetails = errorText;
              }
            }
          } catch (parseError) {
            console.error('Error parsing error response:', parseError);
          }
          
          // Show appropriate error based on status code
          let errorDescription = t('exportFailed', 'Export failed. Please try again.');
          if (response.status === 404) {
            errorDescription = t('projectNotFound', 'Project not found or you don\'t have access.');
          } else if (response.status === 400) {
            errorDescription = t('invalidRequest', 'Invalid request. Please try again.');
          } else if (response.status >= 500) {
            errorDescription = t('serverError', 'Server error. Please try again later.');
          }
          
          if (errorDetails) {
            errorDescription += ` (${errorDetails})`;
          }
          
          notification.error({
            key: notificationKey,
            message: t('exportProject', 'Export'),
            description: errorDescription,
          });
          
          throw new Error(`Failed to export CSV. ${errorMessage} - ${errorDetails}`);
        }
      } catch (fetchError) {
        // Handle network errors or aborted requests
        if (typeof fetchError === 'object' && fetchError !== null && 'name' in fetchError && (fetchError as { name?: string }).name === 'AbortError') {
          notification.error({
            key: notificationKey,
            message: t('exportProject', 'Export'),
            description: t('exportTimeout', 'Export timed out. The server might be busy or the dataset is too large.'),
          });
        } else {
          notification.error({
            key: notificationKey,
            message: t('exportProject', 'Export'),
            description: t('networkError', 'Network error. Please check your connection and try again.'),
          });
        }
        throw fetchError;
      }
      
      // Process successful response
      try {
        // First check content type to ensure we got CSV (accepting various valid MIME types)
        const contentType = response.headers.get('content-type');
        
        // Define valid content types for both CSV and Excel
        const validCsvTypes = ['text/csv', 'application/csv', 'text/plain', 'text/x-csv', 'application/x-csv'];
        const validExcelTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
        
        // Select appropriate valid types based on the format
        const validTypes = format === 'csv' ? validCsvTypes : validExcelTypes;
        
        const isValidContentType = contentType && 
          validTypes.some(type => contentType.toLowerCase().includes(type));
          
        if (!isValidContentType) {
          console.error(`Unexpected content type: ${contentType}`);
          notification.error({
            key: notificationKey,
            message: t('exportProject', 'Export'),
            description: t('invalidResponseFormat', 'Received invalid data format from server.'),
          });
          throw new Error('Invalid content type received');
        }
        
        // Get blob data with timeout and error handling
        let blob;
        const blobTimeoutId = setTimeout(() => {
          notification.error({
            key: notificationKey,
            message: t('exportProject', 'Export'),
            description: t('processingTimeout', 'Processing timed out. The file may be too large.'),
          });
        }, 10000); // 10 second timeout for blob processing
        
        try {
          blob = await response.blob();
          clearTimeout(blobTimeoutId);
        } catch (blobError) {
          clearTimeout(blobTimeoutId);
          console.error('Error getting blob:', blobError);
          notification.error({
            key: notificationKey,
            message: t('exportProject', 'Export'),
            description: t('blobError', 'Error processing response data. Please try again.'),
          });
          throw new Error('Failed to process response data');
        }
        
        // Check blob size
        if (!blob || blob.size === 0) {
          notification.warning({
            key: notificationKey,
            message: t('exportProject', 'Export'),
            description: t('noData', 'No task data available for export.'),
          });
          throw new Error('Empty blob received');
        }
        
        // Create filename
        const safeProjectName = selectedProject?.name 
          ? selectedProject.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
          : `project-${projectId}`;
        
        // Use appropriate file extension based on format
        const extension = format === 'csv' ? 'csv' : 'xlsx';
        const filename = `${safeProjectName}-tasks-${new Date().toISOString().split('T')[0]}.${extension}`;
        
        // Create and trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
        
        // Show success notification
        notification.success({
          key: notificationKey,
          message: t('exportProject', 'Export'),
          description: t('exportCompleted', 'Export completed successfully!'),
        });
      } catch (blobError) {
        console.error('Error processing blob:', blobError);
        
        // Only show error notification if it's not a timeout (which already has its own notification)
        if (!(typeof blobError === 'object' && blobError !== null && 'name' in blobError && (blobError as { name?: string }).name === 'AbortError')) {
          notification.error({
            key: notificationKey,
            message: t('exportProject', 'Export'),
            description: t('processingError', 'Error processing the export data. Please try again.'),
          });
        }
        throw blobError;
      }
    } catch (error) {
      console.error(`${format.toUpperCase()} export error:`, error);
      // Don't show duplicate error messages - we've already shown specific ones above
    }
  };

  const handleRefresh = () => {
    if (!projectId) return;
    switch (tab) {
      case 'tasks-list':
        dispatch(fetchTaskListColumns(projectId));
        dispatch(fetchPhasesByProjectId(projectId))
        dispatch(fetchTaskGroups(projectId));
        break;
      case 'board':
        dispatch(fetchBoardTaskGroups(projectId));
        break;
      case 'project-insights-member-overview':
        dispatch(setRefreshTimestamp());
        break;
      case 'all-attachments':
        dispatch(setRefreshTimestamp());
        break;
      case 'members':
        dispatch(setRefreshTimestamp());
        break;
      case 'updates':
        dispatch(setRefreshTimestamp());
        break;
      default:
        break;
    }
  };

  const handleSubscribe = () => {
    if (selectedProject?.id) {
      const newSubscriptionState = !selectedProject.subscribed;

      dispatch(setProject({ ...selectedProject, subscribed: newSubscriptionState }));

      socket?.emit(SocketEvents.PROJECT_SUBSCRIBERS_CHANGE.toString(), {
        project_id: selectedProject.id,
        user_id: currentSession?.id,
        team_member_id: currentSession?.team_member_id,
        mode: newSubscriptionState ? 1 : 0,
      });
    }
  };

  const handleSettingsClick = () => {
    if (selectedProject?.id) {
      dispatch(setProjectId(selectedProject.id));
      dispatch(fetchProjectData(selectedProject.id));
      dispatch(toggleProjectDrawer());
    }
  };

  const handleCreateTask = () => {
    try {
      setCreatingTask(true);

      const body: ITaskCreateRequest = {
        name: DEFAULT_TASK_NAME,
        project_id: selectedProject?.id,
        reporter_id: currentSession?.id,
        team_id: currentSession?.team_id,
      };

      socket?.once(SocketEvents.QUICK_TASK.toString(), (task: IProjectTask) => {
        if (task.id) {
          dispatch(setSelectedTaskId(task.id));
          dispatch(setShowTaskDrawer(true));

          const groupId = groupBy === IGroupBy.PHASE ? UNMAPPED : getGroupIdByGroupedColumn(task);
          if (groupId) {
            if (tab === 'board') {
              dispatch(addTaskCardToTheTop({ sectionId: groupId, task }));
            } else {
              dispatch(addTask({ task, groupId }));
            }
            socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
          }
        }
      });
      socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
    } catch (error) {
      logger.error('Error creating task', error);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleImportTaskTemplate = () => {
    dispatch(setImportTaskTemplateDrawerOpen(true));
  };

  const handleCSVImport = () => {
    setCsvImportModalVisible(true);
  };

  const handleCSVImportComplete = () => {
    setCsvImportModalVisible(false);
    handleRefresh();
  };

  const dropdownItems = [
    {
      key: 'import',
      label: (
        <div style={{ width: '100%', margin: 0, padding: 0 }} onClick={handleImportTaskTemplate}>
          <ImportOutlined /> {t('importTask')}
        </div>
      ),
    },
    {
      key: 'csv-import',
      label: (
        <div style={{ width: '100%', margin: 0, padding: 0 }} onClick={handleCSVImport}>
          <ImportOutlined /> Import from CSV
        </div>
      ),
    },
  ];

  const renderProjectAttributes = () => (
    <Flex gap={8} align="center">
      {selectedProject?.category_id && (
        <Tag color={colors.vibrantOrange} style={{ borderRadius: 24, paddingInline: 8, margin: 0 }}>
          {selectedProject.category_name}
        </Tag>
      )}

      {selectedProject?.status && (
        <Tooltip title={selectedProject.status}>
          <ProjectStatusIcon
            iconName={selectedProject.status_icon || ''}
            color={selectedProject.status_color || ''}
          />
        </Tooltip>
      )}

      {(selectedProject?.start_date || selectedProject?.end_date) && (
        <Tooltip
          title={
            <Typography.Text style={{ color: colors.white }}>
              {selectedProject?.start_date &&
                `${t('startDate')}: ${formatDate(new Date(selectedProject.start_date))}`}
              {selectedProject?.end_date && (
                <>
                  <br />
                  {`${t('endDate')}: ${formatDate(new Date(selectedProject.end_date))}`}
                </>
              )}
            </Typography.Text>
          }
        >
          <CalendarOutlined style={{ fontSize: 16 }} />
        </Tooltip>
      )}

      {selectedProject?.notes && (
        <Typography.Text type="secondary">{selectedProject.notes}</Typography.Text>
      )}
    </Flex>
  );

  const renderHeaderActions = () => (
    <Flex gap={8} align="center">
      <Tooltip title={t('refreshProject')}>
        <Button
          shape="circle"
          icon={<SyncOutlined spin={loadingGroups} />}
          onClick={handleRefresh}
        />
      </Tooltip>

      {/* Export Button Dropdown - after Refresh button */}
      <Dropdown
        menu={{
          items: [
            {
              key: 'csv',
              label: t('exportCSV', 'Export as CSV'),
              onClick: () => exportProject('csv')
            },
            {
              key: 'excel',
              label: t('exportExcel', 'Export as Excel'),
              onClick: () => exportProject('excel')
            },
          ],
        }}
        trigger={['click']}
      >
        <Tooltip title={t('exportProject', 'Export')}>
          <Button shape="circle">
            <DownloadOutlined />
          </Button>
        </Tooltip>
      </Dropdown>

      {(isOwnerOrAdmin) && (
        <Tooltip title={t('saveAsTemplate')}>
          <Button
            shape="circle"
            icon={<SaveOutlined />}
            onClick={() => dispatch(toggleSaveAsTemplateDrawer())}
          />
        </Tooltip>
      )}

      <Tooltip title={t('projectSettings')}>
        <Button shape="circle" icon={<SettingOutlined />} onClick={handleSettingsClick} />
      </Tooltip>

      <Tooltip title={t('subscribe')}>
        <Button
          shape="round"
          icon={selectedProject?.subscribed ? <BellFilled /> : <BellOutlined />}
          onClick={handleSubscribe}
        >
          {selectedProject?.subscribed ? t('unsubscribe') : t('subscribe')}
        </Button>
      </Tooltip>

      {(isOwnerOrAdmin || isProjectManager) && (
        <Button
          type="primary"
          icon={<UsergroupAddOutlined />}
          onClick={() => dispatch(toggleProjectMemberDrawer())}
        >
          {t('invite')}
        </Button>
      )}

      {isOwnerOrAdmin ? (
        <Dropdown.Button
          loading={creatingTask}
          type="primary"
          icon={<DownOutlined />}
          menu={{ items: dropdownItems }}
          trigger={['click']}
          onClick={handleCreateTask}
        >
          <EditOutlined /> {t('createTask')}
        </Dropdown.Button>
      ) : (
        <Button
          loading={creatingTask}
          type="primary"
          icon={<EditOutlined />}
          onClick={handleCreateTask}
        >
          {t('createTask')}
        </Button>
      )}
    </Flex>
  );

  return (
    <>
      <PageHeader
        className="site-page-header"
        title={
          <Flex gap={8} align="center">
            <ArrowLeftOutlined
              style={{ fontSize: 16 }}
              onClick={() => navigate('/worklenz/projects')}
            />
            <Typography.Title level={4} style={{ marginBlockEnd: 0, marginInlineStart: 12 }}>
              {selectedProject?.name}
            </Typography.Title>
            {renderProjectAttributes()}
          </Flex>
        }
        style={{ paddingInline: 0, marginBlockEnd: 12 }}
        extra={renderHeaderActions()}
      />
      {createPortal(<ProjectDrawer onClose={() => { }} />, document.body, 'project-drawer')}
      {createPortal(<ImportTaskTemplate />, document.body, 'import-task-template')}
      {createPortal(<SaveProjectAsTemplate />, document.body, 'save-project-as-template')}
      <CSVImportModal
        visible={csvImportModalVisible}
        projectId={projectId || ''}
        onClose={() => setCsvImportModalVisible(false)}
        onImportComplete={handleCSVImportComplete}
      />
    </>
  );
};

export default ProjectViewHeader;
