import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Result, Spin, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import logger from '@/utils/errorLogger';
import { TASK_ASSIGNEE_RESTRICTED_CODE } from '@/features/task-drawer/task-drawer.slice';

const { Text } = Typography;

const TaskShortLinkRedirect = () => {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation('task-drawer/task-drawer');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  useEffect(() => {
    const resolveTaskLink = async () => {
      if (!taskId) {
        setErrorMessage('Invalid task link.');
        setIsLoading(false);
        return;
      }

      try {
        const accessFrom = searchParams.get('from');
        const response = await tasksApiService.getFormViewModel(taskId, null, {
          from: accessFrom,
        });
        const task = response.body?.task;

        if (!response.done || !task?.project_id) {
          throw new Error('Task not found or missing project id');
        }

        const projectId = task.project_id;
        const fromQuery =
          accessFrom === 'notification' || accessFrom === 'mention'
            ? `&from=${accessFrom}`
            : '';
        const commentId = searchParams.get('comment');
        const commentQuery = commentId ? `&comment=${encodeURIComponent(commentId)}` : '';
        navigate(
          `/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list&task=${taskId}${fromQuery}${commentQuery}`,
          { replace: true }
        );
      } catch (error) {
        const response = (error as { response?: { status?: number; data?: { body?: { code?: string } } } })
          ?.response;
        if (
          response?.status === 403 &&
          response.data?.body?.code === TASK_ASSIGNEE_RESTRICTED_CODE
        ) {
          setIsAccessDenied(true);
          setErrorMessage(
            t('taskAccessDenied.subtitle', {
              defaultValue:
                'You can only open tasks assigned to you in this project. Ask a project manager to assign you if you need access.',
            })
          );
        } else {
          logger.error('Unable to resolve short task link', error);
          setErrorMessage(
            'Unable to open task link. Please check the URL or open the task from the project.'
          );
        }
        setIsLoading(false);
      }
    };

    resolveTaskLink();
  }, [navigate, searchParams, t, taskId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px]">
        <Spin tip="Opening task..." />
      </div>
    );
  }

  return (
    <Result
      status={isAccessDenied ? '403' : 'error'}
      title={
        isAccessDenied
          ? t('taskAccessDenied.title', { defaultValue: 'No access' })
          : 'Unable to open task'
      }
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
