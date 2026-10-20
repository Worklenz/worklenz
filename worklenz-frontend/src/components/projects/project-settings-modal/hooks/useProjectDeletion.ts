import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notification } from '@/shared/antd-imports';

import {
  useDeleteProjectMutation,
  useGetProjectsQuery,
} from '@/api/projects/projects.v1.api.service';
import { setProject, setProjectId } from '@/features/project/project.slice';
import { setProjectData } from '@/features/project/project-drawer.slice';
import { closeProjectSettingsModal } from '@/features/project/project-settings-modal.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import logger from '@/utils/errorLogger';
import { decodeHtmlEntities } from '@/utils/html-entities';

export const useProjectDeletion = (
  projectId: string | null,
  project: IProjectViewModel | null | undefined
) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation('project-drawer');
  const { requestParams } = useAppSelector(state => state.projectsReducer);
  const { refetch: refetchProjects } = useGetProjectsQuery(requestParams);
  const [deleteProject] = useDeleteProjectMutation();
  const [isDeletingProject, setIsDeletingProject] = useState<boolean>(false);

  const handleDeleteProject = useCallback(async () => {
    if (!projectId) return;

    setIsDeletingProject(true);
    try {
      const projectName = decodeHtmlEntities(project?.name ?? '');
      const res = await deleteProject(projectId);

      if (res?.data?.done) {
        dispatch(setProject({} as IProjectViewModel));
        dispatch(setProjectData({} as IProjectViewModel));
        dispatch(setProjectId(null));
        dispatch(closeProjectSettingsModal());
        navigate('/worklenz/projects');
        refetchProjects();

        notification.success({
          message: 'Project deleted',
          description: `"${projectName}" has been permanently deleted.`,
          duration: 3,
        });

        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        const errorMessage =
          res?.data?.message ||
          t('deleteProjectError', { defaultValue: 'Failed to delete project. Please try again.' });
        notification.error({ message: errorMessage });
        logger.error('Error deleting project', res?.data?.message);
      }
    } catch (error) {
      logger.error('Error deleting project', error);
    } finally {
      setIsDeletingProject(false);
    }
  }, [projectId, project, deleteProject, dispatch, navigate, refetchProjects]);

  return { handleDeleteProject, isDeletingProject };
};
