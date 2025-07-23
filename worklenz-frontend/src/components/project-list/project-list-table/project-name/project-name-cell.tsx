import {
  useGetProjectsQuery,
  useToggleFavoriteProjectMutation,
} from '@/api/projects/projects.v1.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { formatDateRange } from '@/utils/project-list-utils';
import { CalendarOutlined } from '@/shared/antd-imports';
import { Badge, Tooltip } from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import { NavigateFunction } from 'react-router-dom';

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

    let viewTab = 'tasks-list';
    switch (record.team_member_default_view) {
      case 'TASK_LIST':
        viewTab = 'tasks-list';
        break;
      case 'BOARD':
        viewTab = 'board';
        break;
      default:
        viewTab = 'tasks-list';
    }

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
    <div className="flex items-center">
      <Badge color="geekblue" className="mr-2" />
      <span className="cursor-pointer">
        <span onClick={() => selectProject(record)}>{record.name}</span>
        {(record.start_date || record.end_date) && (
          <Tooltip
            title={formatDateRange({
              startDate: record.start_date || null,
              endDate: record.end_date || null,
            })}
            overlayStyle={{ width: '200px' }}
          >
            <CalendarOutlined className="ml-2" />
          </Tooltip>
        )}
      </span>
    </div>
  );
};
