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
} from '@/features/projects/projectsSlice';
import { useAppSelector } from '@/hooks/useAppSelector';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { useAuthService } from '@/hooks/useAuth';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import logger from '@/utils/errorLogger';
import { SettingOutlined, InboxOutlined } from '@ant-design/icons';
import { Tooltip, Button, Popconfirm, Space } from 'antd';
import {
  evt_projects_archive,
  evt_projects_archive_all,
  evt_projects_settings_click,
} from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';

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
