import {
  useGetProjectsQuery,
  useToggleFavoriteProjectMutation,
} from '@/api/projects/projects.v1.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { Badge } from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import { NavigateFunction } from 'react-router-dom';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { getProjectDefaultTab } from '@/lib/project/software-project';

export const ProjectNameCell: React.FC<{
  record: IProjectViewModel;
  t: TFunction;
  navigate: NavigateFunction;
}> = ({ record, t, navigate }) => {
  const dispatch = useAppDispatch();
  const [toggleFavoriteProject] = useToggleFavoriteProjectMutation();
  const { requestParams } = useAppSelector(state => state.projectsReducer);
  const { refetch: refetchProjects } = useGetProjectsQuery(requestParams);

  const selectProject = (record: IProjectViewModel) => {
    if (!record.id) return;

    const viewTab = getProjectDefaultTab(record.team_member_default_view, record.project_type);

    const searchParams = new URLSearchParams({
      tab: viewTab,
      pinned_tab: viewTab,
    });

    navigate({
      pathname: `/worklenz/projects/${record.id}`,
      search: searchParams.toString(),
    });
  };

  return (
    <div className="flex items-center min-w-0">
      {/* FIX: Use record.color_code instead of hardcoded "geekblue" */}
      <Badge color={record.color_code || '#4096ff'} className="mr-2" />
      <span className="min-w-0 cursor-pointer">
        <span
          className="block truncate"
          onClick={() => selectProject(record)}
          title={decodeHtmlEntities(record.name) || ''}
        >
          {decodeHtmlEntities(record.name)}
        </span>
      </span>
    </div>
  );
};
