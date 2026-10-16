import React from 'react';
import { Badge, Flex, Modal, Tabs, Tag, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useGetProjectQuery, useGetThreadsQuery } from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useFormatters } from '@/hooks/useFormatters';
import { useResponsive } from '@/hooks/useResponsive';
import { ProjectName, QueryState, StatusTag, useRoleLabel } from '@/components/v2';
import { MODAL_TABS, toModalTab, type ProjectModalIntent, type ProjectModalTab, type ProjectTab } from '@/utils/targets';
import { TAB_LABELS } from './tabLabels';
import { DiscussionsView } from '../discussions/DiscussionsView';
import { FilesTab } from './FilesTab';
import { MembersTab } from './MembersTab';
import { MilestonesTab } from './MilestonesTab';
import { OverviewTab } from './OverviewTab';
import { TasksTab } from './TasksTab';

interface ProjectModalProps {
  projectId: string | null;
  tab: ProjectModalTab;
  intent?: ProjectModalIntent;
  onTabChange: (tab: ProjectModalTab) => void;
  onClose: () => void;
}

const tabLabel = (tab: ProjectModalTab, t: ReturnType<typeof useTranslation>['t']): string =>
  tab === 'members'
    ? t('projects.tabs.members', { defaultValue: 'Members' })
    : t(TAB_LABELS[tab as ProjectTab].key, { defaultValue: TAB_LABELS[tab as ProjectTab].label });

/** One project in a dialog: the same tabs as the project page, plus Members. Opened from the projects table. */
export const ProjectModal: React.FC<ProjectModalProps> = ({ projectId, tab, intent, onTabChange, onClose }) => {
  const { t } = useTranslation();
  const { role } = useClientAccess();
  const roleLabel = useRoleLabel();
  const { date } = useFormatters();
  const { isMobile } = useResponsive();
  const query = useGetProjectQuery(projectId ?? '', { skip: !projectId });
  const { data: threads } = useGetThreadsQuery({ projectId: projectId ?? '' }, { skip: !projectId });
  const unread = threads?.filter(thread => thread.unread).length ?? 0;
  const project = query.data;

  return (
    <Modal
      open={Boolean(projectId)}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={isMobile ? '100%' : 960}
      style={isMobile ? { top: 0, maxWidth: '100vw', margin: 0, paddingBottom: 0 } : { top: 40 }}
      styles={{ body: { maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' } }}
      title={project ? <ProjectName name={project.name} color={project.color} /> : t('projects.title', { defaultValue: 'Projects' })}
    >
      <QueryState {...query} refetch={query.refetch} onBack={onClose} backLabel={t('common.close', { defaultValue: 'Close' })}>
        {project && (
          <div>
            <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 8 }}>
              <Typography.Text type="secondary">
                {[project.phase, t('projects.expectedOn', { date: date(project.expected_completion), defaultValue: 'Expected completion {{date}}' })]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography.Text>
              <Flex gap={8} align="center">
                <StatusTag kind="project" status={project.status} />
                {role && (
                  <Tag color="blue" style={{ margin: 0 }}>
                    {t('projects.yourRole', { defaultValue: 'Your role' })}: {roleLabel(role)}
                  </Tag>
                )}
              </Flex>
            </Flex>

            <Tabs
              activeKey={tab}
              onChange={key => onTabChange(toModalTab(key))}
              items={MODAL_TABS.map(key => ({
                key,
                label:
                  key === 'discussions' && unread > 0 ? (
                    <Badge dot offset={[6, 0]} aria-label={t('projects.unreadDiscussions', { defaultValue: 'Unread discussions' })}>
                      {tabLabel(key, t)}
                    </Badge>
                  ) : (
                    tabLabel(key, t)
                  ),
              }))}
            />

            {tab === 'overview' && <OverviewTab project={project} />}
            {tab === 'milestones' && <MilestonesTab project={project} />}
            {tab === 'tasks' && <TasksTab project={project} />}
            {tab === 'files' && <FilesTab project={project} autoOpenUpload={intent === 'upload'} />}
            {tab === 'discussions' && <DiscussionsView project={project} autoOpenNew={intent === 'discussion'} />}
            {tab === 'members' && <MembersTab project={project} />}
          </div>
        )}
      </QueryState>
    </Modal>
  );
};
