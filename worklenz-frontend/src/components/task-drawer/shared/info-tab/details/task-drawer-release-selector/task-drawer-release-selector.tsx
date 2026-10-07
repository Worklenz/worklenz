import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Select, Tooltip, Typography, message } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useEnsureProjectReleases } from '@/hooks/useEnsureProjectReleases';
import { projectReleasesApiService } from '@/api/project-releases/project-releases.api.service';
import { fetchProjectReleases } from '@/features/projects/singleProject/releases/releases.slice';
import { setTaskRelease } from '@/features/task-drawer/task-drawer.slice';
import { isAnnouncedApiError } from '@/components/projects/releases/release-utils';
import { ITaskViewModel } from '@/types/tasks/task.types';

interface TaskDrawerReleaseSelectorProps {
  task: ITaskViewModel;
  disabled?: boolean;
}

/** Release (fix version) field. Work in a released version is read-only. */
export const TaskDrawerReleaseSelector = ({
  task,
  disabled = false,
}: TaskDrawerReleaseSelectorProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const dispatch = useAppDispatch();
  const { isLoading } = useEnsureProjectReleases(task.project_id);
  const releases = useAppSelector(state => state.releasesReducer.releases);
  const [isSaving, setIsSaving] = useState(false);
  const currentReleaseId = task.release_id ?? null;
  const currentRelease = releases.find(release => release.id === currentReleaseId);
  const isLocked = currentRelease?.status === 'released';

  const options = useMemo(
    () => [
      {
        value: NO_RELEASE_VALUE,
        label: (
          <Typography.Text type="secondary" className="text-xs">
            {t('taskInfoTab.details.noRelease', { defaultValue: 'No release' })}
          </Typography.Text>
        ),
      },
      ...releases
        .filter(release => release.status === 'unreleased' || release.id === currentReleaseId)
        .map(release => ({
          value: release.id,
          disabled: release.status === 'released',
          label:
            release.status === 'released'
              ? t('taskInfoTab.details.releasedSuffix', {
                  defaultValue: '{{name}} (Released)',
                  name: release.name,
                })
              : release.name,
        })),
    ],
    [currentReleaseId, releases, t]
  );

  const handleChange = async (value: string) => {
    if (!task.id || !task.project_id) return;
    const nextReleaseId = value === NO_RELEASE_VALUE ? null : value;
    if (nextReleaseId === currentReleaseId) return;

    dispatch(setTaskRelease({ id: task.id, release_id: nextReleaseId }));
    setIsSaving(true);
    try {
      const response = await projectReleasesApiService.assignTask(
        task.project_id,
        task.id,
        nextReleaseId
      );
      if (!response.done) throw new Error(response.message);
      void dispatch(fetchProjectReleases(task.project_id));
    } catch (error) {
      dispatch(setTaskRelease({ id: task.id, release_id: currentReleaseId }));
      if (!isAnnouncedApiError(error)) {
        message.error(
          t('taskInfoTab.details.releaseAssignError', {
            defaultValue: 'Could not change the release. Please try again.',
          })
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const label = t('taskInfoTab.details.release', { defaultValue: 'Release' });

  return (
    <Form.Item label={label}>
      <Tooltip
        title={
          isLocked
            ? t('taskInfoTab.details.releaseLocked', {
                defaultValue: 'Released versions are read-only',
              })
            : undefined
        }
      >
        <Select
          value={currentReleaseId ?? NO_RELEASE_VALUE}
          options={options}
          onChange={handleChange}
          loading={isSaving || isLoading}
          disabled={disabled || isLocked}
          popupMatchSelectWidth={false}
          style={{ width: '100%', maxWidth: 260 }}
          aria-label={label}
        />
      </Tooltip>
    </Form.Item>
  );
};

const NO_RELEASE_VALUE = '__no_release__';

export default TaskDrawerReleaseSelector;
