import { AppDispatch } from '@/app/store';
import {
  fetchProjectData,
  setProjectId,
  setProjectData,
  toggleProjectDrawer,
} from '@/features/project/project-drawer.slice';
import { fetchProjects } from '@/features/projects/projectsSlice';
import { useAppSelector } from '@/hooks/useAppSelector';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import logger from '@/utils/errorLogger';
import { SettingOutlined, InboxOutlined } from '@/shared/antd-imports';
import { Tooltip, Button, Popconfirm, Space } from '@/shared/antd-imports';
import {
  evt_projects_archive,
  evt_projects_archive_all,
  evt_projects_settings_click,
} from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  useToggleArchiveProjectMutation,
  useToggleArchiveProjectForAllMutation,
} from '@/api/projects/projects.v1.api.service';

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
  const isProjectManager = useIsProjectManager();
  const isEditable = isOwnerOrAdmin;
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { requestParams } = useAppSelector(state => state.projectsReducer);

  // ✅ RTK Query mutations — correctly wired to the API
  const [toggleArchive] = useToggleArchiveProjectMutation();
  const [toggleArchiveForAll] = useToggleArchiveProjectForAllMutation();

  const handleSettingsClick = () => {
    if (record.id) {
      trackMixpanelEvent(evt_projects_settings_click);
      dispatch(setProjectId(record.id));
      dispatch(fetchProjectData(record.id))
        .unwrap()
        .then(projectData => {
          dispatch(
            setProjectData({
              ...projectData,
              priority_id: projectData.priority_id || record.priority_id,
              priority_name: projectData.priority_name || record.priority_name,
              priority_color: projectData.priority_color || record.priority_color,
              priority_color_dark: projectData.priority_color_dark || record.priority_color_dark,
            })
          );
          dispatch(toggleProjectDrawer());
        })
        .catch(error => {
          console.error('Failed to fetch project data:', error);
          dispatch(setProjectData(record));
          dispatch(toggleProjectDrawer());
        });
    }
  };

  const handleArchiveClick = async () => {
    if (!record.id) return;
    try {
      if (isOwnerOrAdmin) {
        trackMixpanelEvent(evt_projects_archive_all);
        // ✅ Use RTK Query mutation instead of thunk
        await toggleArchiveForAll(record.id).unwrap();
      } else {
        trackMixpanelEvent(evt_projects_archive);
        // ✅ Use RTK Query mutation instead of thunk
        await toggleArchive(record.id).unwrap();
      }
      // ✅ Re-fetch via thunk to update state.projectsReducer.projects
      // which is what the project list actually reads from
      dispatch(fetchProjects(requestParams));
    } catch (error) {
      logger.error('Failed to archive/unarchive project:', error);
    }
  };

  return (
    <Space size={4} onClick={e => e.stopPropagation()}>
      <Tooltip title={t('setting')}>
        <Button
          className="action-button"
          type="text"
          size="small"
          onClick={handleSettingsClick}
          style={{ width: 28, minWidth: 28, paddingInline: 0 }}
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
            type="text"
            size="small"
            style={{ width: 28, minWidth: 28, paddingInline: 0 }}
            icon={<InboxOutlined />}
            disabled={!isEditable}
          />
        </Popconfirm>
      </Tooltip>
    </Space>
  );
};
