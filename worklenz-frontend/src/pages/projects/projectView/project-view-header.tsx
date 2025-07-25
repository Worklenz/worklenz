import {
  ArrowLeftOutlined,
  BellFilled,
  BellOutlined,
  CalendarOutlined,
  DownOutlined,
  EditOutlined,
  ImportOutlined,
  SaveOutlined,
  SettingOutlined,
  SyncOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@ant-design/pro-components';
import { Button, Dropdown, Flex, Tag, Tooltip, Typography } from 'antd';
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
import CSVImportModal from '@/components/csv-import/csv-import-modal';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { addTaskCardToTheTop, fetchBoardTaskGroups } from '@/features/board/board-slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';

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

  const handleImportCSV = () => {
    setCsvImportModalVisible(true);
  };

  const handleCSVImportClose = () => {
    setCsvImportModalVisible(false);
  };

  const handleCSVImportComplete = () => {
    // Refresh the task list after successful import
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
      key: 'import-csv',
      label: (
        <div style={{ width: '100%', margin: 0, padding: 0 }} onClick={handleImportCSV}>
          <ImportOutlined /> {t('importFromCSV')}
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
        projectId={selectedProject?.id || ''}
        onClose={handleCSVImportClose}
        onImportComplete={handleCSVImportComplete}
      />
    </>
  );
};

export default ProjectViewHeader;
