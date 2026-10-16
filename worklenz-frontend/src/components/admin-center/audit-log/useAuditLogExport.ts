import React from 'react';
import { message } from '@/shared/antd-imports';
import type { TFunction } from 'i18next';
import {
  useExportAuditLogMutation,
  useGetExportDownloadUrlMutation,
  useGetExportJobQuery,
  useGetLatestExportJobQuery,
} from '@/api/admin-center/audit-log.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  dismissExportJob,
  selectAuditLogState,
  trackExportJob,
} from '@/features/admin-center/audit-log/audit-log.slice';
import { IAuditLogExportJob, IAuditLogQueryParams } from '@/types/admin-center/audit-log.types';
import logger from '@/utils/errorLogger';

const JOB_POLL_INTERVAL_MS = 4000;
const RESUMABLE_STATUSES: IAuditLogExportJob['status'][] = ['queued', 'processing', 'ready'];

export const isExportJobActive = (job: IAuditLogExportJob | undefined): boolean =>
  job?.status === 'queued' || job?.status === 'processing';

const triggerDownload = (href: string, fileName: string) => {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const getErrorStatus = (error: unknown): number | string | undefined =>
  error && typeof error === 'object' && 'status' in error
    ? (error as { status: number | string }).status
    : undefined;

/**
 * Export to CSV (Audit log spec, task 7.7). Small exports download straight away; large ones
 * become a background job whose progress and download link are tracked here, including a job
 * started earlier (another tab, a reload, or another admin) that is picked up on page load.
 */
export const useAuditLogExport = (t: TFunction, queryParams: IAuditLogQueryParams) => {
  const dispatch = useAppDispatch();
  const { exportJobId, dismissedExportJobId } = useAppSelector(selectAuditLogState);
  const [exportAuditLog, { isLoading: isExporting }] = useExportAuditLogMutation();
  const [getDownloadUrl, { isLoading: isPreparingDownload }] = useGetExportDownloadUrlMutation();
  const { data: latestJob, refetch: refetchLatestJob } = useGetLatestExportJobQuery();

  const [pollingInterval, setPollingInterval] = React.useState(JOB_POLL_INTERVAL_MS);
  const { data: job } = useGetExportJobQuery(exportJobId ?? '', {
    skip: !exportJobId,
    pollingInterval,
  });

  React.useEffect(() => {
    setPollingInterval(!job || isExportJobActive(job) ? JOB_POLL_INTERVAL_MS : 0);
  }, [job]);

  React.useEffect(() => {
    if (exportJobId || !latestJob) return;
    if (latestJob.id === dismissedExportJobId) return;
    if (RESUMABLE_STATUSES.includes(latestJob.status)) dispatch(trackExportJob(latestJob.id));
  }, [latestJob, exportJobId, dismissedExportJobId, dispatch]);

  const handleExport = async () => {
    try {
      const result = await exportAuditLog(queryParams).unwrap();
      if (result.mode === 'sync') {
        const url = URL.createObjectURL(result.blob);
        triggerDownload(url, result.fileName);
        URL.revokeObjectURL(url);
        message.success(t('exportDownloaded', { defaultValue: 'Audit log exported to CSV.' }));
        return;
      }
      dispatch(trackExportJob(result.job.id));
      message.info(
        t('exportQueued', {
          defaultValue: "This export is large, so it's being prepared in the background. The download link will appear here.",
        })
      );
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        message.warning(
          t('exportAlreadyRunning', {
            defaultValue: 'An export is already being prepared for this workspace. Its progress is shown below.',
          })
        );
        const { data } = await refetchLatestJob();
        if (data) dispatch(trackExportJob(data.id));
        return;
      }
      logger.error('Error exporting audit log', error);
      message.error(t('exportError', { defaultValue: "Couldn't export the audit log. Please try again." }));
    }
  };

  const handleDownload = async () => {
    if (!job) return;
    try {
      const download = await getDownloadUrl(job.id).unwrap();
      triggerDownload(download.url, download.file_name ?? job.file_name ?? 'audit-log-export.csv');
    } catch (error) {
      logger.error('Error downloading audit log export', error);
      message.error(
        getErrorStatus(error) === 410
          ? t('exportExpired', { defaultValue: 'This export has expired. Start a new export to get a fresh file.' })
          : t('exportDownloadError', { defaultValue: "Couldn't download the export. Please try again." })
      );
    }
  };

  const handleDismiss = () => dispatch(dismissExportJob());

  return {
    job: exportJobId ? job : undefined,
    isExporting,
    isPreparingDownload,
    isExportBlocked: isExportJobActive(exportJobId ? job : undefined),
    handleExport,
    handleDownload,
    handleDismiss,
  };
};
