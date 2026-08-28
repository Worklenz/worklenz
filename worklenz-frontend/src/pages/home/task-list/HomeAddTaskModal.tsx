import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Avatar,
  Tooltip,
  Spin,
  Empty,
  notification,
  SearchOutlined,
  theme,
  Button,
} from '@/shared/antd-imports';
import { UserAddOutlined, PlusOutlined } from '@ant-design/icons';
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
import homePageApi from '@/api/home-page/home-page.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { IProject } from '@/types/project/project.types';
import { IMyTask } from '@/types/home/my-tasks.types';
import { ITask } from '@/types/tasks/task.types';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import PillToggle from '@/pages/home/PillToggle';

interface HomeAddTaskModalProps {
  open: boolean;
  defaultDate: Dayjs | null;
  onClose: () => void;
  /** Fired with the newly created task once creation (and any assignee updates) finish. */
  onTaskCreated?: (task: IMyTask) => void;
}

type CreateMode = 'new' | 'unassigned';

// Same pattern InviteProjectMembers.tsx validates the "emails" field with — kept in
// sync so the invite affordance only appears for text that modal will actually accept.
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

interface HomeAddTaskFormValues {
  name: string;
  project_id: string;
  due_date: Dayjs | null;
  priority_id?: string;
}

const HomeAddTaskModal = ({ open, defaultDate, onClose, onTaskCreated }: HomeAddTaskModalProps) => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const [form] = Form.useForm<HomeAddTaskFormValues>();
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
  const { priorities } = useAppSelector(state => state.priorityReducer);
  const { teamMembers } = useAppSelector(state => state.teamMembersReducer);

  const projectOptions = useMemo(
    () =>
      (projectListData?.body || []).map((project: IProject) => ({
        value: project.id,
        label: project.name,
      })),
    [projectListData]
  );
  const selectedProjectName = projectOptions.find(p => p.value === selectedProjectId)?.label || '';

  const priorityOptions = useMemo(
    () => priorities.map(priority => ({ value: priority.id, label: priority.name })),
    [priorities]
  );

  const memberList = teamMembers?.data || [];

  const visibleMembers = useMemo(() => {
    const search = assigneeSearch.trim().toLowerCase();
    if (!search) return memberList;
    return memberList.filter(
      (m: ITeamMemberViewModel) =>
        m.name?.toLowerCase().includes(search) || m.email?.toLowerCase().includes(search)
    );
  }, [memberList, assigneeSearch]);

  useEffect(() => {
    if (!priorities.length) dispatch(fetchPriorities());
    if (!memberList.length) {
      dispatch(getTeamMembers({ index: 0, size: 100, field: null, order: null, search: null, all: true }));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      due_date: defaultDate || dayjs(),
      project_id: projectOptions[0]?.value,
      priority_id: priorityOptions.find(p => p.label?.toLowerCase() === 'medium')?.value,
    });
    setSelectedAssignees([]);
    setAssigneeSearch('');
    setCreateMode('new');
    setTaskSearch('');
    setSelectedUnassignedTask(null);
    setUnassignedTasks([]);
  }, [open, defaultDate]);

  // Switching mode or project invalidates whatever unassigned task was picked.
  useEffect(() => {
    setSelectedUnassignedTask(null);
    setTaskSearch('');
  }, [createMode, selectedProjectId]);

  // Fetch this project's tasks and keep only the ones with no assignee yet —
  // same source/filter Planner's schedule "Assign Unassigned Task" mode uses.
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
    setTaskSearch(task.name || '');
  };

  const toggleAssignee = (memberId: string) => {
    setSelectedAssignees(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  // Places an already-existing unassigned task on the clicked date instead of
  // creating a new one — mirrors PlannerAddTaskModal's scheduleAndAssign, minus
  // the start-date/time-estimation calls the Home calendar has no fields for.
  const assignExistingTask = (task: ITask, dateStr: string) => {
    socket?.emit(
      SocketEvents.TASK_END_DATE_CHANGE.toString(),
      JSON.stringify({
        task_id: task.id,
        end_date: dateStr,
        parent_task: null,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
    );

    const assigneeIds = selectedAssignees.length
      ? selectedAssignees
      : currentSession?.team_member_id
        ? [currentSession.team_member_id]
        : [];

    let remaining = assigneeIds.length;
    const finish = () => {
      setSubmitting(false);
      dispatch(homePageApi.util.invalidateTags(['calendarTasks', 'taskCounts', 'myTasks']));
      onTaskCreated?.(task as unknown as IMyTask);
      onClose();
    };

    if (remaining === 0) {
      finish();
      return;
    }

    assigneeIds.forEach(teamMemberId => {
      const taskBody = {
        team_member_id: teamMemberId,
        project_id: task.project_id,
        task_id: task.id,
        reporter_id: currentSession?.id,
        mode: 0,
      };
      socket?.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(taskBody));
      socket?.once(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), (_response: ITaskAssigneesUpdateResponse) => {
        remaining -= 1;
        if (remaining <= 0) finish();
      });
    });
  };

  const handleSubmit = (values: HomeAddTaskFormValues) => {
    const dateStr = values.due_date ? values.due_date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

    if (createMode === 'unassigned') {
      if (!selectedUnassignedTask) {
        notification.error({
          message: t('tasks.pickUnassignedTaskRequired', {
            defaultValue: 'Please select an unassigned task',
          }),
          placement: 'topRight',
        });
        return;
      }
      setSubmitting(true);
      assignExistingTask(selectedUnassignedTask, dateStr);
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
      priority_id: values.priority_id,
    };

    socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(newTask));
    socket?.once(
      SocketEvents.QUICK_TASK.toString(),
      (task: IMyTask & { error?: boolean; message?: string }) => {
        if (task?.error) {
          setSubmitting(false);
          notification.error({
            message: t('tasks.taskCreationRestrictedTitle', {
              defaultValue: 'Task Creation Restricted',
            }),
            description:
              task.message ||
              t('tasks.taskCreationRestricted', {
                defaultValue:
                  'Task creation is restricted to Admins and Team Leads only. Please contact your admin for access.',
              }),
            placement: 'topRight',
          });
          return;
        }

        if (task) {
          const assigneeIds = selectedAssignees.length
            ? selectedAssignees
            : currentSession?.team_member_id
              ? [currentSession.team_member_id]
              : [];

          let remaining = assigneeIds.length;
          const finish = () => {
            setSubmitting(false);
            dispatch(homePageApi.util.invalidateTags(['calendarTasks', 'taskCounts', 'myTasks']));
            onTaskCreated?.(task);
            onClose();
          };

          if (remaining === 0) {
            finish();
            return;
          }

          assigneeIds.forEach(teamMemberId => {
            const taskBody = {
              team_member_id: teamMemberId,
              project_id: task.project_id,
              task_id: task.id,
              reporter_id: currentSession?.id,
              mode: 0,
            };
            socket?.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(taskBody));
            socket?.once(
              SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(),
              (_response: ITaskAssigneesUpdateResponse) => {
                remaining -= 1;
                if (remaining <= 0) finish();
              }
            );
          });
        }
      }
    );
  };

  return (
    <>
    <Modal
      title={t('tasks.newTask', { defaultValue: 'New Task' })}
      open={open}
      onCancel={onClose}
      okText={
        createMode === 'unassigned'
          ? t('tasks.assignTask', { defaultValue: 'Assign Task' })
          : t('tasks.createTask', { defaultValue: 'Create Task' })
      }
      onOk={() => form.submit()}
      okButtonProps={{
        loading: submitting,
        disabled: createMode === 'unassigned' && !selectedUnassignedTask,
      }}
      destroyOnClose
    >
      <PillToggle<CreateMode>
        value={createMode}
        onChange={setCreateMode}
        equalWidth
        style={{ width: '100%', marginBottom: 16 }}
        options={[
          { value: 'new', label: t('tasks.newTask', { defaultValue: 'New Task' }) },
          {
            value: 'unassigned',
            label: t('tasks.assignUnassignedTask', { defaultValue: 'From Unassigned' }),
          },
        ]}
      />

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="project_id"
          label={t('tasks.project', { defaultValue: 'Project' })}
          rules={[{ required: true, message: t('tasks.projectRequired') }]}
        >
          <Select
            showSearch
            placeholder={t('tasks.selectProject', { defaultValue: 'Select project…' })}
            options={projectOptions}
            optionFilterProp="label"
            notFoundContent={
              projectOptions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8 }}>
                    {t('tasks.noProjectsFound', { defaultValue: 'No projects yet' })}
                  </div>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => setCreateProjectOpen(true)}>
                    {t('tasks.createProject', { defaultValue: 'Create Project' })}
                  </Button>
                </div>
              ) : undefined
            }
          />
        </Form.Item>

        {createMode === 'new' && (
          <Form.Item
            name="name"
            label={t('tasks.taskName', { defaultValue: 'Task Name' })}
            rules={[{ required: true, message: t('tasks.taskRequired') }]}
          >
            <Input
              autoFocus
              placeholder={t('tasks.addTask', { defaultValue: 'Enter task name…' })}
            />
          </Form.Item>
        )}

        {createMode === 'unassigned' && (
          <Form.Item label={t('tasks.unassignedTask', { defaultValue: 'Unassigned Task' })} required>
            {!selectedProjectId ? (
              <div style={{ fontSize: 12, opacity: 0.45, padding: '8px 0' }}>
                {t('tasks.selectProjectFirst', {
                  defaultValue: 'Select a project to see its unassigned tasks.',
                })}
              </div>
            ) : (
              <>
                <Input
                  allowClear
                  prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
                  placeholder={t('tasks.searchUnassignedTasks', {
                    defaultValue: 'Search by task name or key…',
                  })}
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
                      description={t('tasks.noUnassignedTasks', {
                        defaultValue: 'No unassigned tasks found',
                      })}
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
                            background: active ? '#1677ff1A' : 'transparent',
                            borderLeft: active ? '3px solid #1677ff' : '3px solid transparent',
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

        <Form.Item name="due_date" label={t('tasks.dueDate', { defaultValue: 'Due Date' })}>
          <DatePicker style={{ width: '100%' }} format="MMM DD, YYYY" />
        </Form.Item>

        {createMode === 'new' && priorityOptions.length > 0 && (
          <Form.Item name="priority_id" label={t('tasks.priority', { defaultValue: 'Priority' })}>
            <Select options={priorityOptions} allowClear />
          </Form.Item>
        )}

        <Form.Item label={t('tasks.assignees', { defaultValue: 'Assignees' })}>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
            placeholder={t('tasks.searchMembers', { defaultValue: 'Search by name or email…' })}
            value={assigneeSearch}
            onChange={e => setAssigneeSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 180, overflowY: 'auto' }}>
            {visibleMembers.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: 12, opacity: 0.45 }}>
                  {t('tasks.noMembersFound', { defaultValue: 'No members found' })}
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
                      ? t('tasks.inviteNewMember', {
                          email: assigneeSearch.trim(),
                          projectName: selectedProjectName,
                          defaultValue: `Invite "${assigneeSearch.trim()}" to ${selectedProjectName}`,
                        })
                      : t('tasks.inviteNewMemberToTeam', {
                          email: assigneeSearch.trim(),
                          defaultValue: `Invite "${assigneeSearch.trim()}" to the team`,
                        })}
                  </Button>
                )}
              </div>
            )}
            {visibleMembers.map((member: ITeamMemberViewModel) => {
              const active = selectedAssignees.includes(member.id || '');
              return (
                <Tooltip key={member.id} title={member.email ? `${member.name} (${member.email})` : member.name}>
                  <div
                    onClick={() => toggleAssignee(member.id || '')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 8px 3px 3px',
                      borderRadius: 20,
                      border: `1.5px solid ${active ? member.color_code || '#1677ff' : token.colorBorderSecondary}`,
                      background: active ? `${member.color_code || '#1677ff'}1A` : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <Avatar
                      size={22}
                      src={member.avatar_url || undefined}
                      style={{ backgroundColor: member.color_code || '#1677ff', fontSize: 10 }}
                    >
                      {member.name?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <span style={{ fontSize: 12 }}>{member.name}</span>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </Form.Item>
      </Form>
    </Modal>
    {/* Opens via the same global state.projectMemberReducer.isDrawerOpen flag as the
        instance rendered in project-view.tsx — safe as long as Home and a project's own
        view page stay on mutually exclusive routes. */}
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

export default HomeAddTaskModal;
