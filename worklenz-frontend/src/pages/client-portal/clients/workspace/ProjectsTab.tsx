import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Progress, Typography, theme } from '@/shared/antd-imports';
import { useGetPortalProjectsQuery } from '@/api/client-portal/portal-projects-api';
import {
  ClientProjectStatusTag,
  PortalPagedTable,
  PortalSwitch,
  usePortalPaging,
  PortalProjectName,
} from '@/components/client-portal/v2';
import type { PortalProject } from '@/types/client-portal/v2';
import { portalPaths } from '../../portal-paths';
import { AssignProjectsToClientModal } from './AssignProjectsToClientModal';
import { useIsAdminSurfaceReadOnly } from '@/hooks/useIsAdminSurfaceReadOnly';

interface ProjectsTabProps {
  organizationId: string;
  organizationName: string;
}

/** This client's projects: switch the portal per project and jump into the project workspace to manage it. */
export const ProjectsTab = ({ organizationId, organizationName }: ProjectsTabProps) => {
  const { t } = useTranslation('client-portal-v2-clients');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const paging = usePortalPaging();
  const [assigning, setAssigning] = useState(false);
  const isReadOnly = useIsAdminSurfaceReadOnly();
  const query = useGetPortalProjectsQuery({
    organization_id: organizationId,
    page: paging.page,
    limit: paging.limit,
  });
  const list = query.data?.body;

  const columns: ColumnsType<PortalProject> = [
    {
      key: 'name',
      title: t('workspace.projects.columns.project', { defaultValue: 'Project' }),
      render: (_value, project) => <PortalProjectName name={project.name} color={project.color} fontSize={13} fontWeight={600} />,
    },
    {
      key: 'status',
      title: t('workspace.projects.columns.status', { defaultValue: 'Client-facing status' }),
      render: (_value, project) => <ClientProjectStatusTag status={project.status} />,
    },
    {
      key: 'phase',
      title: t('workspace.projects.columns.phase', { defaultValue: 'Phase' }),
      render: (_value, project) => project.phase ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      key: 'progress',
      title: t('workspace.projects.columns.progress', { defaultValue: 'Progress' }),
      width: 160,
      render: (_value, project) => (
        <Progress
          percent={project.progress}
          size="small"
          strokeColor={project.color || token.colorPrimary}
          aria-label={t('workspace.projects.progressLabel', {
            name: project.name,
            defaultValue: 'Progress of {{name}}',
          })}
        />
      ),
    },
    {
      key: 'users',
      title: t('workspace.projects.columns.users', { defaultValue: 'Users' }),
      render: (_value, project) => project.active_client_users,
    },
    {
      key: 'portal',
      title: t('workspace.projects.columns.portal', { defaultValue: 'Portal' }),
      render: (_value, project) => <PortalSwitch project={project} />,
    },
    {
      key: 'manage',
      align: 'right',
      render: (_value, project) => (
        <Button size="small" onClick={() => navigate(portalPaths.project(project.id))}>
          {t('workspace.projects.manage', { defaultValue: 'Manage' })}
        </Button>
      ),
    },
  ];

  const assignButton = isReadOnly ? null : (
    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAssigning(true)}>
      {t('workspace.projects.assign.button', { defaultValue: 'Assign project' })}
    </Button>
  );

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Typography.Text strong style={{ fontSize: 14 }}>
          {t('workspace.projects.title', { defaultValue: 'Projects' })}
        </Typography.Text>
        {assignButton}
      </Flex>
      <PortalPagedTable<PortalProject>
        ariaLabel={t('workspace.projects.tableLabel', { defaultValue: 'Projects of this client' })}
        columns={columns}
        rows={list?.items ?? []}
        rowKey={project => project.id}
        total={list?.total ?? 0}
        paging={paging}
        loading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        emptyText={
          <Flex vertical align="center" gap={12}>
            <span>
              {t('workspace.projects.emptyShort', {
                name: organizationName,
                defaultValue: 'No projects for {{name}} yet.',
              })}
            </span>
            {assignButton}
          </Flex>
        }
      />
      {assigning && (
        <AssignProjectsToClientModal
          organizationId={organizationId}
          organizationName={organizationName}
          onClose={() => setAssigning(false)}
        />
      )}
    </>
  );
};
