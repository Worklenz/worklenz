import { memo, useState, useEffect, useMemo, useRef } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  Input,
  Typography,
  Spin,
} from '@/shared/antd-imports';
import { CaretDownFilled, SearchOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import {
  setSelectedProjects,
  toggleProject,
  fetchAllTasks,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

interface IProject {
  id: string;
  name: string;
  color_code?: string;
}

const AllTasksProjectFilter = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();

  const { selectedProjects, teams } = useAppSelector(state => state.allTasksReportsReducer);

  const [projects, setProjects] = useState<IProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const previousProjectsRef = useRef<IProject[]>([]);

  // Get selected team IDs
  const selectedTeamIds = useMemo(() => {
    return teams.filter(team => team.selected).map(team => team.id as string);
  }, [teams]);

  useEffect(() => {
    const fetchProjects = async () => {
      // Don't fetch if no teams are selected
      if (selectedTeamIds.length === 0) {
        setProjects([]);
        previousProjectsRef.current = [];
        return;
      }

      setLoading(true);
      try {
        // Fetch projects from all selected teams
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
        previousProjectsRef.current = allProjects;
      } catch (error) {
        console.error('Error fetching projects:', error);
        setProjects([]);
        previousProjectsRef.current = [];
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [selectedTeamIds]);

  // Clear selected projects that are no longer available when projects change
  useEffect(() => {
    if (projects.length === 0 && selectedProjects.length > 0) {
      // If no projects available, clear all selections
      dispatch(setSelectedProjects([]));
      return;
    }

    // Check if projects list actually changed
    const previousProjectIds = new Set(previousProjectsRef.current.map(p => p.id));
    const currentProjectIds = new Set(projects.map(p => p.id));

    // Only clear if the projects list changed (not just a re-render)
    const projectsChanged =
      previousProjectIds.size !== currentProjectIds.size ||
      [...previousProjectIds].some(id => !currentProjectIds.has(id)) ||
      [...currentProjectIds].some(id => !previousProjectIds.has(id));

    if (projectsChanged && projects.length > 0) {
      const availableProjectIds = new Set(projects.map(p => p.id));
      const invalidSelectedProjects = selectedProjects.filter(
        projectId => !availableProjectIds.has(projectId)
      );
      if (invalidSelectedProjects.length > 0) {
        const validSelectedProjects = selectedProjects.filter(projectId =>
          availableProjectIds.has(projectId)
        );
        dispatch(setSelectedProjects(validSelectedProjects));
      }
    }
  }, [projects, selectedProjects, dispatch]);

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (projectId: string) => {
    dispatch(toggleProject(projectId));
    dispatch(fetchAllTasks());
  };

  const handleClearAll = () => {
    dispatch(setSelectedProjects([]));
    dispatch(fetchAllTasks());
  };

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 280 } }}>
      <Flex vertical gap={8}>
        <Input
          placeholder={t('searchPlaceholder', {
            defaultValue: 'Search by task name, key, or description',
          })}
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
        />
        <Flex justify="flex-end">
          <Button type="link" size="small" onClick={handleClearAll}>
            {t('clearAll', { defaultValue: 'Clear All' })}
          </Button>
        </Flex>
        {loading ? (
          <Flex justify="center" style={{ padding: 16 }}>
            <Spin size="small" />
          </Flex>
        ) : (
          <Flex vertical gap={4} style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filteredProjects.map(project => (
              <Checkbox
                key={project.id}
                checked={selectedProjects.includes(project.id)}
                onChange={() => handleToggle(project.id)}
              >
                <Flex align="center" gap={8}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: project.color_code || '#1890ff',
                    }}
                  />
                  {project.name}
                </Flex>
              </Checkbox>
            ))}
          </Flex>
        )}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button>
        <Flex align="center" gap={4}>
          {t('projectsFilter', { defaultValue: 'Projects' })}
          {selectedProjects.length > 0 && (
            <Typography.Text type="secondary">({selectedProjects.length})</Typography.Text>
          )}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(AllTasksProjectFilter);
