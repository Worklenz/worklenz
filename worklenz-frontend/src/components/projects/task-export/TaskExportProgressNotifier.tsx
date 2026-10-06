import { useEffect, useMemo, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { notification } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import alertService from '@/services/alerts/alertService';
import { taskExportApiService } from '@/api/projects/task-export.api.service';

interface PendingExportJob {
  projectId: string;
  jobId: string;
}

const STORAGE_KEY = 'worklenz.task_exports.pending_jobs';
const PENDING_JOBS_EVENT = 'worklenz.task_exports.pending_jobs_changed';
/** Transient poll failures before dropping the job and surfacing an error. */
const MAX_CONSECUTIVE_POLL_ERRORS = 5;
/** HTTP statuses that mean the job is gone / unauthorized — stop polling. */
const TERMINAL_POLL_STATUS_CODES = new Set([401, 403, 404]);

const readPendingJobs = (): PendingExportJob[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingExportJob =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as PendingExportJob).projectId === 'string' &&
        typeof (item as PendingExportJob).jobId === 'string'
    );
  } catch {
    return [];
  }
};

const writePendingJobs = (jobs: PendingExportJob[]) => {
  const unique = new Map<string, PendingExportJob>();
  for (const job of jobs) {
    unique.set(`${job.projectId}:${job.jobId}`, job);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(unique.values())));
};

export const enqueuePendingTaskExportJob = (projectId: string, jobId: string) => {
  const trimmedProjectId = String(projectId || '').trim();
  const trimmedJobId = String(jobId || '').trim();
  if (!trimmedProjectId || !trimmedJobId) return;

  const existing = readPendingJobs();
  writePendingJobs([...existing, { projectId: trimmedProjectId, jobId: trimmedJobId }]);
  window.dispatchEvent(new CustomEvent(PENDING_JOBS_EVENT));
};

const inProgressNotified = new Set<string>();
const consecutivePollErrors = new Map<string, number>();

const getPollErrorStatus = (error: unknown): number | null => {
  if (error instanceof AxiosError && error.response?.status != null) {
    return error.response.status;
  }
  return null;
};

export const TaskExportProgressNotifier = () => {
  const { t } = useTranslation('project-drawer');
  const [pendingJobs, setPendingJobs] = useState<PendingExportJob[]>(() => readPendingJobs());
  const isPollingRef = useRef(false);

  const pendingKey = useMemo(
    () =>
      pendingJobs
        .map(job => `${job.projectId}:${job.jobId}`)
        .sort()
        .join('|'),
    [pendingJobs]
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setPendingJobs(readPendingJobs());
    };
    const onLocalChange = () => setPendingJobs(readPendingJobs());
    window.addEventListener('storage', onStorage);
    window.addEventListener(PENDING_JOBS_EVENT, onLocalChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PENDING_JOBS_EVENT, onLocalChange);
    };
  }, []);

  useEffect(() => {
    writePendingJobs(pendingJobs);
  }, [pendingKey]);

  const pendingJobsRef = useRef<PendingExportJob[]>(pendingJobs);
  useEffect(() => {
    pendingJobsRef.current = pendingJobs;
  }, [pendingJobs]);

  useEffect(() => {
    if (!pendingKey) return;

    const notifyPollFailure = (notifyKey: string) => {
      notification.destroy(notifyKey);
      inProgressNotified.delete(notifyKey);
      consecutivePollErrors.delete(notifyKey);
      alertService.error(
        t('taskExportFailedTitle', { defaultValue: 'Export failed' }),
        t('taskExportPollFailedMessage', {
          defaultValue:
            'Could not check export status. Open Project Settings → Task Export, or try again.',
        }),
        undefined,
        notifyKey
      );
    };

    const pollOnce = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const nextPending: PendingExportJob[] = [];

        for (const pending of pendingJobsRef.current) {
          const notifyKey = `${pending.projectId}:${pending.jobId}`;
          try {
            const job = await taskExportApiService.get(pending.projectId, pending.jobId);
            consecutivePollErrors.delete(notifyKey);
            const status = job?.status;

            if (status === 'Ready') {
              notification.destroy(notifyKey);
              inProgressNotified.delete(notifyKey);
              alertService.success(
                t('taskExportReadyTitle', { defaultValue: 'Your export is ready' }),
                t('taskExportReadyMessage', {
                  defaultValue:
                    'Open Project Settings → Task Export to download it.',
                }),
                undefined,
                notifyKey
              );
              continue;
            }

            if (status === 'Failed' || status === 'Expired') {
              notification.destroy(notifyKey);
              inProgressNotified.delete(notifyKey);
              alertService.error(
                t('taskExportFailedTitle', { defaultValue: 'Export failed' }),
                job.error_message ||
                  t('taskExportFailedMessage', {
                    defaultValue: 'Your export failed. Please try again.',
                  }),
                undefined,
                notifyKey
              );
              continue;
            }

            if (
              (status === 'Processing' || job.status_raw === 'queued') &&
              !inProgressNotified.has(notifyKey)
            ) {
              inProgressNotified.add(notifyKey);
              notification.open({
                key: notifyKey,
                message: t('taskExportPreparingTitle', {
                  defaultValue: 'Preparing your export…',
                }),
                description: t('taskExportPreparingMessage', {
                  defaultValue:
                    'Your export is being prepared. We will notify you when it is ready.',
                }),
                duration: 0,
                placement: 'topRight',
              });
            }

            nextPending.push(pending);
          } catch (error: unknown) {
            const statusCode = getPollErrorStatus(error);
            if (statusCode != null && TERMINAL_POLL_STATUS_CODES.has(statusCode)) {
              notifyPollFailure(notifyKey);
              continue;
            }

            const failures = (consecutivePollErrors.get(notifyKey) || 0) + 1;
            consecutivePollErrors.set(notifyKey, failures);
            if (failures >= MAX_CONSECUTIVE_POLL_ERRORS) {
              notifyPollFailure(notifyKey);
              continue;
            }

            nextPending.push(pending);
          }
        }

        setPendingJobs(nextPending);
      } finally {
        isPollingRef.current = false;
      }
    };

    void pollOnce();
    const timer = window.setInterval(() => {
      void pollOnce();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [pendingKey, t]);

  return null;
};
