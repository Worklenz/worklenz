import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Result, Spin, Typography } from '@/shared/antd-imports';
import { AxiosError } from 'axios';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import logger from '@/utils/errorLogger';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const CommentShortLinkRedirect = () => {
  const navigate = useNavigate();
  const { commentId } = useParams<{ commentId: string }>();
  const { t } = useTranslation('unauthorized');
  const [isLoading, setIsLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const resolveCommentLink = async () => {
      if (!commentId) {
        setErrorMessage(
          t('invalidCommentLink', {
            defaultValue: 'This comment link is invalid.',
          })
        );
        setIsLoading(false);
        return;
      }

      try {
        const response = await taskCommentsApiService.resolveShortLink(commentId);
        const body = response.body;

        if (!response.done || !body?.task_id || !body?.project_id) {
          throw new Error('Comment not found or missing task/project id');
        }

        const nextParams = new URLSearchParams({
          tab: 'tasks-list',
          pinned_tab: 'tasks-list',
          task: body.task_id,
          comment: body.comment_id || commentId,
        });

        navigate(`/worklenz/projects/${body.project_id}?${nextParams.toString()}`, {
          replace: true,
        });
      } catch (error) {
        const status = (error as AxiosError)?.response?.status;
        logger.error('Unable to resolve short comment link', error);

        if (status === 403) {
          setIsForbidden(true);
        } else if (status === 404) {
          setErrorMessage(
            t('commentNotFound', {
              defaultValue: 'This comment could not be found.',
            })
          );
        } else {
          setErrorMessage(
            t('commentLinkOpenFailed', {
              defaultValue:
                'Unable to open this comment link. Please try again or open the comment from the task.',
            })
          );
        }
        setIsLoading(false);
      }
    };

    resolveCommentLink();
  }, [navigate, commentId, t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px]">
        <Spin
          tip={t('openingComment', {
            defaultValue: 'Opening comment...',
          })}
        />
      </div>
    );
  }

  if (isForbidden) {
    return (
      <Result
        status="info"
        title={t('commentAccessTitle', {
          defaultValue: 'You need access to view this comment',
        })}
        subTitle={
          <Text type="secondary">
            {t('commentAccessContactAdmin', {
              defaultValue:
                'You are not invited to this project. Please contact your admin or project owner to request access.',
            })}
          </Text>
        }
        extra={
          <Button type="primary" onClick={() => navigate('/worklenz/home')}>
            {t('button', { defaultValue: 'Go to Home' })}
          </Button>
        }
      />
    );
  }

  return (
    <Result
      status="error"
      title={t('unableToOpenComment', {
        defaultValue: 'Unable to open comment',
      })}
      subTitle={
        <Text type="secondary">
          {errorMessage ??
            t('commentLinkOpenFailed', {
              defaultValue:
                'Unable to open this comment link. Please try again or open the comment from the task.',
            })}
        </Text>
      }
      extra={
        <Button type="primary" onClick={() => navigate('/worklenz/home')}>
          {t('button', { defaultValue: 'Go to Home' })}
        </Button>
      }
    />
  );
};

export default CommentShortLinkRedirect;
