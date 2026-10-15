import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, SettingOutlined } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchProjectData, setProjectId } from '@/features/project/project-drawer.slice';
import { openProjectSettingsModal } from '@/features/project/project-settings-modal.slice';
import logger from '@/utils/errorLogger';

const DISMISSED_KEY_PREFIX = 'wl_project_setup_banner_dismissed_';

interface ProjectSetupBannerProps {
  projectId: string;
}

/**
 * A one-time banner shown on first visit to a newly-created project,
 * prompting the user to configure settings via the gear icon.
 *
 * It reads/writes a localStorage flag per project so it only appears once
 * and is never shown again after dismissal.
 */
export const ProjectSetupBanner = ({ projectId }: ProjectSetupBannerProps) => {
  const { t } = useTranslation('project-setup-banner');
  const dispatch = useAppDispatch();

  const storageKey = `${DISMISSED_KEY_PREFIX}${projectId}`;
  const [visible, setVisible] = useState(false);

  // Determine visibility after mount to avoid SSR mismatch
  useEffect(() => {
    if (!projectId) return;
    const dismissed = localStorage.getItem(storageKey);
    setVisible(!dismissed);
  }, [projectId, storageKey]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
  }, [storageKey]);

  const handleOpenSettings = useCallback(() => {
    if (!projectId) return;
    dispatch(setProjectId(projectId));
    dispatch(fetchProjectData(projectId))
      .unwrap()
      .catch(err => {
        logger.error('Failed to fetch project data from setup banner', err);
      })
      .finally(() => {
        dispatch(openProjectSettingsModal());
      });
    // Dismiss banner once user has opened settings
    handleDismiss();
  }, [dispatch, projectId, handleDismiss]);

  if (!visible) return null;

 
};

export default ProjectSetupBanner;
