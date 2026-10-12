import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Checkbox,
  CrownOutlined,
  Empty,
  Flex,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import {
  downloadBlobFile,
  taskExportApiService,
} from '@/api/projects/task-export.api.service';
import { enqueuePendingTaskExportJob } from '@/components/projects/task-export/TaskExportProgressNotifier';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import alertService from '@/services/alerts/alertService';
import { hasBusinessFeatureAccess } from '@/utils/subscription-utils';
import logger from '@/utils/errorLogger';
import { TaskExportPublicJob } from '@/types/project/task-export.types';

interface TaskExportSettingsSectionProps {
  projectId: string;
}

interface ExportSelection {
  includeTasks: boolean;
  includeComments: boolean;
  includeFiles: boolean;
}

const statusColor = (status: TaskExportPublicJob['status']): string => {
  switch (status) {
    case 'Ready':
      return 'success';
    case 'Processing':
      return 'processing';
    case 'Failed':
      return 'error';
    case 'Expired':
      return 'default';
    default:
      return 'default';
  }
};

const TaskExportSettingsSection = ({ projectId }: TaskExportSettingsSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { t: tCommon } = useTranslation('common');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const hasBusinessAccess = hasBusinessFeatureAccess(authService.getCurrentSession());

  const [selection, setSelection] = useState<ExportSelection>({
    includeTasks: true,
    includeComments: false,
    includeFiles: false,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [jobs, setJobs] = useState<TaskExportPublicJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  const hasSelection =
    selection.includeTasks || selection.includeComments || selection.includeFiles;

  const hasProcessingJobs = useMemo(
    () => jobs.some(job => job.status === 'Processing'),
    [jobs]
  );

  const handleUpgradeClick = useCallback(() => {
    dispatch(toggleUpgradeModal());
  }, [dispatch]);

  const fetchJobs = useCallback(async () => {
    if (!projectId || !hasBusinessAccess) return;
    setIsLoadingJobs(true);
    try {
      const list = await taskExportApiService.list(projectId);
      setJobs(list);
      if (list.some(job => job.status === 'Processing')) {
        setIsPreparing(true);
      } else {
        setIsPreparing(false);
      }
    } catch (error) {
      logger.error('Failed to load task exports', error);
    } finally {
      setIsLoadingJobs(false);
    }
  }, [projectId, hasBusinessAccess]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!hasBusinessAccess || !hasProcessingJobs) return;

    const timer = window.setInterval(() => {
      void fetchJobs();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasBusinessAccess, hasProcessingJobs, fetchJobs]);

  const handleExport = useCallback(async () => {
    if (!hasBusinessAccess) {
      handleUpgradeClick();
      return;
    }
    if (!hasSelection || !projectId) return;

    setIsExporting(true);
    try {
      const result = await taskExportApiService.create(projectId, {
        include_tasks: selection.includeTasks,
        include_comments: selection.includeComments,
        include_files: selection.includeFiles,
      });

      if (result.mode === 'sync') {
        downloadBlobFile(result.blob, result.fileName);
        alertService.success(
          t('taskExportSyncSuccessTitle', { defaultValue: 'Export downloaded' }),
          t('taskExportSyncSuccessMessage', {
            defaultValue: 'Your export file has been downloaded.',
          })
        );
        return;
      }

      setIsPreparing(true);
      enqueuePendingTaskExportJob(projectId, result.job.id);
      setJobs(prev => {
        const without = prev.filter(job => job.id !== result.job.id);
        return [result.job, ...without];
      });
      alertService.success(
        t('taskExportPreparingTitle', { defaultValue: 'Preparing your export…' }),
        t('taskExportAsyncQueued', {
          defaultValue: 'Export started. You will be notified when it is ready.',
        })
      );
    } catch (error: unknown) {
      logger.error('Task export failed', error);
      const message =
        error instanceof Error
          ? error.message
          : t('taskExportFailedMessage', {
              defaultValue: 'Your export failed. Please try again.',
            });
      alertService.error(
        t('taskExportFailedTitle', { defaultValue: 'Export failed' }),
        message
      );
    } finally {
      setIsExporting(false);
    }
  }, [hasBusinessAccess, handleUpgradeClick, hasSelection, projectId, selection, t]);

  const handleDownload = useCallback(
    async (job: TaskExportPublicJob) => {
      if (!hasBusinessAccess || !job.download_available) return;
      setDownloadingJobId(job.id);
      try {
        const download = await taskExportApiService.getDownload(projectId, job.id);
        const link = document.createElement('a');
        link.href = download.url;
        link.download = download.file_name || job.file_name || 'task-export.zip';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        logger.error('Task export download failed', error);
        alertService.error(
          t('taskExportFailedTitle', { defaultValue: 'Export failed' }),
          t('taskExportDownloadExpired', {
            defaultValue: 'Export is no longer available for download.',
          })
        );
        void fetchJobs();
      } finally {
        setDownloadingJobId(null);
      }
    },
    [hasBusinessAccess, projectId, t, fetchJobs]
  );

  const columns: ColumnsType<TaskExportPublicJob> = [
    {
      title: t('taskExportIncludedColumn', { defaultValue: 'Included' }),
      dataIndex: 'included',
      key: 'included',
      render: (included: string[]) =>
        included?.length ? included.join(', ') : '—',
    },
    {
      title: t('taskExportRequestedColumn', { defaultValue: 'Requested' }),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) =>
        value ? dayjs(value).format('MMM D, YYYY h:mm A') : '—',
    },
    {
      title: t('taskExportStatusColumn', { defaultValue: 'Status' }),
      dataIndex: 'status',
      key: 'status',
      render: (status: TaskExportPublicJob['status']) => (
        <Tag color={statusColor(status)}>
          {status === 'Processing'
            ? t('taskExportStatusProcessing', { defaultValue: 'Processing' })
            : status === 'Ready'
              ? t('taskExportStatusReady', { defaultValue: 'Ready' })
              : status === 'Failed'
                ? t('taskExportStatusFailed', { defaultValue: 'Failed' })
                : t('taskExportStatusExpired', { defaultValue: 'Expired' })}
        </Tag>
      ),
    },
    {
      title: t('taskExportActionsColumn', { defaultValue: 'Actions' }),
      key: 'actions',
      render: (_: unknown, job: TaskExportPublicJob) => {
        if (job.status === 'Failed' && job.error_message) {
          return (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {job.error_message}
            </Typography.Text>
          );
        }

        if (!job.download_available) {
          return (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              —
            </Typography.Text>
          );
        }

        return (
          <Button
            type="link"
            size="small"
            loading={downloadingJobId === job.id}
            onClick={() => void handleDownload(job)}
            aria-label={t('taskExportDownload', { defaultValue: 'Download' })}
          >
            {t('taskExportDownload', { defaultValue: 'Download' })}
          </Button>
        );
      },
    },
  ];

  return (
    <Flex vertical gap={16}>
      <div>
        <Typography.Title level={5} style={{ marginBottom: 4 }}>
          {t('taskExportSectionTitle', { defaultValue: 'Task Export' })}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          {t('taskExportSectionDescription', {
            defaultValue:
              'Export this project’s tasks, comments, and attachments. Choose what to include, then download a CSV or ZIP.',
          })}
        </Typography.Paragraph>
      </div>

      {!hasBusinessAccess && (
        <Alert
          type="info"
          showIcon
          message={t('taskExportBusinessPlanTitle', {
            defaultValue: 'Business Plan Required',
          })}
          description={
            <Flex justify="space-between" align="center" gap={12} wrap="wrap">
              <Typography.Text>
                {t('taskExportBusinessPlanDescription', {
                  defaultValue:
                    'Task export is available on Business plan only.',
                })}
              </Typography.Text>
              <Button
                type="primary"
                size="small"
                icon={<CrownOutlined style={{ color: token.colorWarning }} />}
                onClick={handleUpgradeClick}
              >
                {tCommon('upgrade-now', { defaultValue: 'Upgrade Now' })}
              </Button>
            </Flex>
          }
        />
      )}

      <Flex
        vertical
        gap={12}
        style={{
          padding: 16,
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
          opacity: hasBusinessAccess ? 1 : 0.6,
          pointerEvents: hasBusinessAccess ? 'auto' : 'none',
        }}
      >
        <Typography.Text strong>
          {t('taskExportIncludeLabel', { defaultValue: 'Include in export' })}
        </Typography.Text>

        <Checkbox
          checked={selection.includeTasks}
          disabled={!hasBusinessAccess}
          onChange={event =>
            setSelection(prev => ({ ...prev, includeTasks: event.target.checked }))
          }
        >
          {t('taskExportIncludeTasks', { defaultValue: 'Tasks' })}
        </Checkbox>
        <Checkbox
          checked={selection.includeComments}
          disabled={!hasBusinessAccess}
          onChange={event =>
            setSelection(prev => ({
              ...prev,
              includeComments: event.target.checked,
            }))
          }
        >
          {t('taskExportIncludeComments', { defaultValue: 'Task Comments' })}
        </Checkbox>
        <Checkbox
          checked={selection.includeFiles}
          disabled={!hasBusinessAccess}
          onChange={event =>
            setSelection(prev => ({ ...prev, includeFiles: event.target.checked }))
          }
        >
          {t('taskExportIncludeFiles', { defaultValue: 'Files' })}
        </Checkbox>

        {!hasSelection && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('taskExportSelectOne', {
              defaultValue: 'Select at least one option to enable Export.',
            })}
          </Typography.Text>
        )}

        <Space>
          <Button
            type="primary"
            disabled={!hasBusinessAccess || !hasSelection}
            loading={isExporting}
            onClick={() => void handleExport()}
            aria-label={t('taskExportStart', { defaultValue: 'Export' })}
          >
            {t('taskExportStart', { defaultValue: 'Export' })}
          </Button>
        </Space>

        {isPreparing && (
          <Alert
            type="info"
            showIcon
            message={t('taskExportPreparingTitle', {
              defaultValue: 'Preparing your export…',
            })}
            description={t('taskExportPreparingMessage', {
              defaultValue:
                'Your export is being prepared. We will notify you when it is ready.',
            })}
          />
        )}
      </Flex>

      {hasBusinessAccess && (
        <div>
          <Typography.Title level={5} style={{ marginBottom: 8 }}>
            {t('taskExportHistoryTitle', { defaultValue: 'Recent exports' })}
          </Typography.Title>
          <Table
            rowKey="id"
            size="small"
            loading={isLoadingJobs}
            columns={columns}
            dataSource={jobs}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('taskExportHistoryEmpty', {
                    defaultValue: 'No exports yet',
                  })}
                />
              ),
            }}
          />
        </div>
      )}
    </Flex>
  );
};

export default TaskExportSettingsSection;
