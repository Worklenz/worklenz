import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Dropdown, Flex, Tooltip, Button, InputRef, CheckboxChangeEvent } from 'antd/es';
import {
  RetweetOutlined,
  TagsOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
  InboxOutlined,
  DeleteOutlined,
  MoreOutlined,
  CloseCircleOutlined,
} from '@/shared/antd-imports';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { colors } from '@/styles/colors';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
import { fetchTaskGroups } from '@/features/tasks/tasks.slice';
import { taskListBulkActionsApiService } from '@/api/tasks/task-list-bulk-actions.api.service';
import {
  evt_project_task_list_bulk_archive,
  evt_project_task_list_bulk_assign_me,
  evt_project_task_list_bulk_assign_members,
  evt_project_task_list_bulk_change_phase,
  evt_project_task_list_bulk_change_priority,
  evt_project_task_list_bulk_change_status,
  evt_project_task_list_bulk_delete,
  evt_project_task_list_bulk_update_labels,
} from '@/shared/worklenz-analytics-events';
import {
  IBulkTasksLabelsRequest,
  IBulkTasksPhaseChangeRequest,
  IBulkTasksPriorityChangeRequest,
  IBulkTasksStatusChangeRequest,
} from '@/types/tasks/bulk-action-bar.types';
import { ITaskStatus } from '@/types/tasks/taskStatus.types';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';

import './task-list-bulk-actions-bar.css';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import TaskTemplateDrawer from '@/components/task-templates/task-template-drawer';
import { createPortal } from 'react-dom';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import AssigneesDropdown from './components/AssigneesDropdown';
import LabelsDropdown from './components/LabelsDropdown';
import { sortTeamMembers } from '@/utils/sort-team-members';
import logger from '@/utils/errorLogger';
import ConvertToSubtaskDrawer from '@/components/task-list-common/convert-to-subtask-drawer/convert-to-subtask-drawer';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { useAuthService } from '@/hooks/useAuth';
import CustomColumnModal from '@/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/custom-column-modal';
import { checkTaskDependencyStatus } from '@/utils/check-task-dependency-status';
import alertService from '@/services/alerts/alertService';

interface ITaskAssignee {
  id: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  team_member_id: string;
  project_member_id: string;
}

const TaskListBulkActionsBar = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('tasks/task-table-bulk-actions');
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Add permission hooks near other hooks
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();

  // loading state
  const [loading, setLoading] = useState(false);
  const [updatingLabels, setUpdatingLabels] = useState(false);
  const [updatingAssignToMe, setUpdatingAssignToMe] = useState(false);
  const [updatingAssignees, setUpdatingAssignees] = useState(false);
  const [updatingArchive, setUpdatingArchive] = useState(false);
  const [updatingDelete, setUpdatingDelete] = useState(false);

  // Selectors
  const { selectedTaskIdsList } = useAppSelector(state => state.bulkActionReducer);
  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const labelsList = useAppSelector(state => state.taskLabelsReducer.labels);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const archived = useAppSelector(state => state.taskReducer.archived);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const labelsInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [createLabelText, setCreateLabelText] = useState<string>('');

  const [teamMembersSorted, setTeamMembersSorted] = useState<ITeamMembersViewModel>({
    data: [],
    total: 0,
  });
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<ITaskLabel[]>([]);

  // Add refs for tooltip elements
  const changeStatusRef = useRef(null);
  const changeLabelRef = useRef(null);
  const assignToMeRef = useRef(null);
  const changeAssigneesRef = useRef(null);
  const archiveRef = useRef(null);
  const deleteRef = useRef(null);
  const moreOptionsRef = useRef(null);
  const deselectAllRef = useRef(null);

  // Handlers
  const handleChangeStatus = async (status: ITaskStatus) => {
    if (!status.id || !projectId) return;
    try {
      setLoading(true);

      const body: IBulkTasksStatusChangeRequest = {
        tasks: selectedTaskIdsList,
        status_id: status.id,
      };
      const res = await taskListBulkActionsApiService.changeStatus(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_change_status);
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
      }
      for (const it of selectedTaskIdsList) {
        const canContinue = await checkTaskDependencyStatus(it, status.id);
        if (!canContinue) {
          if (selectedTaskIdsList.length > 1) {
            alertService.warning(
              'Incomplete Dependencies!',
              'Some tasks were not updated. Please ensure all dependent tasks are completed before proceeding.'
            );
          } else {
            alertService.error(
              'Task is not completed',
              'Please complete the task dependencies before proceeding'
            );
          }
          return;
        }
      }
    } catch (error) {
      logger.error('Error changing status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePriority = async (priority: ITaskPriority) => {
    if (!priority.id || !projectId) return;
    try {
      setLoading(true);
      const body: IBulkTasksPriorityChangeRequest = {
        tasks: selectedTaskIdsList,
        priority_id: priority.id,
      };
      const res = await taskListBulkActionsApiService.changePriority(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_change_priority);
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
      }
    } catch (error) {
      logger.error('Error changing priority:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePhase = async (phase: ITaskPhase) => {
    if (!phase.id || !projectId) return;
    try {
      setLoading(true);
      const body: IBulkTasksPhaseChangeRequest = {
        tasks: selectedTaskIdsList,
        phase_id: phase.id,
      };
      const res = await taskListBulkActionsApiService.changePhase(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_change_phase);
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
      }
    } catch (error) {
      logger.error('Error changing phase:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToMe = async () => {
    if (!projectId) return;
    try {
      setUpdatingAssignToMe(true);
      const body = {
        tasks: selectedTaskIdsList,
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.assignToMe(body);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_assign_me);
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
      }
    } catch (error) {
      logger.error('Error assigning to me:', error);
    } finally {
      setUpdatingAssignToMe(false);
    }
  };

  const handleArchive = async () => {
    if (!projectId) return;
    try {
      setUpdatingArchive(true);
      const body = {
        tasks: selectedTaskIdsList,
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.archiveTasks(body, archived);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_archive);
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
      }
    } catch (error) {
      logger.error('Error archiving tasks:', error);
    } finally {
      setUpdatingArchive(false);
    }
  };

  const handleChangeAssignees = async (selectedAssignees: ITeamMemberViewModel[]) => {
    if (!projectId) return;
    try {
      setUpdatingAssignees(true);
      const body = {
        tasks: selectedTaskIdsList,
        project_id: projectId,
        members: selectedAssignees.map(member => ({
          id: member.id,
          name: member.name || '',
          email: member.email,
          avatar_url: member.avatar_url,
        })) as ITaskAssignee[],
      };
      const res = await taskListBulkActionsApiService.assignTasks(body);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_assign_members);
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
      }
    } catch (error) {
      logger.error('Error assigning tasks:', error);
    } finally {
      setUpdatingAssignees(false);
    }
  };

  const handleDelete = async () => {
    if (!projectId) return;
    try {
      setUpdatingDelete(true);
      const body = {
        tasks: selectedTaskIdsList,
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.deleteTasks(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_delete);
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
      }
    } catch (error) {
      logger.error('Error deleting tasks:', error);
    } finally {
      setUpdatingDelete(false);
    }
  };

  // Menu Generators
  const getChangeOptionsMenu = () => [
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
        onClick: () => handleChangePriority(priority),
        label: <Badge color={priority.color_code} text={priority.name} />,
      })),
    },
    {
      key: '3',
      label: t('phase'),
      children: phaseList.map(phase => ({
        key: phase.id,
        onClick: () => handleChangePhase(phase),
        label: <Badge color={phase.color_code} text={phase.name} />,
      })),
    },
  ];

  const getLabel = () => {
    const word = selectedTaskIdsList.length < 2 ? t('taskSelected') : t('tasksSelected');
    return `${selectedTaskIdsList.length} ${word}`;
  };
  useEffect(() => {
    if (members?.data && assigneeDropdownOpen) {
      let sortedMembers = sortTeamMembers(members.data);
      setTeamMembersSorted({ data: sortedMembers, total: members.total });
    }
  }, [assigneeDropdownOpen, members?.data]);

  const getAssigneesMenu = () => {
    return (
      <AssigneesDropdown
        members={teamMembersSorted?.data || []}
        themeMode={themeMode}
        onApply={handleChangeAssignees}
        onClose={() => setAssigneeDropdownOpen(false)}
        t={t}
      />
    );
  };

  const buttonStyle = { background: colors.transparent, color: colors.white };

  const handleLabelChange = (e: CheckboxChangeEvent, label: ITaskLabel) => {
    if (e.target.checked) {
      setSelectedLabels(prev => [...prev, label]);
    } else {
      setSelectedLabels(prev => prev.filter(l => l.id !== label.id));
    }
  };

  const applyLabels = async () => {
    if (!projectId) return;
    try {
      setUpdatingLabels(true);
      const body: IBulkTasksLabelsRequest = {
        tasks: selectedTaskIdsList,
        labels: selectedLabels,
        text:
          selectedLabels.length > 0
            ? null
            : createLabelText.trim() !== ''
              ? createLabelText.trim()
              : null,
      };
      const res = await taskListBulkActionsApiService.assignLabels(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_update_labels);
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
        dispatch(fetchLabels()); // Fallback: refetch all labels
        dispatch(fetchTaskGroups(projectId));
        setCreateLabelText('');
        setSelectedLabels([]);
      }
    } catch (error) {
      logger.error('Error updating labels:', error);
    } finally {
      setUpdatingLabels(false);
    }
  };

  const labelsDropdownContent = (
    <LabelsDropdown
      labelsList={labelsList}
      themeMode={themeMode}
      createLabelText={createLabelText}
      selectedLabels={selectedLabels}
      labelsInputRef={labelsInputRef as React.RefObject<InputRef>}
      onLabelChange={handleLabelChange}
      onCreateLabelTextChange={value => setCreateLabelText(value)}
      onApply={applyLabels}
      t={t}
      loading={updatingLabels}
    />
  );

  const onAssigneeDropdownOpenChange = (open: boolean) => {
    if (!open) {
      setAssigneeDropdownOpen(false);
    } else {
      setAssigneeDropdownOpen(true);
    }
  };
  return (
    <div className={`bulk-actions ${selectedTaskIdsList.length > 0 ? 'open' : ''}`}>
      <Flex className="bulk-actions-inner" align="center" justify="center" gap={12}>
        <Flex>
          <span style={{ fontSize: 14, fontWeight: 500 }}>{getLabel()}</span>
        </Flex>

        <Flex align="center">
          <Tooltip title={t('changeStatus')} getPopupContainer={() => changeStatusRef.current!}>
            <div ref={changeStatusRef}>
              <Dropdown
                menu={{ items: getChangeOptionsMenu() }}
                placement="bottom"
                arrow
                trigger={['click']}
                getPopupContainer={() => changeStatusRef.current!}
              >
                <Button
                  icon={<RetweetOutlined />}
                  className="borderless-icon-btn"
                  style={buttonStyle}
                  loading={loading}
                />
              </Dropdown>
            </div>
          </Tooltip>

          <Tooltip title={t('changeLabel')} getPopupContainer={() => changeLabelRef.current!}>
            <div ref={changeLabelRef}>
              <Dropdown
                dropdownRender={() => labelsDropdownContent}
                placement="top"
                arrow
                trigger={['click']}
                onOpenChange={value => {
                  if (!value) {
                    setSelectedLabels([]);
                  }
                }}
                getPopupContainer={() => changeLabelRef.current!}
              >
                <Button
                  icon={<TagsOutlined />}
                  className="borderless-icon-btn"
                  style={buttonStyle}
                  loading={updatingLabels}
                />
              </Dropdown>
            </div>
          </Tooltip>

          <Tooltip title={t('assignToMe')} getPopupContainer={() => assignToMeRef.current!}>
            <div ref={assignToMeRef}>
              <Button
                icon={<UserAddOutlined />}
                className="borderless-icon-btn"
                style={buttonStyle}
                onClick={handleAssignToMe}
                loading={updatingAssignToMe}
              />
            </div>
          </Tooltip>

          <Tooltip
            title={t('changeAssignees')}
            getPopupContainer={() => changeAssigneesRef.current!}
          >
            <div ref={changeAssigneesRef}>
              <Dropdown
                dropdownRender={getAssigneesMenu}
                open={assigneeDropdownOpen}
                onOpenChange={onAssigneeDropdownOpenChange}
                placement="top"
                arrow
                trigger={['click']}
                getPopupContainer={() => changeAssigneesRef.current!}
              >
                <Button
                  icon={<UsergroupAddOutlined />}
                  className="borderless-icon-btn"
                  style={buttonStyle}
                  loading={updatingAssignees}
                />
              </Dropdown>
            </div>
          </Tooltip>

          <Tooltip
            title={archived ? t('unarchive') : t('archive')}
            getPopupContainer={() => archiveRef.current!}
          >
            <div ref={archiveRef}>
              <Button
                icon={<InboxOutlined />}
                className="borderless-icon-btn"
                style={buttonStyle}
                onClick={handleArchive}
                loading={updatingArchive}
              />
            </div>
          </Tooltip>

          <Tooltip title={t('delete')} getPopupContainer={() => deleteRef.current!}>
            <div ref={deleteRef}>
              <Button
                icon={<DeleteOutlined />}
                className="borderless-icon-btn"
                style={buttonStyle}
                onClick={handleDelete}
                loading={updatingDelete}
              />
            </div>
          </Tooltip>
        </Flex>

        {isOwnerOrAdmin && (
          <Tooltip title={t('moreOptions')} getPopupContainer={() => moreOptionsRef.current!}>
            <div ref={moreOptionsRef}>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: '1',
                      label: t('createTaskTemplate'),
                      onClick: () => setShowDrawer(true),
                    },
                  ],
                }}
              >
                <Button
                  icon={<MoreOutlined />}
                  className="borderless-icon-btn"
                  style={buttonStyle}
                />
              </Dropdown>
            </div>
          </Tooltip>
        )}

        <Tooltip title={t('deselectAll')} getPopupContainer={() => deselectAllRef.current!}>
          <div ref={deselectAllRef}>
            <Button
              icon={<CloseCircleOutlined />}
              onClick={() => dispatch(deselectAll())}
              className="borderless-icon-btn"
              style={buttonStyle}
            />
          </div>
        </Tooltip>
        {createPortal(
          <TaskTemplateDrawer
            showDrawer={showDrawer}
            selectedTemplateId={null}
            onClose={() => {
              setShowDrawer(false);
              dispatch(deselectAll());
            }}
          />,
          document.body,
          'create-task-template'
        )}
        {createPortal(<ConvertToSubtaskDrawer />, document.body, 'convert-to-subtask-modal')}
        {createPortal(<CustomColumnModal />, document.body, 'custom-column-modal')}
      </Flex>
    </div>
  );
};

export default TaskListBulkActionsBar;
