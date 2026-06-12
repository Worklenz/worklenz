import React from 'react';
import { Modal, Steps, Flex, Typography, Input, List, Tag, Skeleton, Empty, Button } from '@/shared/antd-imports';
import { SearchOutlined, LeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { theme } from 'antd';
import {
  taskTimeLogsApiService,
  IRecentProject,
  ITaskInProject,
} from '@/api/tasks/task-time-logs.api.service';
import TimeLogForm from '@/components/task-drawer/shared/time-log/time-log-form';
import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';


const { Text } = Typography;

interface LogTimeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'project' | 'task' | 'time';

interface SelectedProject {
  id: string;
  name: string;
  color_code?: string;
}

interface SelectedTask {
  id: string;
  name: string;
}

export const LogTimeModal: React.FC<LogTimeModalProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();

  const [step, setStep] = React.useState<Step>('project');
  const [recentProjects, setRecentProjects] = React.useState<IRecentProject[]>([]);
  const [projectSearch, setProjectSearch] = React.useState('');
  const [projectSearchResults, setProjectSearchResults] = React.useState<IRecentProject[]>([]);
  const [projectSearchLoading, setProjectSearchLoading] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<SelectedProject | null>(null);
  const [taskSearch, setTaskSearch] = React.useState('');
  const [tasks, setTasks] = React.useState<ITaskInProject[]>([]);
  const [tasksLoading, setTasksLoading] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<SelectedTask | null>(null);
  const projectSearchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskSearchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent projects when modal opens
  React.useEffect(() => {
    if (!open) return;
    setStep('project');
    setSelectedProject(null);
    setSelectedTask(null);
    setProjectSearch('');
    setTaskSearch('');
    taskTimeLogsApiService.getMyRecentProjects().then(res => {
      if (res.done) setRecentProjects(res.body as IRecentProject[]);
    });
  }, [open]);

  // Search projects
  React.useEffect(() => {
    if (projectSearchTimerRef.current) clearTimeout(projectSearchTimerRef.current);
    if (!projectSearch.trim()) {
      setProjectSearchResults([]);
      return;
    }
    projectSearchTimerRef.current = setTimeout(async () => {
      setProjectSearchLoading(true);
      try {
        const res = await apiClient.get(`${API_BASE_URL}/projects/my-task-projects`);
        const list: any[] = res.data?.body || [];
        const q = projectSearch.toLowerCase();
        setProjectSearchResults(
          list
            .filter((p: any) => p.name?.toLowerCase().includes(q))
            .map((p: any) => ({ id: p.id, name: p.name, color_code: p.color_code }))
        );
      } catch {
        setProjectSearchResults([]);
      } finally {
        setProjectSearchLoading(false);
      }
    }, 300);
  }, [projectSearch]);

  // Load tasks when project selected or task search changes
  React.useEffect(() => {
    if (!selectedProject) return;
    if (taskSearchTimerRef.current) clearTimeout(taskSearchTimerRef.current);
    taskSearchTimerRef.current = setTimeout(async () => {
      setTasksLoading(true);
      try {
        const res = await taskTimeLogsApiService.getMyTasksInProject(selectedProject.id, taskSearch || undefined);
        if (res.done) setTasks(res.body as ITaskInProject[]);
      } catch {
        setTasks([]);
      } finally {
        setTasksLoading(false);
      }
    }, 200);
  }, [selectedProject, taskSearch]);

  React.useEffect(() => () => {
    if (projectSearchTimerRef.current) clearTimeout(projectSearchTimerRef.current);
    if (taskSearchTimerRef.current) clearTimeout(taskSearchTimerRef.current);
  }, []);

  const handleSelectProject = (project: SelectedProject) => {
    setSelectedProject(project);
    setProjectSearch('');
    setTaskSearch('');
    setTasks([]);
    setStep('task');
  };

  const handleSelectTask = (task: ITaskInProject) => {
    setSelectedTask({ id: task.id, name: task.name });
    setStep('time');
  };

  const stepItems = [
    { title: t('step1Title', { defaultValue: 'Project' }) },
    { title: t('step2Title', { defaultValue: 'Task' }) },
    { title: t('step3Title', { defaultValue: 'Time' }) },
  ];

  const currentStepIndex = step === 'project' ? 0 : step === 'task' ? 1 : 2;

  const displayedProjects = projectSearch.trim()
    ? projectSearchResults
    : recentProjects;

  const renderProjectStep = () => (
    <Flex vertical gap={12}>
      <Input
        prefix={<SearchOutlined />}
        placeholder={t('searchProject', { defaultValue: 'Search project...' })}
        value={projectSearch}
        onChange={e => setProjectSearch(e.target.value)}
        autoFocus
        allowClear
      />

      {!projectSearch.trim() && recentProjects.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('recentProjects', { defaultValue: 'Recent Projects' })}
        </Text>
      )}

      {projectSearchLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      ) : displayedProjects.length === 0 ? (
        projectSearch.trim() ? (
          <Empty description={t('noRecentProjects', { defaultValue: 'No projects found' })} />
        ) : (
          <Empty description={t('noRecentProjects', { defaultValue: 'No recent projects' })} />
        )
      ) : (
        <Flex wrap="wrap" gap={8}>
          {displayedProjects.map(p => (
            <Tag
              key={p.id}
              style={{
                cursor: 'pointer',
                padding: '4px 12px',
                fontSize: 13,
                borderColor: p.color_code || token.colorBorder,
              }}
              onClick={() => handleSelectProject(p)}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: p.color_code || token.colorPrimary,
                  marginRight: 6,
                }}
              />
              {p.name}
            </Tag>
          ))}
        </Flex>
      )}
    </Flex>
  );

  const renderTaskStep = () => (
    <Flex vertical gap={12}>
      <Flex align="center" gap={8}>
        <Button
          type="text"
          size="small"
          icon={<LeftOutlined />}
          onClick={() => setStep('project')}
        >
          {t('back', { defaultValue: 'Back' })}
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {selectedProject?.name}
        </Text>
      </Flex>

      <Input
        prefix={<SearchOutlined />}
        placeholder={t('searchTask', { defaultValue: 'Search task...' })}
        value={taskSearch}
        onChange={e => setTaskSearch(e.target.value)}
        autoFocus
        allowClear
      />

      {tasksLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      ) : tasks.length === 0 ? (
        <Empty description={t('noTasksInProject', { defaultValue: 'No tasks assigned to you in this project' })} />
      ) : (
        <List
          size="small"
          dataSource={tasks}
          style={{ maxHeight: 280, overflowY: 'auto' }}
          renderItem={task => (
            <List.Item
              style={{ cursor: 'pointer', padding: '8px 4px' }}
              onClick={() => handleSelectTask(task)}
            >
              <Flex align="center" justify="space-between" style={{ width: '100%' }}>
                <Text style={{ flex: 1 }}>{task.name}</Text>
                {task.due_date && (
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                    {new Date(task.due_date).toLocaleDateString()}
                  </Text>
                )}
              </Flex>
            </List.Item>
          )}
        />
      )}
    </Flex>
  );

  const renderTimeStep = () => (
    <Flex vertical gap={8}>
      <Flex align="center" gap={8}>
        <Button
          type="text"
          size="small"
          icon={<LeftOutlined />}
          onClick={() => setStep('task')}
        >
          {t('back', { defaultValue: 'Back' })}
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {selectedProject?.name} › {selectedTask?.name}
        </Text>
      </Flex>

      {selectedTask && selectedProject && (
        <TimeLogForm
          mode="create"
          taskId={selectedTask.id}
          projectId={selectedProject.id}
          onCancel={onClose}
          onSubmitSuccess={() => {
            onSuccess();
            onClose();
          }}
        />
      )}
    </Flex>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('modalTitle', { defaultValue: 'Log Time' })}
      footer={null}
      width={480}
      destroyOnClose
    >
      <Steps
        current={currentStepIndex}
        items={stepItems}
        size="small"
        style={{ marginBottom: 20 }}
      />

      {step === 'project' && renderProjectStep()}
      {step === 'task' && renderTaskStep()}
      {step === 'time' && renderTimeStep()}
    </Modal>
  );
};
