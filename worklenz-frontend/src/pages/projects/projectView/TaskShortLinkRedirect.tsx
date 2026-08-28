import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Result, Spin, Typography } from '@/shared/antd-imports';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import logger from '@/utils/errorLogger';

const { Text } = Typography;

const TaskShortLinkRedirect = () => {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const resolveTaskLink = async () => {
      if (!taskId) {
        setErrorMessage('Invalid task link.');
        setIsLoading(false);
        return;
      }

      try {
        const response = await tasksApiService.getFormViewModel(taskId, null);
        const task = response.body?.task;

        if (!response.done || !task?.project_id) {
          throw new Error('Task not found or missing project id');
        }

        const projectId = task.project_id;
        navigate(
          `/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list&task=${taskId}`,
          { replace: true }
        );
      } catch (error) {
        logger.error('Unable to resolve short task link', error);
        setErrorMessage('Unable to open task link. Please check the URL or open the task from the project.');
        setIsLoading(false);
      }
    };

    resolveTaskLink();
  }, [navigate, taskId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px]">
        <Spin tip="Opening task..." />
      </div>
    );
  }

  return (
    <Result
      status="error"
      title="Unable to open task"
      subTitle={
        <Text type="secondary">
          {errorMessage ?? 'The task link may be invalid or the task could not be found.'}
        </Text>
      }
      extra={
        <Button type="primary" onClick={() => navigate('/worklenz/projects')}>
          Back to projects
        </Button>
      }
    />
  );
};

export default TaskShortLinkRedirect;
