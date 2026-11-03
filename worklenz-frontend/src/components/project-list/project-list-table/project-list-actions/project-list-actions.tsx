import { AppDispatch } from '@/app/store';
import {
  fetchProjectData,
  setProjectId,
  setProjectData,
} from '@/features/project/project-drawer.slice';
import { openProjectSettingsModal } from '@/features/project/project-settings-modal.slice';
import { fetchProjects } from '@/features/projects/projectsSlice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDefaultProjectPermission } from '@/hooks/useDefaultProjectPermission';
import useProjectPermissions from '@/hooks/useProjectPermissions';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { PROJECT_ROLE_PERMISSIONS } from '@/types/admin-center/permission-schemes.types';
import logger from '@/utils/errorLogger';
import { SettingOutlined, InboxOutlined } from '@/shared/antd-imports';
import { Tooltip, Button, Popconfirm, Space } from '@/shared/antd-imports';
import {
  evt_projects_archive_all,
  evt_projects_settings_click,
} from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { useToggleArchiveProjectForAllMutation } from '@/api/projects/projects.v1.api.service';

interface ActionButtonsProps {
  t: (key: string, options?: { defaultValue?: string }) => string;
  record: IProjectViewModel;
  dispatch: AppDispatch;
  isOwnerOrAdmin: boolean;
}

const hasEffectiveArchivePermission = (
  record: IProjectViewModel,
  isOwnerOrAdmin: boolean,
  projectArchive: boolean | undefined,
  isProjectAccessReady: boolean,
  defaultArchivePermission: boolean
): boolean => {
  if (isOwnerOrAdmin) return true;
  if (record.permissions) return record.permissions.archive;
  if (isProjectAccessReady) return Boolean(projectArchive);
  return defaultArchivePermission;
};

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  t,
  record,
  dispatch,
  isOwnerOrAdmin,
}) => {
  const { hasPermission: hasDefaultArchivePermission } = useDefaultProjectPermission(
    PROJECT_ROLE_PERMISSIONS.ARCHIVE_PROJECT
  );
  const { permissions: projectPermissions, isReady: isProjectAccessReady } = useProjectPermissions(
    record.id
  );
  const canArchive = hasEffectiveArchivePermission(
    record,
    isOwnerOrAdmin,
    projectPermissions.archive,
    isProjectAccessReady,
    hasDefaultArchivePermission
  );
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { requestParams } = useAppSelector(state => state.projectsReducer);

  const [toggleArchiveForAll] = useToggleArchiveProjectForAllMutation();

  const isGuest = record.is_guest === true;
  const canOpenSettings = isProjectAccessReady
    ? projectPermissions.settings
    : record.permissions?.settings === true || !isGuest;

  const handleSettingsClick = () => {
    if (!record.id || !canOpenSettings) return;
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
        dispatch(openProjectSettingsModal());
      })
      .catch(error => {
        console.error('Failed to fetch project data:', error);
        dispatch(setProjectData(record));
        dispatch(openProjectSettingsModal());
      });
  };

  const handleArchiveClick = async () => {
    if (!record.id || !canArchive) return;
    try {
      trackMixpanelEvent(evt_projects_archive_all);
      await toggleArchiveForAll(record.id).unwrap();
      dispatch(fetchProjects(requestParams));
    } catch (error) {
      logger.error('Failed to archive/unarchive project:', error);
    }
  };

  return (
    <Space size={4} onClick={e => e.stopPropagation()}>
      <Tooltip
        title={
          canOpenSettings
            ? t('setting', { defaultValue: 'Settings' })
            : isGuest
              ? t('settingsDisabledForGuest', { defaultValue: 'Settings Disabled For Guest' })
              : t('noPermission', { defaultValue: 'You do not have permission' })
        }
        styles={{
          root: { maxWidth: '280px' },
          body: {
            padding: '8px 12px',
            wordBreak: 'break-word',
            wordSpacing: '0.1em',
            lineHeight: '1.5',
          },
        }}
      >
        <Button
          className="action-button"
          type="text"
          size="small"
          onClick={handleSettingsClick}
          style={{ width: 28, minWidth: 28, paddingInline: 0 }}
          icon={<SettingOutlined />}
          disabled={!canOpenSettings}
        />
      </Tooltip>
      <Tooltip
        title={canArchive ? (record.archived ? t('unarchive') : t('archive')) : t('noPermission')}
      >
        <Popconfirm
          title={record.archived ? t('unarchive') : t('archive')}
          description={record.archived ? t('unarchiveConfirm') : t('archiveConfirm')}
          onConfirm={handleArchiveClick}
          okText={t('yes')}
          cancelText={t('no')}
          disabled={!canArchive}
        >
          <Button
            className="action-button"
            type="text"
            size="small"
            style={{ width: 28, minWidth: 28, paddingInline: 0 }}
            icon={<InboxOutlined />}
            disabled={!canArchive}
          />
        </Popconfirm>
      </Tooltip>
    </Space>
  );
};
