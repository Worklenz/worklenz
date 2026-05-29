import { useEffect, useMemo, useRef, useState } from 'react';
import { notification } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import alertService from '@/services/alerts/alertService';
import { getImportProgress } from '@/api/imports';

const STORAGE_KEY = 'worklenz.imports.pending_jobs';

const readPendingJobs = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  } catch {
    return [];
  }
};

const writePendingJobs = (jobIds: string[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(new Set(jobIds))));
};

export const enqueuePendingImportJob = (jobId: string) => {
  const trimmed = String(jobId || '').trim();
  if (!trimmed) return;
  const existing = readPendingJobs();
  writePendingJobs([...existing, trimmed]);
};

// Track which jobs already have an open "in-progress" notification so we
// don't open duplicates on every poll tick.
const inProgressNotified = new Set<string>();

export const ImportProgressNotifier = () => {
  const { t } = useTranslation('settings/import-export');
  const [pendingJobs, setPendingJobs] = useState<string[]>(() => readPendingJobs());
  const isPollingRef = useRef(false);

  const pendingKey = useMemo(() => pendingJobs.sort().join('|'), [pendingJobs]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setPendingJobs(readPendingJobs());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    writePendingJobs(pendingJobs);
  }, [pendingKey]); // stable write after state changes

  useEffect(() => {
    if (!pendingJobs.length) return;

    const pollOnce = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const nextPending: string[] = [];

        for (const jobId of pendingJobs) {
          try {
            const progress = await getImportProgress(jobId);
            const status = progress?.job?.status;

            if (status === 'success') {
              // Close the in-progress notification if it was opened.
              notification.destroy(jobId);
              inProgressNotified.delete(jobId);
              alertService.success(
                t('importNotifications.completedTitle', { defaultValue: 'Import completed' }),
                t('importNotifications.completedMessage', {
                  defaultValue: 'Your import job finished successfully.',
                })
              );
              continue;
            }

            if (status === 'failed') {
              notification.destroy(jobId);
              inProgressNotified.delete(jobId);
              const errorMessage = progress?.job?.error_message || null;
              alertService.error(
                t('importNotifications.failedTitle', { defaultValue: 'Import failed' }),
                errorMessage ||
                  t('importNotifications.failedMessage', {
                    defaultValue: 'Your import job failed. Please try again.',
                  })
              );
              continue;
            }

            // Show a persistent "in progress" notification for running jobs.
            if ((status === 'running' || status === 'ready') && !inProgressNotified.has(jobId)) {
              inProgressNotified.add(jobId);
              notification.open({
                key: jobId,
                message: t('importNotifications.processingTitle', { defaultValue: 'Import in progress' }),
                description: t('importNotifications.processingMessage', {
                  defaultValue: 'Your import is being processed. We will notify you when it is ready.',
                }),
                duration: 0, // keep open until dismissed or replaced
                placement: 'bottomRight',
              });
            }

            // Keep polling for pending/ready/running/unknown statuses.
            nextPending.push(jobId);
          } catch {
            // Transient network error; keep job in queue.
            nextPending.push(jobId);
          }
        }

        if (nextPending.length !== pendingJobs.length || nextPending.join('|') !== pendingJobs.join('|')) {
          setPendingJobs(nextPending);
        }
      } finally {
        isPollingRef.current = false;
      }
    };

    // Poll immediately, then every 5s while jobs exist.
    void pollOnce();
    const id = window.setInterval(() => void pollOnce(), 5000);
    return () => window.clearInterval(id);
  }, [pendingKey]); // poll set changes

  return null;
};

