import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Button,
  Empty,
  Flex,
  PlusOutlined,
  Progress,
  Result,
  Table,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { fetchProjectReleases } from '@/features/projects/singleProject/releases/releases.slice';
import { IProjectRelease } from '@/types/project/projectRelease.types';
import {
  ReleaseConfidenceLabel,
  ReleaseStatusTag,
} from '@/components/projects/releases/release-badges';
import { ReleaseFormModal } from '@/components/projects/releases/release-form-modal';
import { ReleaseDetailModal } from '@/components/projects/releases/release-detail-modal';
import { ReleaseWorkPickerModal } from '@/components/projects/releases/release-work-picker-modal';
import {
  formatReleaseDate,
  getReleaseConfidence,
  getReleaseProgress,
} from '@/components/projects/releases/release-utils';

/** Software-project Releases: versions that group features and fixes shipped together. */
export const ProjectViewReleases = () => {
  const { t } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const { projectId } = useParams();
  const { releases, isLoading, hasError } = useAppSelector(state => state.releasesReducer);
  const isGuest = useAppSelector(state => state.projectReducer.project?.is_guest === true);
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const canManageReleases = (isOwnerOrAdmin || isProjectManager) && !isGuest;
  const canEditReleaseItems = !isGuest;

  const [formState, setFormState] = useState<ReleaseFormState>({ isOpen: false, release: null });
  const [detailReleaseId, setDetailReleaseId] = useState<string | null>(null);
  const [pickerRelease, setPickerRelease] = useState<IProjectRelease | null>(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);

  useEffect(() => {
    if (projectId) void dispatch(fetchProjectReleases(projectId));
  }, [dispatch, projectId]);

  const handleRetry = () => {
    if (projectId) void dispatch(fetchProjectReleases(projectId));
  };

  const handleOpenCreate = () => setFormState({ isOpen: true, release: null });
  const handleOpenEdit = (release: IProjectRelease) => setFormState({ isOpen: true, release });
  const handleCloseForm = () => setFormState({ isOpen: false, release: null });

  const handleReleaseSaved = (release: IProjectRelease, isNew: boolean) => {
    if (isNew) setDetailReleaseId(release.id);
  };

  const handleWorkAdded = () => {
    setPickerRelease(null);
    setDetailRefreshKey(key => key + 1);
  };

  const columns: TableColumnsType<IProjectRelease> = [
    {
      key: 'release',
      title: t('releaseColumnRelease', { defaultValue: 'Release' }),
      render: (_, release) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setDetailReleaseId(release.id)}
            className="border-0 bg-transparent p-0 font-bold cursor-pointer hover:underline focus-visible:outline focus-visible:outline-2"
            style={{ color: token.colorPrimary }}
            aria-label={t('releaseOpenDetails', {
              defaultValue: 'Open {{name}} details',
              name: release.name,
            })}
          >
            {release.name}
          </button>
          {release.description && (
            <Typography.Text type="secondary" className="block truncate text-[11px] mt-0.5">
              {release.description}
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      title: t('releaseColumnStatus', { defaultValue: 'Status' }),
      width: 130,
      render: (_, release) => <ReleaseStatusTag status={release.status} />,
    },
    {
      key: 'target',
      title: t('releaseColumnTarget', { defaultValue: 'Target' }),
      width: 140,
      render: (_, release) =>
        formatReleaseDate(release.target_date) ?? (
          <Typography.Text type="secondary">–</Typography.Text>
        ),
    },
    {
      key: 'progress',
      title: t('releaseColumnProgress', { defaultValue: 'Progress' }),
      width: 190,
      render: (_, release) => {
        const progress = getReleaseProgress(release);
        return (
          <Flex align="center" gap={8}>
            <Progress
              percent={progress}
              showInfo={false}
              size="small"
              style={{ width: 110, margin: 0 }}
              aria-label={t('releaseProgressAria', {
                defaultValue: '{{percent}}% complete',
                percent: progress,
              })}
            />
            <span className="text-xs">{progress}%</span>
          </Flex>
        );
      },
    },
    {
      key: 'criticalBugs',
      title: t('releaseColumnCriticalBugs', { defaultValue: 'Critical bugs' }),
      width: 120,
      align: 'center',
      render: (_, release) => (
        <span
          className="font-semibold"
          style={{
            color: release.open_critical_bug_count ? token.colorError : token.colorTextSecondary,
          }}
        >
          {release.open_critical_bug_count}
        </span>
      ),
    },
    {
      key: 'confidence',
      title: t('releaseColumnConfidence', { defaultValue: 'Confidence' }),
      width: 140,
      render: (_, release) => <ReleaseConfidenceLabel confidence={getReleaseConfidence(release)} />,
    },
  ];

  if (!projectId) return null;

  return (
    <div className="flex flex-col gap-3">
      <Flex align="center" gap={8} wrap="wrap">
        <Typography.Text type="secondary" className="text-[13px]">
          {t('releasesDescription', {
            defaultValue: 'Versions group features and fixes shipped together.',
          })}
        </Typography.Text>
        {canManageReleases && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            className="ml-auto"
            onClick={handleOpenCreate}
          >
            {t('newRelease', { defaultValue: 'New release' })}
          </Button>
        )}
      </Flex>

      {hasError ? (
        <Result
          status="warning"
          title={t('releasesLoadError', { defaultValue: 'Could not load releases' })}
          extra={<Button onClick={handleRetry}>{t('retry', { defaultValue: 'Retry' })}</Button>}
        />
      ) : (
        <Table<IProjectRelease>
          rowKey="id"
          columns={columns}
          dataSource={releases}
          loading={isLoading && !releases.length}
          pagination={false}
          scroll={{ x: 800 }}
          style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Flex vertical gap={2}>
                    <strong>{t('releasesEmptyTitle', { defaultValue: 'No releases yet' })}</strong>
                    <Typography.Text type="secondary" className="text-xs">
                      {t('releasesEmptyHint', {
                        defaultValue:
                          'Create a release to plan which work ships together and track its progress.',
                      })}
                    </Typography.Text>
                  </Flex>
                }
              >
                {canManageReleases && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                    {t('newRelease', { defaultValue: 'New release' })}
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      )}

      <ReleaseFormModal
        open={formState.isOpen}
        projectId={projectId}
        release={formState.release}
        canSelectWork={canEditReleaseItems}
        onClose={handleCloseForm}
        onSaved={handleReleaseSaved}
      />

      <ReleaseDetailModal
        open={!!detailReleaseId}
        projectId={projectId}
        releaseId={detailReleaseId}
        canManage={canManageReleases}
        canEditItems={canEditReleaseItems}
        refreshKey={detailRefreshKey}
        onClose={() => setDetailReleaseId(null)}
        onEdit={handleOpenEdit}
        onAddWork={setPickerRelease}
      />

      <ReleaseWorkPickerModal
        open={!!pickerRelease}
        projectId={projectId}
        release={pickerRelease}
        onClose={() => setPickerRelease(null)}
        onAdded={handleWorkAdded}
      />
    </div>
  );
};

interface ReleaseFormState {
  isOpen: boolean;
  release: IProjectRelease | null;
}

export default ProjectViewReleases;
