import React from 'react';
import { Badge, Button, Flex, Tabs, Tag, Typography, ArrowLeftOutlined } from '@/shared/antd-imports';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetProjectQuery, useGetThreadsQuery } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useFormatters } from '@/hooks/useFormatters';
import { QueryState, StatusTag, useRoleLabel } from '@/components/v2';
import { PROJECT_TABS, toProjectTab } from '@/utils/targets';
import { TAB_LABELS } from './project/tabLabels';
import { OverviewTab } from './project/OverviewTab';
import { MilestonesTab } from './project/MilestonesTab';
import { TasksTab } from './project/TasksTab';
import { FilesTab } from './project/FilesTab';
import { DiscussionsView } from './discussions/DiscussionsView';

/** One project: header, role, and five tabs. An unknown tab opens Overview. */
export const ProjectWorkspacePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId = '', tab: tabParam } = useParams();
  const tab = toProjectTab(tabParam);
  const { role } = useClientAccess();
  const roleLabel = useRoleLabel();
  const { date } = useFormatters();
  const query = useGetProjectQuery(projectId);
  const { data: threads } = useGetThreadsQuery({ projectId });
  const unread = threads?.filter(thread => thread.unread).length ?? 0;
  const project = query.data;

  return (
    <QueryState
      {...query}
      refetch={query.refetch}
      onBack={() => navigate('/projects')}
      backLabel={t('projects.backToProjects', { defaultValue: 'Back to projects' })}
    >
      {project && (
        <div>
          <Button
            icon={<ArrowLeftOutlined />}
            size="small"
            onClick={() => navigate('/projects')}
            style={{ marginBottom: 14 }}
          >
            {t('projects.title', { defaultValue: 'Projects' })}
          </Button>
          <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12} style={{ marginBottom: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {project.name}
              </Typography.Title>
              <Typography.Text type="secondary">
                {[project.phase, t('projects.expectedOn', { date: date(project.expected_completion), defaultValue: 'Expected completion {{date}}' })]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography.Text>
            </div>
            <Flex gap={8} align="center">
              <StatusTag kind="project" status={project.status} />
              {role && (
                <Tag color="blue">
                  {t('projects.yourRole', { defaultValue: 'Your role' })}: {roleLabel(role)}
                </Tag>
              )}
            </Flex>
          </Flex>

          <Tabs
            activeKey={tab}
            onChange={key => navigate(`/projects/${project.id}/${key}`)}
            items={PROJECT_TABS.map(key => ({
              key,
              label:
                key === 'discussions' && unread > 0 ? (
                  <Badge dot offset={[6, 0]} aria-label={t('projects.unreadDiscussions', { defaultValue: 'Unread discussions' })}>
                    {t(TAB_LABELS[key].key, { defaultValue: TAB_LABELS[key].label })}
                  </Badge>
                ) : (
                  t(TAB_LABELS[key].key, { defaultValue: TAB_LABELS[key].label })
                ),
            }))}
          />

          {tab === 'overview' && <OverviewTab project={project} />}
          {tab === 'milestones' && <MilestonesTab project={project} />}
          {tab === 'tasks' && <TasksTab project={project} />}
          {tab === 'files' && <FilesTab project={project} />}
          {tab === 'discussions' && <DiscussionsView project={project} />}
        </div>
      )}
    </QueryState>
  );
};

export default ProjectWorkspacePage;
