import { useAuthService } from '@/hooks/useAuth';
import { useAppSelector } from '@/hooks/useAppSelector';

const useIsProjectManager = () => {
  const currentSession = useAuthService().getCurrentSession();
  const { project: currentProject } = useAppSelector(state => state.projectReducer);
  const { project: drawerProject } = useAppSelector(state => state.projectDrawerReducer);

  // Check if user is project manager for either the current project or drawer project
  const isManagerOfCurrentProject =
    currentSession?.team_member_id === currentProject?.project_manager?.id;
  const isManagerOfDrawerProject =
    currentSession?.team_member_id === drawerProject?.project_manager?.id;

  return isManagerOfCurrentProject || isManagerOfDrawerProject;
};

export default useIsProjectManager;
