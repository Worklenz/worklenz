import { memo, useState, useEffect } from 'react';
import { Button, Checkbox, Dropdown, Flex, Input, Typography, Spin } from '@/shared/antd-imports';
import { CaretDownFilled, SearchOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { useAuthService } from '@/hooks/useAuth';
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
  const currentSession = useAuthService().getCurrentSession();
  
  const { selectedProjects } = useAppSelector(state => state.allTasksReportsReducer);
  
  const [projects, setProjects] = useState<IProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      if (!currentSession?.team_id) return;
      setLoading(true);
      try {
        const response = await reportingApiService.getOverviewProjectsByTeam(currentSession.team_id);
        if (response.done) {
          setProjects(response.body as IProject[]);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [currentSession?.team_id]);

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
    <Flex vertical gap={8} style={{ padding: 12, minWidth: 250 }}>
      <Input
        placeholder={t('searchPlaceholder')}
        prefix={<SearchOutlined />}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        allowClear
      />
      <Flex justify="flex-end">
        <Button type="link" size="small" onClick={handleClearAll}>
          {t('clearAll')}
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
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button>
        <Flex align="center" gap={4}>
          {t('projectsFilter')}
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
