import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { EyeOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Modal, Result, Tabs, Typography, theme } from '@/shared/antd-imports';
import { useGetPortalProjectQuery } from '@/api/client-portal/portal-projects-api';
import { ClientProjectStatusTag, PORTAL_TOOLBAR_BUTTON_STYLE, PortalSwitch } from '@/components/client-portal/v2';
import { clientWorkspacePath } from '../clients/workspace/workspace-helpers';
import { PROJECT_TABS, ProjectTab, parseProjectTab, portalPaths } from '../portal-paths';
import { AccessTab } from './tabs/AccessTab';
import { DiscussionsTab } from './tabs/DiscussionsTab';
import { FilesTab } from './tabs/FilesTab';
import { MilestonesTab } from './tabs/MilestonesTab';
import { OverviewTab } from './tabs/OverviewTab';
import { TasksTab } from './tabs/TasksTab';
import { PortalLoader } from '@/components/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';

/**
 * One project's client-facing side (Overview, Milestones, Tasks, Files, Discussions, Client Access), opened as a modal over the Portal Projects list (the same
 * way a client opens). The list is this route's parent, so it renders underneath, including on a direct link.
 */
const ProjectWorkspacePage = () => {
  const { t } = useTranslation('client-portal-v2-projects');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId = '', tab: tabParam } = useParams<{ projectId: string; tab: string }>();
  const activeTab = parseProjectTab(tabParam);

  const projectQuery = useGetPortalProjectQuery(projectId, { skip: !projectId });
  const project = projectQuery.data?.body;

  const goToTab = (tab: ProjectTab) => navigate(portalPaths.project(projectId, tab), { replace: true });

  // Back to wherever the project was opened from, or to the list for a direct link.
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(portalPaths.projects);
  };

  const inModal = (content: ReactNode) => (
    <Modal
      open
      onCancel={goBack}
      footer={null}
      width="min(1100px, 96vw)"
      // Long content scrolls the page-level modal wrapper, so the scrollbar sits at the screen edge and never under the close button.
      style={{ top: 24, paddingBottom: 24 }}
      styles={{ body: { overflowX: 'hidden' } }}
    >
      {content}
    </Modal>
  );

  if (projectQuery.isLoading) {
    return inModal(
      <div aria-busy="true">
        <PortalLoader />
      </div>
    );
  }

  if (projectQuery.isError || !project) {
    const isNotFound = (projectQuery.error as { status?: number } | undefined)?.status === 404;
    return inModal(
      <Result
        status={isNotFound ? '404' : 'error'}
        title={
          isNotFound
            ? t('workspace.notFoundTitle', { defaultValue: 'Project not found' })
            : t('workspace.loadTitle', { defaultValue: 'Could not load this project' })
        }
        subTitle={
          isNotFound
            ? t('workspace.notFoundDescription', { defaultValue: 'It may have been removed, or the link is wrong.' })
            : t('workspace.loadDescription', { defaultValue: 'Please try again.' })
        }
        extra={[
          !isNotFound && (
            <Button key="retry" type="primary" onClick={() => projectQuery.refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          ),
          <Button key="back" type={isNotFound ? 'primary' : 'default'} onClick={() => navigate(portalPaths.projects)}>
            {t('workspace.backToProjects', { defaultValue: 'Back to Portal Projects' })}
          </Button>,
        ]}
      />
    );
  }

  const tabLabels: Record<ProjectTab, string> = {
    overview: t('workspace.tabs.overview', { defaultValue: 'Overview' }),
    milestones: t('workspace.tabs.milestones', { defaultValue: 'Milestones' }),
    tasks: t('workspace.tabs.tasks', { defaultValue: 'Tasks' }),
    files: t('workspace.tabs.files', { defaultValue: 'Files' }),
    discussions: t('workspace.tabs.discussions', { defaultValue: 'Discussions' }),
    access: t('workspace.tabs.access', { defaultValue: 'Client Access' }),
  };

  const tabContent: Record<ProjectTab, ReactNode> = {
    overview: <OverviewTab project={project} />,
    milestones: <MilestonesTab project={project} />,
    tasks: <TasksTab project={project} />,
    files: <FilesTab project={project} />,
    discussions: <DiscussionsTab project={project} />,
    access: <AccessTab project={project} />,
  };

  return inModal(
    <div>
      {/* Right margin keeps the header controls clear of the modal's close button. */}
      <Flex align="center" gap={14} wrap="wrap" style={{ marginBottom: 18, marginRight: 32 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Typography.Title level={4} style={{ margin: 0, fontSize: 18 }}>
            <span style={{ fontSize: 12, fontWeight: 400, color: token.colorTextSecondary }}>
              {t('workspace.projectNameLabel', { defaultValue: 'Project name:' })}
            </span>{' '}
            {decodeHtmlEntities(project.name)}
          </Typography.Title>
          <Flex align="center" gap={8} wrap="wrap" style={{ fontSize: 12, color: token.colorTextSecondary }}>
            <span>{t('workspace.clientLabel', { defaultValue: 'Client:' })}</span>
            {project.organization_id ? (
              <Link to={clientWorkspacePath(project.organization_id)}>{project.organization_name}</Link>
            ) : (
              <span>{t('workspace.noClient', { defaultValue: 'No client assigned' })}</span>
            )}
            {project.phase && (
              <span>
                · {t('workspace.phaseLabel', { defaultValue: 'Phase:' })} {project.phase}
              </span>
            )}
            <span>· {t('workspace.statusLabel', { defaultValue: 'Project status:' })}</span>
            <ClientProjectStatusTag status={project.status} />
          </Flex>
        </div>
        <Flex align="center" gap={8} style={{ fontSize: 12.5 }}>
          <span style={{ color: token.colorTextSecondary }}>
            {t('workspace.clientPortal', { defaultValue: 'Client Portal' })}
          </span>
          <PortalSwitch project={project} />
        </Flex>
        <Button
          style={PORTAL_TOOLBAR_BUTTON_STYLE}
          icon={<EyeOutlined />}
          disabled={!project.portal_enabled}
          onClick={() => navigate(`${portalPaths.preview}?project=${project.id}`)}
        >
          {t('workspace.previewAsClient', { defaultValue: 'Preview as client' })}
        </Button>
      </Flex>

      {!project.organization_id && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('workspace.noClientBanner', {
            defaultValue:
              'This project has no client yet. Link it to a client on the Client Access tab, or pick it when you add a client. Then the Client Portal can be switched on.',
          })}
        />
      )}
      {project.organization_id && !project.portal_enabled && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('workspace.portalOffBanner', {
            defaultValue:
              'The Client Portal is off for this project. Clients cannot see anything here, even items marked Client Visible. Turn it on to share.',
          })}
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={key => goToTab(key as ProjectTab)}
        destroyOnHidden
        items={PROJECT_TABS.map(key => ({ key, label: tabLabels[key], children: tabContent[key] }))}
      />
    </div>
  );
};

export default ProjectWorkspacePage;
