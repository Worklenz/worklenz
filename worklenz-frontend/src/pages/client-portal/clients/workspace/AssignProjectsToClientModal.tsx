import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Modal, Select, Typography, message } from '@/shared/antd-imports';
import {
  useGetPortalProjectsQuery,
  useLinkProjectToClientMutation,
} from '@/api/client-portal/portal-projects-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface AssignProjectsToClientModalProps {
  organizationId: string;
  organizationName: string;
  onClose: () => void;
}

/** Workspace projects that have no client yet are the only ones that can be assigned (`none` filter). */
const NO_CLIENT = 'none';

/**
 * Assigns workspace projects to this client. Assigning only links the project; the Client Portal stays
 * off for it until it is switched on in the table, so nothing becomes visible to the client by accident.
 */
export const AssignProjectsToClientModal = ({
  organizationId,
  organizationName,
  onClose,
}: AssignProjectsToClientModalProps) => {
  const { t } = useTranslation('client-portal-v2-clients');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const candidates = useGetPortalProjectsQuery({ organization_id: NO_CLIENT, limit: 100 });
  const [linkProject] = useLinkProjectToClientMutation();
  const options = (candidates.data?.body?.items ?? []).map(project => ({
    value: project.id,
    label: decodeHtmlEntities(project.name),
  }));

  const assign = async () => {
    setSaving(true);
    const failed: string[] = [];
    const failedIds: string[] = [];
    for (const projectId of picked) {
      try {
        await linkProject({ projectId, organizationId }).unwrap();
      } catch (error) {
        const name = options.find(option => option.value === projectId)?.label ?? projectId;
        failed.push(`${name}: ${getPortalErrorMessage(error, '')}`.trim());
        failedIds.push(projectId);
      }
    }
    setSaving(false);

    const linked = picked.length - failed.length;
    if (linked > 0) {
      message.success(
        t('workspace.projects.assign.done', {
          count: linked,
          name: organizationName,
          defaultValue: '{{count}} project assigned to {{name}}. Switch the Client Portal on to share it.',
        })
      );
    }
    if (failed.length > 0) {
      message.error(
        t('workspace.projects.assign.failed', {
          details: failed.join('; '),
          defaultValue: 'Some projects could not be assigned: {{details}}',
        })
      );
      setPicked(failedIds);
      return;
    }
    onClose();
  };

  return (
    <Modal
      open
      onCancel={onClose}
      destroyOnHidden
      width={520}
      title={t('workspace.projects.assign.title', {
        name: organizationName,
        defaultValue: 'Assign projects to {{name}}',
      })}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={saving}>
          {t('workspace.projects.assign.cancel', { defaultValue: 'Cancel' })}
        </Button>,
        <Button key="assign" type="primary" onClick={assign} loading={saving} disabled={picked.length === 0}>
          {t('workspace.projects.assign.confirm', { defaultValue: 'Assign' })}
        </Button>,
      ]}
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12.5 }}>
        {t('workspace.projects.assign.description', {
          defaultValue:
            'Choose workspace projects that do not belong to a client yet. The Client Portal stays off for them until you switch it on.',
        })}
      </Typography.Paragraph>

      {candidates.isError ? (
        <Alert
          type="error"
          showIcon
          message={t('workspace.projects.assign.loadFailed', { defaultValue: 'The projects could not be loaded.' })}
          action={
            <Button size="small" onClick={() => candidates.refetch()}>
              {t('workspace.projects.assign.retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      ) : (
        <Select<string[]>
          mode="multiple"
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          loading={candidates.isLoading}
          value={picked}
          onChange={setPicked}
          options={options}
          disabled={saving}
          placeholder={t('workspace.projects.assign.placeholder', { defaultValue: 'Search projects…' })}
          aria-label={t('workspace.projects.assign.placeholder', { defaultValue: 'Search projects…' })}
          notFoundContent={
            candidates.isLoading
              ? null
              : t('workspace.projects.assign.none', {
                  defaultValue: 'Every workspace project already belongs to a client.',
                })
          }
        />
      )}
    </Modal>
  );
};
