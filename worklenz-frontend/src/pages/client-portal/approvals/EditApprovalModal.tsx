import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Input, Modal, Select, message } from '@/shared/antd-imports';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useGetApprovalOptionsQuery, useUpdateApprovalMutation } from '@/api/client-portal/portal-workflow-api';
import type { Approval, UpdateApprovalRequest } from '@/types/client-portal/v2';
import { buildApproverOptions } from './approverOptions';
import { RichTextField } from '../shared/rich-text/RichTextField';

interface EditApprovalModalProps {
  approval: Approval;
  onClose: () => void;
}

/**
 * Edit a request the client has not reacted to yet. The project and the linked item are fixed, because
 * the client is approving that exact item; everything else can change.
 */
export const EditApprovalModal = ({ approval, onClose }: EditApprovalModalProps) => {
  const { t } = useTranslation('client-portal-v2-approvals');
  const { t: tShared } = useTranslation('client-portal-v2');
  const isFreeform = approval.linked_item.type === 'freeform';

  const [title, setTitle] = useState(approval.title);
  const [approverIds, setApproverIds] = useState<string[]>(
    approval.approvers?.length ? approval.approvers.map(approver => approver.id) : approval.approver_id ? [approval.approver_id] : []
  );
  const [instructions, setInstructions] = useState(approval.instructions ?? '');
  const [dueDate, setDueDate] = useState(approval.due_date ?? '');
  const [freeformName, setFreeformName] = useState(approval.linked_item.name);
  const [freeformDescription, setFreeformDescription] = useState(approval.linked_item.description ?? '');

  const optionsQuery = useGetApprovalOptionsQuery(approval.project_id);
  const [updateApproval, { isLoading }] = useUpdateApprovalMutation();
  const approvers = optionsQuery.data?.body?.approvers ?? [];

  const isValid = title.trim() !== '' && approverIds.length > 0 && (!isFreeform || freeformName.trim() !== '');

  const save = async () => {
    if (!isValid) return;
    const body: UpdateApprovalRequest = {
      title: title.trim(),
      approver_ids: approverIds,
      instructions: instructions.trim(),
      due_date: dueDate || null,
      ...(isFreeform ? { freeform: { name: freeformName.trim(), description: freeformDescription.trim() } } : {}),
    };
    try {
      await updateApproval({ approvalId: approval.id, body }).unwrap();
      message.success(t('edit.saved', { ref: approval.ref_no, defaultValue: '{{ref}} updated.' }));
      onClose();
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('edit.failed', { defaultValue: 'The request could not be updated.' })));
    }
  };

  return (
    <Modal
      open
      title={t('edit.title', { ref: approval.ref_no, defaultValue: 'Edit {{ref}}' })}
      width={540}
      onCancel={isLoading ? undefined : onClose}
      maskClosable={false}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose} disabled={isLoading}>
          {tShared('cancel', { defaultValue: 'Cancel' })}
        </Button>,
        <Button key="save" type="primary" disabled={!isValid} loading={isLoading} onClick={() => void save()}>
          {t('edit.save', { defaultValue: 'Save changes' })}
        </Button>,
      ]}
    >
      <Form layout="vertical" requiredMark>
        <Form.Item label={t('create.what', { defaultValue: 'What is being approved' })} required>
          <Input
            value={title}
            maxLength={200}
            aria-label={t('create.what', { defaultValue: 'What is being approved' })}
            onChange={event => setTitle(event.target.value)}
          />
        </Form.Item>

        <Form.Item
          label={t('create.linkedItem', { defaultValue: 'Linked item' })}
          extra={
            isFreeform
              ? undefined
              : t('edit.linkedLocked', { defaultValue: 'The linked item cannot be changed. Cancel this request and create a new one to approve something else.' })
          }
        >
          {isFreeform ? (
            <>
              <Input
                style={{ marginBottom: 8 }}
                value={freeformName}
                maxLength={200}
                onChange={event => setFreeformName(event.target.value)}
                aria-label={t('create.freeformName', { defaultValue: 'Item name, e.g. Launch rollout approach' })}
              />
              <RichTextField
                value={freeformDescription}
                onChange={html => setFreeformDescription(html)}
                ariaLabel={t('create.freeformDescription', { defaultValue: 'Describe what the client is approving (optional)' })}
                maxLength={2000}
              />
            </>
          ) : (
            <Input disabled value={approval.linked_item.name} aria-label={t('create.linkedItem', { defaultValue: 'Linked item' })} />
          )}
        </Form.Item>

        <Form.Item
          label={t('create.approver', { defaultValue: 'Approvers' })}
          required
          extra={t('edit.approverHint', {
            defaultValue: 'Anyone you add is notified and gets access to the project. The first decision settles the request.',
          })}
        >
          <Select<string[], { value: string; label: string }>
            mode="multiple"
            showSearch
            optionFilterProp="label"
            loading={optionsQuery.isLoading}
            value={approverIds}
            aria-label={t('create.approver', { defaultValue: 'Approvers' })}
            onChange={setApproverIds}
            options={buildApproverOptions(t, approvers)}
          />
        </Form.Item>

        <Form.Item label={t('create.instructions', { defaultValue: 'Instructions (what the client should check)' })}>
          <RichTextField
            value={instructions}
            onChange={html => setInstructions(html)}
            ariaLabel={t('create.instructions', { defaultValue: 'Instructions (what the client should check)' })}
            maxLength={2000}
          />
        </Form.Item>
        <Form.Item label={t('create.dueDate', { defaultValue: 'Due date (optional)' })}>
          <Input
            aria-label={t('create.dueDate', { defaultValue: 'Due date (optional)' })}
            type="date"
            value={dueDate}
            onChange={event => setDueDate(event.target.value)}
            style={{ maxWidth: 220 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
