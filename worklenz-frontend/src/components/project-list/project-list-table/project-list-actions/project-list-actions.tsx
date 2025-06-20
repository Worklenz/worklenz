import { useGetProjectsQuery } from '@/api/projects/projects.v1.api.service';
import { AppDispatch } from '@/app/store';
import {
  fetchProjectData,
  setProjectId,
  toggleProjectDrawer,
} from '@/features/project/project-drawer.slice';
import {
  toggleArchiveProjectForAll,
  toggleArchiveProject,
} from '@/features/projects/projects-slice';
import { useAppSelector } from '@/hooks/use-app-selector';
import useIsProjectManager from '@/hooks/use-is-project-manager';
import { IProjectViewModel } from '@/types/project/project-view-model.types';
import logger from '@/utils/error-logger';
import { SettingOutlined, InboxOutlined } from '@ant-design/icons';
import { Tooltip, Button, Popconfirm, Space } from '@/components/ui';
import { useMixpanelTracking } from '@/hooks/use-mixpanel-tracking';
import {
  evt_projects_settings_click,
  evt_projects_archive_all,
  evt_projects_archive,
} from '@/shared/worklenz-analytics-events';

interface ActionButtonsProps {
  t: (key: string) => string;
  record: IProjectViewModel;
  dispatch: AppDispatch;
  isOwnerOrAdmin: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  t,
  record,
  dispatch,
  isOwnerOrAdmin,
}) => {
  // Add permission hooks
  const isProjectManager = useIsProjectManager();
  const isEditable = isOwnerOrAdmin;
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { requestParams } = useAppSelector(state => state.projectsReducer);
  const { refetch: refetchProjects } = useGetProjectsQuery(requestParams);

  const handleSettingsClick = () => {
    if (record.id) {
      trackMixpanelEvent(evt_projects_settings_click);
      dispatch(setProjectId(record.id));
      dispatch(fetchProjectData(record.id));
      dispatch(toggleProjectDrawer());
    }
  };

  const handleArchiveClick = async () => {
    if (!record.id) return;
    try {
      if (isOwnerOrAdmin) {
        trackMixpanelEvent(evt_projects_archive_all);
        await dispatch(toggleArchiveProjectForAll(record.id));
      } else {
        trackMixpanelEvent(evt_projects_archive);
        await dispatch(toggleArchiveProject(record.id));
      }
      refetchProjects();
    } catch (error) {
      logger.error('Failed to archive project:', error);
    }
  };

  return (
    <Space onClick={e => e.stopPropagation()}>
      <Tooltip title={t('setting')}>
        <Button
          className="action-button"
          size="small"
          onClick={handleSettingsClick}
          icon={<SettingOutlined />}
        />
      </Tooltip>
      <Tooltip
        title={isEditable ? (record.archived ? t('unarchive') : t('archive')) : t('noPermission')}
      >
        <Popconfirm
          title={record.archived ? t('unarchive') : t('archive')}
          description={record.archived ? t('unarchiveConfirm') : t('archiveConfirm')}
          onConfirm={handleArchiveClick}
          okText={t('yes')}
          cancelText={t('no')}
          disabled={!isEditable}
        >
          <Button
            className="action-button"
            size="small"
            icon={<InboxOutlined />}
            disabled={!isEditable}
          />
        </Popconfirm>
      </Tooltip>
    </Space>
  );
};
