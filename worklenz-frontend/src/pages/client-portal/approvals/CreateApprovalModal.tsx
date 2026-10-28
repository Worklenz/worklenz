import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, DatePicker, Form, Input, Modal, Select, dayjs, message } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { buildApproverOptions } from './approverOptions';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useGetPortalProjectsQuery } from '@/api/client-portal/portal-projects-api';
import { useCreateApprovalMutation, useGetApprovalOptionsQuery } from '@/api/client-portal/portal-workflow-api';
import type { CreateApprovalRequest } from '@/types/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { portalPaths } from '../portal-paths';
import { useModalRouteClose } from '../useModalRouteClose';
import { RichTextField } from '../shared/rich-text/RichTextField';

type LinkMode = 'existing' | 'freeform';

/**
 * Request approval. A project that has the portal on, an item the client can see (an exact file
 * version is recorded) or a free-form item, and an Active Client Admin on the project to decide.
 * "Save draft" keeps it invisible to the client; "Send for approval" notifies the approver.
 */
export const CreateApprovalModal = () => {
  const { t } = useTranslation('client-portal-v2-approvals');
  const { t: tShared } = useTranslation('client-portal-v2');
  const [searchParams] = useSearchParams();
  const presetOrganizationId = searchParams.get('organization_id') ?? undefined;
  const close = useModalRouteClose(portalPaths.approvals);

  const [projectId, setProjectId] = useState<string | undefined>(searchParams.get('project_id') ?? undefined);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<LinkMode>('existing');
  const [itemKey, setItemKey] = useState<string | undefined>();
  const [freeformName, setFreeformName] = useState('');
  const [freeformDescription, setFreeformDescription] = useState('');
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');

  const projectsQuery = useGetPortalProjectsQuery({
    portal: 'on',
    has_client: true,
    organization_id: presetOrganizationId,
    limit: 100,
  });
  const optionsQuery = useGetApprovalOptionsQuery(projectId ?? '', { skip: !projectId });
  const [createApproval, { isLoading }] = useCreateApprovalMutation();

  const projects = projectsQuery.data?.body?.items ?? [];
  const linkable = optionsQuery.data?.body?.linkable;
  const approvers = optionsQuery.data?.body?.approvers ?? [];
  const hiddenCount = linkable
    ? linkable.internal_counts.files + linkable.internal_counts.milestones + linkable.internal_counts.tasks
    : 0;

  const itemOptions = useMemo(
    () => [
      {
        label: t('create.groupFiles', { defaultValue: 'Files' }),
        options: (linkable?.files ?? []).map(file => ({
          value: `file:${file.id}`,
          label: t('create.fileOption', {
            name: file.name,
            version: file.current_version,
            defaultValue: '{{name}} · v{{version}}',
          }),
        })),
      },
      {
        label: t('create.groupMilestones', { defaultValue: 'Milestones' }),
        options: (linkable?.milestones ?? []).map(milestone => ({
          value: `milestone:${milestone.id}`,
          label: decodeHtmlEntities(milestone.name),
        })),
      },
      {
        label: t('create.groupTasks', { defaultValue: 'Tasks' }),
        options: (linkable?.tasks ?? []).map(task => ({
          value: `task:${task.id}`,
          label: t('create.taskOption', {
            key: task.key,
            title: decodeHtmlEntities(task.client_title),
            defaultValue: '{{key}} · {{title}}',
          }),
        })),
      },
    ],
    [linkable, t]
  );

  const hasLinkedItem = mode === 'freeform' ? freeformName.trim() !== '' : Boolean(itemKey);
  const isValid = title.trim() !== '' && Boolean(projectId) && hasLinkedItem && approverIds.length > 0;

  const submit = async (send: boolean) => {
    if (!projectId || !isValid) return;

    let linkedItem: CreateApprovalRequest['linked_item'];
    if (mode === 'freeform') {
      linkedItem = {
        type: 'freeform',
        name: freeformName.trim(),
        ...(freeformDescription.trim() ? { description: freeformDescription.trim() } : {}),
      };
    } else {
      const [type, id] = (itemKey ?? '').split(':') as ['file' | 'milestone' | 'task', string];
      linkedItem = { type, id };
    }

    try {
      const result = await createApproval({
        project_id: projectId,
        title: title.trim(),
        linked_item: linkedItem,
        approver_ids: approverIds,
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        due_date: dueDate || null,
        send,
      }).unwrap();

      const approval = result.body;
      const approverName = approvers
        .filter(approver => approverIds.includes(approver.id))
        .map(approver => approver.name)
        .join(', ');
      message.success(
        send
          ? t('create.sent', {
              ref: approval?.ref_no ?? '',
              approver: approverName,
              defaultValue: '{{ref}} sent. {{approver}} is notified.',
            })
          : t('create.drafted', {
              ref: approval?.ref_no ?? '',
              defaultValue: '{{ref}} saved as a draft. The client cannot see it yet.',
            })
      );
      close();
    } catch (error) {
      message.error(
        getPortalErrorMessage(error, t('create.failed', { defaultValue: 'The approval request could not be saved.' }))
      );
    }
  };

  return (
    <Modal
      open
      title={t('create.title', { defaultValue: 'Request Approval' })}
      width={580}
      onCancel={isLoading ? undefined : close}
      maskClosable={false}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={close} disabled={isLoading}>
          {tShared('cancel', { defaultValue: 'Cancel' })}
        </Button>,
        <Button key="draft" disabled={!isValid || isLoading} onClick={() => void submit(false)}>
          {t('create.saveDraft', { defaultValue: 'Save draft' })}
        </Button>,
        <Button key="send" type="primary" disabled={!isValid} loading={isLoading} onClick={() => void submit(true)}>
          {t('create.send', { defaultValue: 'Send for approval' })}
        </Button>,
      ]}
    >
      <Form layout="vertical" requiredMark>
        <Form.Item label={t('create.project', { defaultValue: 'Project' })} required>
          <Select<string>
            showSearch
            optionFilterProp="label"
            loading={projectsQuery.isLoading}
            value={projectId}
            aria-label={t('create.project', { defaultValue: 'Project' })}
            onChange={value => {
              setProjectId(value);
              setItemKey(undefined);
              setApproverIds([]);
            }}
            placeholder={t('create.projectPlaceholder', { defaultValue: 'Choose a project…' })}
            notFoundContent={t('create.noPortalProjects', {
              defaultValue: 'No projects have the Client Portal turned on. Turn it on in Portal Projects first.',
            })}
            options={projects.map(project => ({
              value: project.id,
              label: t('create.projectOption', {
                name: decodeHtmlEntities(project.name),
                client: decodeHtmlEntities(project.organization_name ?? ''),
                defaultValue: '{{name}} · {{client}}',
              }),
            }))}
          />
        </Form.Item>

        <Form.Item label={t('create.what', { defaultValue: 'What is being approved' })} required>
          <Input
            value={title}
            maxLength={200}
            aria-label={t('create.what', { defaultValue: 'What is being approved' })}
            onChange={event => setTitle(event.target.value)}
            placeholder={t('create.whatPlaceholder', { defaultValue: 'e.g. Approve homepage wireframe v3' })}
          />
        </Form.Item>

        <Form.Item
          label={t('create.linkedItem', { defaultValue: 'Linked item' })}
          required
          extra={
            mode === 'freeform'
              ? t('create.freeformHint', {
                  defaultValue:
                    'A free-form item has no record behind it. The name and description you write here are exactly what the client sees and approves.',
                })
              : hiddenCount > 0
                ? t('create.hiddenHint', {
                    count: hiddenCount,
                    defaultValue:
                      '{{count}} item(s) in this project are Internal Only and cannot be linked. Share them with the client first.',
                  })
                : t('create.existingHint', {
                    defaultValue: 'Only Client Visible files, milestones and tasks can be linked. The exact file version is recorded.',
                  })
          }
        >
          <PillToggle<LinkMode>
            value={mode}
            onChange={setMode}
            ariaLabel={t('create.linkMode', { defaultValue: 'Kind of linked item' })}
            style={{ marginBottom: 8 }}
            options={[
              { value: 'existing', label: t('create.existingItem', { defaultValue: 'Existing item' }) },
              { value: 'freeform', label: t('create.freeformItem', { defaultValue: 'Free-form item' }) },
            ]}
          />
          {mode === 'existing' ? (
            <Select<string>
              showSearch
              optionFilterProp="label"
              disabled={!projectId}
              loading={optionsQuery.isLoading}
              value={itemKey}
              aria-label={t('create.linkedItem', { defaultValue: 'Linked item' })}
              onChange={setItemKey}
              placeholder={t('create.itemPlaceholder', { defaultValue: 'Select a file, milestone or task…' })}
              notFoundContent={t('create.noLinkable', {
                defaultValue: 'Nothing in this project is shared with the client yet.',
              })}
              options={itemOptions.filter(group => group.options.length > 0)}
            />
          ) : (
            <>
              <Input
                style={{ marginBottom: 8 }}
                value={freeformName}
                maxLength={200}
                onChange={event => setFreeformName(event.target.value)}
                placeholder={t('create.freeformName', { defaultValue: 'Item name, e.g. Launch rollout approach' })}
                aria-label={t('create.freeformName', { defaultValue: 'Item name, e.g. Launch rollout approach' })}
              />
              <RichTextField
                value={freeformDescription}
                onChange={html => setFreeformDescription(html)}
                placeholder={t('create.freeformDescription', { defaultValue: 'Describe what the client is approving (optional)' })}
                ariaLabel={t('create.freeformDescription', { defaultValue: 'Describe what the client is approving (optional)' })}
                maxLength={2000}
              />
            </>
          )}
        </Form.Item>

        <Form.Item
          label={t('create.approver', { defaultValue: 'Approvers' })}
          required
          extra={
            projectId && !optionsQuery.isLoading && approvers.length === 0
              ? t('create.noApprovers', {
                  defaultValue: 'This client has no active users yet. Invite one under Clients \u2192 Users.',
                })
              : t('create.approverHint', {
                  defaultValue:
                    'Choose one or more of the client\u2019s users. Whoever you choose can decide this request and gets access to the project. The first decision settles it.',
                })
          }
        >
          <Select<string[], { value: string; label: string }>
            mode="multiple"
            showSearch
            optionFilterProp="label"
            disabled={!projectId || approvers.length === 0}
            loading={optionsQuery.isLoading}
            value={approverIds}
            aria-label={t('create.approver', { defaultValue: 'Approvers' })}
            onChange={setApproverIds}
            placeholder={t('create.approverPlaceholder', { defaultValue: 'Select approvers\u2026' })}
            options={buildApproverOptions(t, approvers)}
          />
        </Form.Item>

        {optionsQuery.isError && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('create.optionsFailed', { defaultValue: 'The items and approvers for this project could not be loaded.' })}
            action={
              <Button size="small" onClick={() => optionsQuery.refetch()}>
                {t('retry', { defaultValue: 'Retry' })}
              </Button>
            }
          />
        )}

        <Form.Item label={t('create.instructions', { defaultValue: 'Instructions (what the client should check)' })}>
          <RichTextField
            value={instructions}
            onChange={html => setInstructions(html)}
            ariaLabel={t('create.instructions', { defaultValue: 'Instructions (what the client should check)' })}
            maxLength={2000}
          />
        </Form.Item>
        <Form.Item label={t('create.dueDate', { defaultValue: 'Due date (optional)' })}>
          <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: 220 }}>
            <DatePicker
              style={{ width: '100%' }}
              value={dueDate ? dayjs(dueDate) : null}
              onChange={date => setDueDate(date ? date.format('YYYY-MM-DD') : '')}
              placeholder={t('create.dueDatePlaceholder', { defaultValue: 'Select due date' })}
              placement="topLeft"
              getPopupContainer={trigger => trigger.parentElement || document.body}
              aria-label={t('create.dueDate', { defaultValue: 'Due date (optional)' })}
            />
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
