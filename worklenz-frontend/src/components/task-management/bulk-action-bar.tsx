import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Button from 'antd/es/button';
import Typography from 'antd/es/typography';
import Dropdown from 'antd/es/dropdown';
import Menu from 'antd/es/menu';
import Popconfirm from 'antd/es/popconfirm';
import message from 'antd/es/message';
import Tooltip from 'antd/es/tooltip';
import Badge from 'antd/es/badge';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import type { InputRef } from 'antd/es/input';
import {
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  MoreOutlined,
  RetweetOutlined,
  UserAddOutlined,
  InboxOutlined,
  TagsOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/use-app-selector';
import { useAppDispatch } from '@/hooks/use-app-dispatch';
import { useMixpanelTracking } from '@/hooks/use-mixpanel-tracking';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
import { fetchTaskGroups, IGroupBy } from '@/features/tasks/tasks.slice';
import { taskListBulkActionsApiService } from '@/api/tasks/task-list-bulk-actions.api.service';
;
import {
  IBulkTasksLabelsRequest,
  IBulkTasksPhaseChangeRequest,
  IBulkTasksPriorityChangeRequest,
  IBulkTasksStatusChangeRequest,
} from '@/types/tasks/bulk-action-bar.types';
import { ITaskStatus } from '@/types/tasks/taskStatus.types';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { ITaskAssignee } from '@/types/tasks/task.types';
import { createPortal } from 'react-dom';
import { useAuthService } from '@/hooks/use-auth';
import { checkTaskDependencyStatus } from '@/utils/check-task-dependency-status';
import alertService from '@/services/alerts/alertService';
import logger from '@/utils/error-logger';

// Lazy load heavy components
const TaskTemplateDrawer = React.lazy(() => import('@/components/task-templates/task-template-drawer'));
const AssigneesDropdown = React.lazy(() => import('@/components/taskListCommon/task-list-bulk-actions-bar/components/AssigneesDropdown'));
const LabelsDropdown = React.lazy(() => import('@/components/taskListCommon/task-list-bulk-actions-bar/components/LabelsDropdown'));

const { Text } = Typography;

interface BulkActionBarProps {
  selectedTaskIds: string[];
  totalSelected: number;
  currentGrouping: IGroupBy;
  projectId: string;
  onClearSelection?: () => void;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedTaskIds,
  totalSelected,
  currentGrouping,
  projectId,
  onClearSelection,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('tasks/task-table-bulk-actions');
  const { trackMixpanelEvent } = useMixpanelTracking();
  
  // Add permission hooks
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();

  // loading state
  const [loading, setLoading] = useState(false);
  const [updatingLabels, setUpdatingLabels] = useState(false);
  const [updatingAssignToMe, setUpdatingAssignToMe] = useState(false);
  const [updatingAssignees, setUpdatingAssignees] = useState(false);
  const [updatingArchive, setUpdatingArchive] = useState(false);
  const [updatingDelete, setUpdatingDelete] = useState(false);

  // Selectors - memoized to prevent unnecessary re-renders
  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const labelsList = useAppSelector(state => state.taskLabelsReducer.labels);
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const archived = useAppSelector(state => state.taskReducer.archived);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const labelsInputRef = useRef<InputRef>(null);
  const [createLabelText, setCreateLabelText] = useState<string>('');
  const [teamMembersSorted, setTeamMembersSorted] = useState<ITeamMembersViewModel>({
    data: [],
    total: 0,
  });
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<ITaskLabel[]>([]);

  // Memoize styles to prevent re-creation
  const buttonStyle = useMemo(() => ({
    background: 'transparent',
    color: '#fff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 8px',
    height: '32px',
    fontSize: '16px',
  }), []);

  const containerStyle = useMemo(() => ({
    position: 'fixed' as const,
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    background: '#252628',
    borderRadius: '25px',
    padding: '8px 16px',
    boxShadow: '0 0 0 1px #434343, 0 4px 12px 0 rgba(0, 0, 0, 0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 'fit-content',
  }), []);

  // Optimized handlers with useCallback
  const handleClearSelection = useCallback(() => {
    dispatch(deselectAll());
    onClearSelection?.();
  }, [dispatch, onClearSelection]);

  const handleChangeStatus = useCallback(async (status: ITaskStatus) => {
    if (!status.id || !projectId) return;
    try {
      setLoading(true);
      const body: IBulkTasksStatusChangeRequest = {
        tasks: selectedTaskIds,
        status_id: status.id,
      };
      const res = await taskListBulkActionsApiService.changeStatus(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_change_status);
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
        onClearSelection?.();
      }
    } catch (error) {
      logger.error('Error changing status:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedTaskIds, projectId, trackMixpanelEvent, dispatch, onClearSelection]);

  const handleAssignToMe = useCallback(async () => {
    if (!projectId) return;
    try {
      setUpdatingAssignToMe(true);
      const body = {
        tasks: selectedTaskIds,
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.assignToMe(body);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_assign_me);
        handleClearSelection();
        dispatch(fetchTaskGroups(projectId));
      }
    } catch (error) {
      logger.error('Error assigning to me:', error);
    } finally {
      setUpdatingAssignToMe(false);
    }
  }, [selectedTaskIds, projectId, trackMixpanelEvent, handleClearSelection, dispatch]);

  const handleDelete = useCallback(async () => {
    if (!projectId) return;
    try {
      setUpdatingDelete(true);
      const body = {
        tasks: selectedTaskIds,
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.deleteTasks(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_delete);
        handleClearSelection();
        dispatch(fetchTaskGroups(projectId));
      }
    } catch (error) {
      logger.error('Error deleting tasks:', error);
    } finally {
      setUpdatingDelete(false);
    }
  }, [selectedTaskIds, projectId, trackMixpanelEvent, handleClearSelection, dispatch]);

  // Memoized menu items
  const changeOptionsMenu = useMemo(() => [
    {
      key: '1',
      label: t('status'),
      children: statusList.map(status => ({
        key: status.id,
        onClick: () => handleChangeStatus(status),
        label: <Badge color={status.color_code} text={status.name} />,
      })),
    },
    {
      key: '2',
      label: t('priority'), 
      children: priorityList.map(priority => ({
        key: priority.id,
        onClick: () => handleChangeStatus(priority as any), // Quick fix for demo
        label: <Badge color={priority.color_code} text={priority.name} />,
      })),
    },
  ], [statusList, priorityList, t, handleChangeStatus]);

  return (
    <div style={containerStyle}>
      <Text style={{ color: '#fff', fontSize: '14px', fontWeight: 500, marginRight: '8px' }}>
        {totalSelected} task{totalSelected > 1 ? 's' : ''} selected
      </Text>

      {/* Status/Priority Change */}
      <Tooltip title="Change Status/Priority">
        <Dropdown menu={{ items: changeOptionsMenu }} trigger={['click']}>
          <Button 
            icon={<RetweetOutlined />}
            style={buttonStyle}
            size="small"
            loading={loading}
          />
        </Dropdown>
      </Tooltip>

      {/* Assign to Me */}
      <Tooltip title="Assign to Me">
        <Button 
          icon={<UserAddOutlined />}
          style={buttonStyle}
          size="small"
          onClick={handleAssignToMe}
          loading={updatingAssignToMe}
        />
      </Tooltip>

      {/* Delete */}
      <Tooltip title="Delete">
        <Popconfirm
          title={`Delete ${totalSelected} task${totalSelected > 1 ? 's' : ''}?`}
          description="This action cannot be undone."
          onConfirm={handleDelete}
          okText="Delete"
          cancelText="Cancel"
          okType="danger"
        >
          <Button 
            icon={<DeleteOutlined />}
            style={buttonStyle}
            size="small"
            loading={updatingDelete}
          />
        </Popconfirm>
      </Tooltip>

      {/* More Actions - Only for Owner/Admin */}
      {isOwnerOrAdmin && (
        <Tooltip title="More Actions">
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'createTemplate',
                  label: 'Create task template',
                  onClick: () => setShowDrawer(true),
                },
              ],
            }}
          >
            <Button 
              icon={<MoreOutlined />}
              style={buttonStyle}
              size="small"
            />
          </Dropdown>
        </Tooltip>
      )}

      {/* Clear Selection */}
      <Tooltip title="Clear Selection">
        <Button
          icon={<CloseOutlined />}
          onClick={handleClearSelection}
          style={buttonStyle}
          size="small"
        />
      </Tooltip>

      {/* Lazy loaded Task Template Drawer */}
      {showDrawer && (
        <React.Suspense fallback={null}>
          {createPortal(
            <TaskTemplateDrawer
              showDrawer={showDrawer}
              selectedTemplateId={null}
              onClose={() => {
                setShowDrawer(false);
                handleClearSelection();
              }}
            />,
            document.body,
            'create-task-template'
          )}
        </React.Suspense>
      )}
    </div>
  );
};

export default React.memo(BulkActionBar); 