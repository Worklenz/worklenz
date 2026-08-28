import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';

export interface IColumnFilterItem {
  text: string;
  value: string;
}

interface IProject {
  id: string;
  name: string;
  color_code?: string;
}

const STATUS_CATEGORIES = [
  { key: 'todo', label: 'todoStatus', color: '#d9d9d9' },
  { key: 'doing', label: 'doingStatus', color: '#1890ff' },
  { key: 'done', label: 'doneStatus', color: '#52c41a' },
] as const;

export interface IAllTasksFilterOptions {
  project: IColumnFilterItem[];
  status: IColumnFilterItem[];
  priority: IColumnFilterItem[];
  assignees: IColumnFilterItem[];
}

/**
 * Custom hook that provides filter options for the Reports All Tasks table columns.
 * 
 * Fetches and formats filter options for:
 * - Projects (from selected teams)
 * - Status categories (todo, doing, done)
 * - Priorities (from backend)
 * - Team members/assignees (from backend)
 * 
 * All options are properly localized and formatted for Ant Design Table column filters.
 */
export const useAllTasksReportsFilterOptions = (): IAllTasksFilterOptions => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();

  const { teams } = useAppSelector(state => state.allTasksReportsReducer);
  const { priorities } = useAppSelector(state => state.priorityReducer);
  const { teamMembers } = useAppSelector(state => state.teamMembersReducer);

  const [projects, setProjects] = useState<IProject[]>([]);

  // Get selected team IDs
  const selectedTeamIds = useMemo(() => {
    return teams.filter(team => team.selected).map(team => team.id as string);
  }, [teams]);

  // Fetch projects based on selected teams
  useEffect(() => {
    const fetchProjects = async () => {
      if (selectedTeamIds.length === 0) {
        setProjects([]);
        return;
      }

      try {
        const projectPromises = selectedTeamIds.map(teamId =>
          reportingApiService.getOverviewProjectsByTeam(teamId)
        );

        const responses = await Promise.all(projectPromises);

        // Combine all projects and deduplicate by id
        const allProjects: IProject[] = [];
        const projectIds = new Set<string>();

        responses.forEach(response => {
          if (response.done && response.body) {
            (response.body as IProject[]).forEach(project => {
              if (!projectIds.has(project.id)) {
                projectIds.add(project.id);
                allProjects.push(project);
              }
            });
          }
        });

        setProjects(allProjects);
      } catch (error) {
        console.error('Error fetching projects for filter options:', error);
        setProjects([]);
      }
    };
    
    void fetchProjects();
  }, [selectedTeamIds]);

  // Fetch priorities if not loaded
  useEffect(() => {
    if (priorities.length === 0) {
      dispatch(fetchPriorities());
    }
  }, [dispatch, priorities.length]);

  // Fetch team members if not loaded
  useEffect(() => {
    const membersList: ITeamMemberViewModel[] = teamMembers?.data || [];
    if (membersList.length === 0) {
      dispatch(
        getTeamMembers({ index: 0, size: 100, field: null, order: null, search: null, all: true })
      );
    }
  }, [dispatch, teamMembers]);

  // Build filter options
  return useMemo(() => {
    const projectOptions: IColumnFilterItem[] = projects.map(project => ({
      text: project.name,
      value: project.id,
    }));

    const statusOptions: IColumnFilterItem[] = STATUS_CATEGORIES.map(status => ({
      text: t(status.label, { defaultValue: status.key }),
      value: status.key,
    }));

    const priorityOptions: IColumnFilterItem[] = priorities.map(priority => ({
      text: priority.name || '',
      value: priority.id || '',
    }));

    const membersList: ITeamMemberViewModel[] = teamMembers?.data || [];
    const assigneeOptions: IColumnFilterItem[] = [
      { text: t('unassigned', { defaultValue: 'Unassigned' }), value: 'unassigned' },
      ...membersList.map(member => ({
        text: member.name || '',
        value: member.id || '',
      })),
    ];

    return {
      project: projectOptions,
      status: statusOptions,
      priority: priorityOptions,
      assignees: assigneeOptions,
    };
  }, [projects, priorities, teamMembers, t]);
};
