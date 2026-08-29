import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Avatar,
  Tooltip,
  Spin,
  Empty,
  notification,
  theme,
  Button,
} from '@/shared/antd-imports';
import { CheckOutlined, SearchOutlined, UserAddOutlined, PlusOutlined } from '@ant-design/icons';
import InviteProjectMembers from '@/components/common/invite-project-members/InviteProjectMembers';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import { toggleInviteMemberDrawer, setInviteMemberPrefillEmail } from '@/features/settings/member/memberSlice';
import { CreateProjectModal } from '@/components/projects/create-project-modal/create-project-modal';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useGetProjectsByTeamQuery } from '@/api/home-page/home-page.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { scheduleApi, useFetchScheduleMembersQuery } from '@/api/schedule/scheduleApi';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { IProject } from '@/types/project/project.types';
import { IMyTask } from '@/types/home/my-tasks.types';
import { ITask } from '@/types/tasks/task.types';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { getUserSession } from '@/utils/session-helper';

interface PlannerAddTaskModalProps {
  open: boolean;
  defaultDate: Dayjs | null;
  defaultMemberId: string | null;
  onClose: () => void;
}

type CreateMode = 'new' | 'unassigned';

// Same pattern InviteProjectMembers.tsx validates the "emails" field with — kept in
// sync so the invite affordance only appears for text that modal will actually accept.
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

interface PlannerAddTaskFormValues {
  name: string;
  project_id: string;
  date: Dayjs | null;
  est_hours: number;
}

// Reuses the same QUICK_TASK / QUICK_ASSIGNEES_UPDATE creation flow as
// src/pages/home/task-list/HomeAddTaskModal.tsx, plus TASK_START_DATE_CHANGE /
// TASK_END_DATE_CHANGE / TASK_TIME_ESTIMATION_CHANGE to place the task on the
// clicked grid cell (payload shapes copied from task-drawer-due-date.tsx and
// TaskRowColumns.tsx so the server accepts them the same way). The "assign
// unassigned task" mode skips QUICK_TASK entirely and reuses the same
// scheduling calls against an already-existing task id.
const PlannerAddTaskModal = ({ open, defaultDate, defaultMemberId, onClose }: PlannerAddTaskModalProps) => {
  const { t } = useTranslation('schedule');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const [form] = Form.useForm<PlannerAddTaskFormValues>();
  const currentSession = useAuthService().getCurrentSession();
  const { socket } = useSocket();
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const selectedProjectId = Form.useWatch('project_id', form);

  const [createMode, setCreateMode] = useState<CreateMode>('new');
  const [taskSearch, setTaskSearch] = useState('');
  const [selectedUnassignedTask, setSelectedUnassignedTask] = useState<ITask | null>(null);
  const [unassignedTasks, setUnassignedTasks] = useState<ITask[]>([]);
  const [unassignedTasksLoading, setUnassignedTasksLoading] = useState(false);

  const { data: projectListData } = useGetProjectsByTeamQuery();
  const { teamMembers } = useAppSelector(state => state.teamMembersReducer);
  const memberList = teamMembers?.data || [];
  // Settings-drawer default (gear icon > Default estimate) — used to seed the
  // Estimated Hours field for both a brand-new task and an unassigned task with no
  // estimate of its own, instead of a hardcoded fallback.
  const defaultEstimateHours = useAppSelector(state => state.scheduleReducer.defaultEstimateHours) || 2;

  // Which project the current project select value belongs to — used to default
  // the assignee list to "members already on this project" (schedule members
  // already carry a `projects` array, so no extra API call is needed).
  const { data: scheduleMembersData } = useFetchScheduleMembersQuery();
  const scheduleMembers = scheduleMembersData?.body || [];
  const projectMemberIds = useMemo(() => {
    if (!selectedProjectId) return null;
    const ids = new Set(
      scheduleMembers
        .filter(m => (m.projects || []).some(p => p.id === selectedProjectId))
        .map(m => m.team_member_id || m.id)
    );
    return ids;
  }, [scheduleMembers, selectedProjectId]);

  const projectOptions = useMemo(
    () =>
      (projectListData?.body || []).map((project: IProject) => ({
        value: project.id,
        label: project.name,
      })),
    [projectListData]
  );
  const selectedProjectName = projectOptions.find(p => p.value === selectedProjectId)?.label || '';

  // Default view: only members already on the selected project. Once the user
  // types a search term, search across the whole team instead.
  const visibleMembers = useMemo(() => {
    const search = assigneeSearch.trim().toLowerCase();
    if (search) {
      return memberList.filter(
        (m: ITeamMemberViewModel) =>
          m.name?.toLowerCase().includes(search) || m.email?.toLowerCase().includes(search)
      );
    }
    if (projectMemberIds && projectMemberIds.size) {
      return memberList.filter((m: ITeamMemberViewModel) => projectMemberIds.has(m.id || ''));
    }
    return memberList;
  }, [memberList, assigneeSearch, projectMemberIds]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      date: defaultDate || dayjs(),
      project_id: undefined,
      est_hours: defaultEstimateHours,
    });
    setSelectedAssignees(defaultMemberId ? [defaultMemberId] : []);
    setAssigneeSearch('');
    setCreateMode('new');
    setTaskSearch('');
    setSelectedUnassignedTask(null);
    setUnassignedTasks([]);
  }, [open, defaultDate, defaultMemberId]);

  // Switching mode or project invalidates whatever unassigned task was picked.
  useEffect(() => {
    setSelectedUnassignedTask(null);
    setTaskSearch('');
    if (createMode !== 'unassigned') form.setFieldValue('name', undefined);
  }, [createMode, selectedProjectId]);

  // Fetch this project's tasks and keep only the ones with no assignee yet.
  useEffect(() => {
    if (createMode !== 'unassigned' || !selectedProjectId) {
      setUnassignedTasks([]);
      return;
    }
    let cancelled = false;
    setUnassignedTasksLoading(true);
    tasksApiService
      .getTaskListV3({
        id: selectedProjectId,
        field: null,
        order: null,
        search: null,
        statuses: null,
        members: null,
        projects: null,
        isSubtasksInclude: false,
      })
      .then(res => {
        if (cancelled) return;
        const allTasks: ITask[] = res.body?.allTasks || [];
        setUnassignedTasks(allTasks.filter(task => !task.assignees?.length && !task.names?.length));
      })
      .finally(() => {
        if (!cancelled) setUnassignedTasksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createMode, selectedProjectId]);

  const visibleUnassignedTasks = useMemo(() => {
    const search = taskSearch.trim().toLowerCase();
    if (!search) return unassignedTasks;
    return unassignedTasks.filter(
      task => task.name?.toLowerCase().includes(search) || task.task_key?.toLowerCase().includes(search)
    );
  }, [unassignedTasks, taskSearch]);

  const pickUnassignedTask = (task: ITask) => {
    setSelectedUnassignedTask(task);
    const estHours = (task.total_hours || 0) + (task.total_minutes || 0) / 60;
    form.setFieldsValue({
      name: task.name,
      est_hours: estHours > 0 ? estHours : defaultEstimateHours,
    });
  };

  const toggleAssignee = (memberId: string) => {
    setSelectedAssignees(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const timeZone = getUserSession()?.timezone_name || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const scheduleAndAssign = (taskId: string, projectId: string, dateStr: string, estHours: number) => {
    const assigneeIds = selectedAssignees.length
      ? selectedAssignees
      : currentSession?.team_member_id
        ? [currentSession.team_member_id]
        : [];

    // Wait for the backend to ack every write (start date, end date, time estimate,
    // each assignee) before refreshing the grid — otherwise the newly-rendered chip
    // can point at a task that's still mid-update, and opening it races the writes.
    // These event names are shared/broadcast across every open component (same
    // pattern as task-drawer-priority-selector.tsx), so each ack handler below
    // filters on the response's task id and unregisters itself once matched —
    // an unrelated firing for a different task must not count toward finish().
    let remaining = 3 + assigneeIds.length;
    let finished = false;
    const offFns: Array<() => void> = [];

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      offFns.forEach(off => off());
      setSubmitting(false);
      dispatch(
        scheduleApi.util.invalidateTags(['TaskTimeline', 'MemberProjects', 'Members', 'Workload', 'Capacity'])
      );
      onClose();
    };
    // Safety net: if the backend silently drops one of the acks (e.g. a restricted
    // user — same scenario PlannerScheduleView.tsx already guards against for the
    // resize gestures), don't leave the modal stuck in `submitting` forever.
    const timeoutId = setTimeout(finish, 8000);
    const ackReceived = () => {
      remaining -= 1;
      if (remaining <= 0) finish();
    };

    const onStartDateAck = (data: IProjectTask) => {
      if (data?.id !== taskId) return;
      socket?.off(SocketEvents.TASK_START_DATE_CHANGE.toString(), onStartDateAck);
      ackReceived();
    };
    offFns.push(() => socket?.off(SocketEvents.TASK_START_DATE_CHANGE.toString(), onStartDateAck));
    socket?.on(SocketEvents.TASK_START_DATE_CHANGE.toString(), onStartDateAck);
    socket?.emit(
      SocketEvents.TASK_START_DATE_CHANGE.toString(),
      JSON.stringify({ task_id: taskId, start_date: dateStr, parent_task: null, time_zone: timeZone })
    );

    const onEndDateAck = (data: IProjectTask) => {
      if (data?.id !== taskId) return;
      socket?.off(SocketEvents.TASK_END_DATE_CHANGE.toString(), onEndDateAck);
      ackReceived();
    };
    offFns.push(() => socket?.off(SocketEvents.TASK_END_DATE_CHANGE.toString(), onEndDateAck));
    socket?.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), onEndDateAck);
    socket?.emit(
      SocketEvents.TASK_END_DATE_CHANGE.toString(),
      JSON.stringify({ task_id: taskId, end_date: dateStr, parent_task: null, time_zone: timeZone })
    );

    const onEstimationAck = (data: { id?: string }) => {
      if (data?.id !== taskId) return;
      socket?.off(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), onEstimationAck);
      ackReceived();
    };
    offFns.push(() => socket?.off(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), onEstimationAck));
    socket?.on(SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(), onEstimationAck);
    socket?.emit(
      SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(),
      JSON.stringify({
        task_id: taskId,
        total_hours: Math.floor(estHours || 0),
        total_minutes: Math.round(((estHours || 0) % 1) * 60),
        parent_task: null,
      })
    );

    assigneeIds.forEach(teamMemberId => {
      const onAssigneeAck = (data: ITaskAssigneesUpdateResponse) => {
        if (data?.id !== taskId || data?.team_member_id !== teamMemberId) return;
        socket?.off(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), onAssigneeAck);
        ackReceived();
      };
      offFns.push(() => socket?.off(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), onAssigneeAck));
      socket?.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), onAssigneeAck);
      socket?.emit(
        SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(),
        JSON.stringify({
          team_member_id: teamMemberId,
          project_id: projectId,
          task_id: taskId,
          reporter_id: currentSession?.id,
          mode: 0,
        })
      );
    });
  };

  const handleSubmit = (values: PlannerAddTaskFormValues) => {
    const dateStr = (values.date || dayjs()).format('YYYY-MM-DD');

    if (createMode === 'unassigned') {
      if (!selectedUnassignedTask) {
        notification.error({
          message: t('pickUnassignedTaskRequired', { defaultValue: 'Please select an unassigned task' }),
          placement: 'topRight',
        });
        return;
      }
      setSubmitting(true);
      scheduleAndAssign(selectedUnassignedTask.id, values.project_id, dateStr, values.est_hours);
      return;
    }

    if (!values.name?.trim()) return;
    setSubmitting(true);

    const newTask = {
      name: values.name.trim(),
      project_id: values.project_id,
      reporter_id: currentSession?.id,
      team_id: currentSession?.team_id,
      end_date: dateStr,
    };

    socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(newTask));
    socket?.once(
      SocketEvents.QUICK_TASK.toString(),
      (task: IMyTask & { error?: boolean; message?: string }) => {
        if (task?.error) {
          setSubmitting(false);
          notification.error({
            message: t('taskCreationRestrictedTitle', { defaultValue: 'Task Creation Restricted' }),
            description:
              task.message ||
              t('taskCreationRestricted', {
                defaultValue: 'Task creation is restricted to Admins and Team Leads only. Please contact your admin for access.',
              }),
            placement: 'topRight',
          });
          return;
        }

        if (!task) return;
        scheduleAndAssign(task.id, task.project_id, dateStr, values.est_hours);
      }
    );
  };

  return (
    <>
    <Modal
      title={t('newTask', { defaultValue: 'New Task' })}
      open={open}
      onCancel={onClose}
      okText={createMode === 'unassigned' ? t('assignTask', { defaultValue: 'Assign Task' }) : t('createTask', { defaultValue: 'Create Task' })}
      onOk={() => form.submit()}
      okButtonProps={{ loading: submitting, disabled: createMode === 'unassigned' && !selectedUnassignedTask }}
      destroyOnClose
    >
      {/* Same tab-pill format/color as the Days/Weeks/Months zoom toggle in
          PlannerScheduleView.tsx (active = token.colorPrimary fill), so the modal's
          mode switch reads as the same control family as the grid above it. */}
      <div
        style={{
          display: 'flex',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 7,
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        {(
          [
            { label: t('newTask', { defaultValue: 'New Task' }), value: 'new' as const },
            { label: t('assignUnassignedTask', { defaultValue: 'From Unassigned' }), value: 'unassigned' as const },
          ]
        ).map((opt, idx, arr) => {
          const active = createMode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCreateMode(opt.value)}
              style={{
                flex: 1,
                padding: '6px 12px',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                borderRight: idx === arr.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                background: active ? token.colorPrimary : 'transparent',
                color: active ? (token.colorWhite ?? '#fff') : token.colorText,
                transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="project_id"
          label={t('project', { defaultValue: 'Project' })}
          rules={[{ required: true, message: t('projectRequired', { defaultValue: 'Project is required' }) }]}
        >
          <Select
            showSearch
            placeholder={t('selectProject', { defaultValue: 'Select project…' })}
            options={projectOptions}
            optionFilterProp="label"
            notFoundContent={
              projectOptions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8 }}>
                    {t('noProjectsFound', { defaultValue: 'No projects yet' })}
                  </div>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => setCreateProjectOpen(true)}>
                    {t('createProject', { defaultValue: 'Create Project' })}
                  </Button>
                </div>
              ) : undefined
            }
          />
        </Form.Item>

        {createMode === 'new' && (
          <Form.Item
            name="name"
            label={t('taskName', { defaultValue: 'Task Name' })}
            rules={[{ required: true, message: t('taskNameRequired', { defaultValue: 'Task name is required' }) }]}
          >
            <Input
              autoFocus
              placeholder={t('addTask', { defaultValue: 'Enter task name…' })}
              onKeyDown={e => {
                if (e.key === 'Enter') form.submit();
              }}
            />
          </Form.Item>
        )}

        {createMode === 'unassigned' && (
          <Form.Item label={t('unassignedTask', { defaultValue: 'Unassigned Task' })} required>
            {!selectedProjectId ? (
              <div style={{ fontSize: 12, opacity: 0.45, padding: '8px 0' }}>
                {t('selectProjectFirst', { defaultValue: 'Select a project to see its unassigned tasks.' })}
              </div>
            ) : (
              <>
                <Input
                  allowClear
                  prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
                  placeholder={t('searchUnassignedTasks', { defaultValue: 'Search by task name or key…' })}
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <div
                  style={{
                    maxHeight: 180,
                    overflowY: 'auto',
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: 6,
                  }}
                >
                  {unassignedTasksLoading ? (
                    <div style={{ textAlign: 'center', padding: 16 }}>
                      <Spin size="small" />
                    </div>
                  ) : visibleUnassignedTasks.length === 0 ? (
                    <Empty
                      description={t('noUnassignedTasks', { defaultValue: 'No unassigned tasks found' })}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ padding: 12 }}
                    />
                  ) : (
                    visibleUnassignedTasks.map(task => {
                      const active = selectedUnassignedTask?.id === task.id;
                      return (
                        <div
                          key={task.id}
                          onClick={() => pickUnassignedTask(task)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 10px',
                            fontSize: 12,
                            cursor: 'pointer',
                            fontWeight: active ? 700 : 400,
                            background: active ? token.colorPrimaryBg : 'transparent',
                            borderLeft: active ? `3px solid ${token.colorPrimary}` : '3px solid transparent',
                          }}
                        >
                          {task.task_key && (
                            <span style={{ opacity: 0.5, fontWeight: 400, flexShrink: 0 }}>{task.task_key}</span>
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.name}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </Form.Item>
        )}

        <Form.Item name="date" label={t('date', { defaultValue: 'Date' })}>
          <DatePicker style={{ width: '100%' }} format="MMM DD, YYYY" />
        </Form.Item>

        <Form.Item
          name="est_hours"
          label={t('estHoursPerDay', { defaultValue: 'Estimated Hours' })}
          rules={[
            {
              required: true,
              message: t('estHoursRequired', { defaultValue: 'Estimated hours is required' }),
            },
          ]}
        >
          <InputNumber style={{ width: '100%' }} min={0.5} max={24} step={0.5} />
        </Form.Item>

        <Form.Item label={t('assignees', { defaultValue: 'Assignees' })}>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
            placeholder={t('searchMembers', { defaultValue: 'Search by name or email…' })}
            value={assigneeSearch}
            onChange={e => setAssigneeSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 180, overflowY: 'auto' }}>
            {visibleMembers.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: 12, opacity: 0.45 }}>
                  {t('noMembersFound', { defaultValue: 'No members found' })}
                </span>
                {isValidEmail(assigneeSearch.trim()) && (
                  <Button
                    icon={<UserAddOutlined />}
                    onClick={() => {
                      if (selectedProjectId) {
                        dispatch(toggleProjectMemberDrawer());
                      } else {
                        dispatch(setInviteMemberPrefillEmail(assigneeSearch.trim()));
                        dispatch(toggleInviteMemberDrawer());
                      }
                    }}
                  >
                    {selectedProjectId
                      ? t('inviteNewMember', {
                          email: assigneeSearch.trim(),
                          projectName: selectedProjectName,
                          defaultValue: `Invite "${assigneeSearch.trim()}" to ${selectedProjectName}`,
                        })
                      : t('inviteNewMemberToTeam', {
                          email: assigneeSearch.trim(),
                          defaultValue: `Invite "${assigneeSearch.trim()}" to the team`,
                        })}
                  </Button>
                )}
              </div>
            )}
            {visibleMembers.map((member: ITeamMemberViewModel) => {
              const active = selectedAssignees.includes(member.id || '');
              const color = member.color_code || token.colorPrimary;
              return (
                <Tooltip key={member.id} title={member.email ? `${member.name} (${member.email})` : member.name}>
                  <div
                    onClick={() => toggleAssignee(member.id || '')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 10px 3px 3px',
                      borderRadius: 20,
                      border: `1.5px solid ${active ? color : token.colorBorderSecondary}`,
                      background: active ? `${color}26` : 'transparent',
                      boxShadow: active ? `0 0 0 1px ${color}` : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Avatar
                      size={22}
                      src={member.avatar_url || undefined}
                      style={{ backgroundColor: color, fontSize: 10 }}
                    >
                      {member.name?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? color : undefined }}>
                      {member.name}
                    </span>
                    {active && <CheckOutlined style={{ fontSize: 11, color }} />}
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </Form.Item>
      </Form>
    </Modal>
    {/* Opens via the same global state.projectMemberReducer.isDrawerOpen flag as the
        instance rendered in project-view.tsx — safe as long as Planner and a project's
        own view page stay on mutually exclusive routes. */}
    {selectedProjectId && (
      <InviteProjectMembers
        projectId={selectedProjectId}
        projectName={selectedProjectName}
        prefillEmail={assigneeSearch}
      />
    )}
    <CreateProjectModal
      open={createProjectOpen}
      onClose={() => setCreateProjectOpen(false)}
      onProjectCreated={projectId => form.setFieldsValue({ project_id: projectId })}
    />
    </>
  );
};

export default PlannerAddTaskModal;
