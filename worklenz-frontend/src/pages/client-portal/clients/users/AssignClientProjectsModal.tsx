import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Checkbox, Empty, Modal, Typography, message, theme } from '@/shared/antd-imports';
import { useAssignPortalUserProjectsMutation } from '@/api/client-portal/portal-access-api';
import { useGetPortalProjectsQuery } from '@/api/client-portal/portal-projects-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { ClientProjectStatusTag, RoleTag } from '@/components/client-portal/v2';
import type { ClientUser } from '@/types/client-portal/v2';
import { PortalLoader } from '@/components/client-portal/v2';

interface AssignClientProjectsModalProps {
  user: ClientUser | null;
  onClose: () => void;
}

/**
 * Which of the organization's projects one user can open. A project whose portal is off cannot be
 * newly assigned: the user would see nothing, so staff turn the portal on first.
 */
export const AssignClientProjectsModal = ({ user, onClose }: AssignClientProjectsModalProps) => {
  const { t } = useTranslation('client-portal-v2-clients');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();
  const initialIds = useMemo(() => (user ? user.projects.map(project => project.id) : []), [user]);
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [assignProjects, { isLoading: isSaving }] = useAssignPortalUserProjectsMutation();

  const projectsQuery = useGetPortalProjectsQuery(
    { organization_id: user?.organization_id, limit: 100 },
    { skip: !user }
  );

  if (!user) return null;
  const projects = projectsQuery.data?.body?.items ?? [];

  const toggle = (projectId: string) =>
    setSelected(current =>
      current.includes(projectId) ? current.filter(id => id !== projectId) : [...current, projectId]
    );

  const save = async () => {
    const removed = initialIds.filter(id => !selected.includes(id));
    try {
      await assignProjects({ userId: user.id, projectIds: selected }).unwrap();
      message.success(
        removed.length > 0
          ? t('assign.savedWithRemoval', {
              name: user.name,
              defaultValue: 'Project access updated for {{name}}. Removed access applies immediately.',
            })
          : t('assign.saved', { name: user.name, defaultValue: 'Project access updated for {{name}}.' })
      );
      onClose();
    } catch (error) {
      message.error(
        getPortalErrorMessage(
          error,
          t('assign.failed', { defaultValue: 'The project access could not be updated.' })
        )
      );
    }
  };

  const renderProjects = () => {
    if (projectsQuery.isLoading) return <PortalLoader />;
    if (projectsQuery.isError) {
      return (
        <Alert
          type="error"
          showIcon
          message={t('assign.loadFailed', { defaultValue: 'The projects could not be loaded.' })}
          action={
            <Button size="small" onClick={() => projectsQuery.refetch()}>
              {tShared('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      );
    }
    if (projects.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('assign.noProjects', {
            organization: user.organization_name,
            defaultValue: '{{organization}} has no projects yet.',
          })}
        />
      );
    }

    return projects.map(project => {
      const wasAssigned = initialIds.includes(project.id);
      const unavailable = !project.portal_enabled && !wasAssigned;
      return (
        <label
          key={project.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            marginBottom: 8,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 8,
            cursor: unavailable ? 'not-allowed' : 'pointer',
            opacity: unavailable ? 0.6 : 1,
          }}
        >
          <Checkbox
            checked={selected.includes(project.id)}
            disabled={unavailable}
            onChange={() => toggle(project.id)}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{project.name}</span>
            {!project.portal_enabled && (
              <span style={{ display: 'block', fontSize: 11.5, color: token.colorTextSecondary }}>
                {t('assign.portalOff', {
                  defaultValue: 'Client Portal is off for this project. Turn it on first.',
                })}
              </span>
            )}
          </span>
          <ClientProjectStatusTag status={project.status} />
        </label>
      );
    });
  };

  return (
    <Modal
      open
      title={t('assign.title', { name: user.name, defaultValue: 'Assign projects · {{name}}' })}
      okText={t('assign.save', { defaultValue: 'Save' })}
      cancelText={tShared('cancel', { defaultValue: 'Cancel' })}
      onOk={() => void save()}
      onCancel={onClose}
      okButtonProps={{ loading: isSaving, disabled: projectsQuery.isLoading || projectsQuery.isError }}
      maskClosable={!isSaving}
      width={540}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12.5 }}>
        {t('assign.description', {
          organization: user.organization_name,
          defaultValue:
            'A user only ever sees projects assigned here, even though they belong to {{organization}}. What they can do inside each project depends on their role:',
        })}{' '}
        <RoleTag role={user.role} />
      </Typography.Paragraph>
      {renderProjects()}
    </Modal>
  );
};
