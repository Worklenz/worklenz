import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Checkbox, Flex, Input, Skeleton, Typography, message } from '@/shared/antd-imports';
import {
  useDeactivatePortalOrganizationMutation,
  useDeletePortalOrganizationMutation,
  useGetOrganizationDeletePreviewQuery,
  useReactivatePortalOrganizationMutation,
  useRestorePortalOrganizationMutation,
} from '@/api/client-portal/portal-access-api';
import { getPortalErrorCode, getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { ConfirmEffectModal } from './ConfirmEffectModal';
import { formatPortalDate } from './format';

/** The least this needs to know about a client: every "…" menu that offers these actions can supply it. */
export interface ClientOrganizationTarget {
  id: string;
  name: string;
}

export interface ClientOrganizationActions {
  onDeactivate: (organization: ClientOrganizationTarget) => void;
  onReactivate: (organization: ClientOrganizationTarget) => void;
  onDelete: (organization: ClientOrganizationTarget) => void;
  onRestore: (organization: ClientOrganizationTarget) => void;
}

export interface ClientOrganizationActionOptions {
  /** After a client was deleted (a workspace or the details modal closes itself here). */
  onDeleted?: (organization: ClientOrganizationTarget) => void;
  onRestored?: (organization: ClientOrganizationTarget) => void;
  onDeactivated?: (organization: ClientOrganizationTarget) => void;
  onReactivated?: (organization: ClientOrganizationTarget) => void;
}

type ActionKind = 'deactivate' | 'reactivate' | 'delete' | 'restore';

interface PendingAction {
  kind: ActionKind;
  organization: ClientOrganizationTarget;
}

/** The server answers these when what the preview showed changed before the person confirmed. */
const STALE_PREVIEW_CODES = ['OPEN_INVOICES', 'PENDING_APPROVALS', 'OPEN_CHANGE_REQUESTS'];

/**
 * Deactivate, reactivate, delete and restore for a client organization, plus the dialogs they open.
 * Every "…" menu that offers them (the Clients list row, the client workspace, the client details modal)
 * uses this one hook, so the confirmation, the blockers and the error handling are identical everywhere.
 *
 * Delete asks the server first what it would affect: an unpaid invoice blocks it outright, and approvals or
 * change requests still waiting need an explicit acknowledgement before the button comes on.
 */
export const useClientOrganizationActions = (options: ClientOrganizationActionOptions = {}) => {
  const { t, i18n } = useTranslation('client-portal-v2-clients');

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [acknowledgedApprovals, setAcknowledgedApprovals] = useState(false);
  const [acknowledgedChangeRequests, setAcknowledgedChangeRequests] = useState(false);
  // Set when another live client already has the name, so the person can choose a new one to restore under.
  const [nameConflict, setNameConflict] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const [deactivate, { isLoading: isDeactivating }] = useDeactivatePortalOrganizationMutation();
  const [reactivate, { isLoading: isReactivating }] = useReactivatePortalOrganizationMutation();
  const [deleteOrganization, { isLoading: isDeleting }] = useDeletePortalOrganizationMutation();
  const [restore, { isLoading: isRestoring }] = useRestorePortalOrganizationMutation();

  const isDeleteOpen = pending?.kind === 'delete';
  const preview = useGetOrganizationDeletePreviewQuery(pending?.organization.id ?? '', { skip: !isDeleteOpen });
  const previewData = preview.data?.body;

  // A fresh dialog starts with nothing acknowledged and no name typed.
  useEffect(() => {
    setAcknowledgedApprovals(false);
    setAcknowledgedChangeRequests(false);
    setNameConflict(null);
    setNewName('');
  }, [pending?.kind, pending?.organization.id]);

  const close = () => setPending(null);

  const run = async (kind: 'deactivate' | 'reactivate', organization: ClientOrganizationTarget) => {
    try {
      if (kind === 'deactivate') {
        await deactivate(organization.id).unwrap();
        message.success(
          t('orgActions.deactivate.success', {
            name: organization.name,
            defaultValue: '{{name}} was deactivated. Its users can no longer sign in.',
          })
        );
        options.onDeactivated?.(organization);
      } else {
        await reactivate(organization.id).unwrap();
        message.success(
          t('orgActions.reactivate.success', {
            name: organization.name,
            defaultValue: '{{name}} was reactivated.',
          })
        );
        options.onReactivated?.(organization);
      }
      close();
    } catch (error) {
      close();
      message.error(
        getPortalErrorMessage(
          error,
          kind === 'deactivate'
            ? t('orgActions.deactivate.failed', { defaultValue: 'The client could not be deactivated.' })
            : t('orgActions.reactivate.failed', { defaultValue: 'The client could not be reactivated.' })
        )
      );
    }
  };

  const confirmDelete = async (organization: ClientOrganizationTarget) => {
    try {
      const result = await deleteOrganization({
        organizationId: organization.id,
        confirmPendingApprovals: acknowledgedApprovals,
        confirmOpenChangeRequests: acknowledgedChangeRequests,
      }).unwrap();
      message.success(
        t('orgActions.delete.success', {
          name: organization.name,
          date: formatPortalDate(result.body?.purge_on, i18n.language) ?? '',
          defaultValue: '{{name}} was deleted. You can restore it until {{date}}.',
        })
      );
      close();
      options.onDeleted?.(organization);
    } catch (error) {
      const code = getPortalErrorCode(error);
      if (code && STALE_PREVIEW_CODES.includes(code)) {
        // Something changed since the dialog opened (an invoice was sent, an approval requested): show it again.
        void preview.refetch();
        message.error(getPortalErrorMessage(error, t('orgActions.delete.failed', { defaultValue: 'The client could not be deleted.' })));
        return;
      }
      if (code === 'ALREADY_DELETED') close();
      message.error(
        getPortalErrorMessage(error, t('orgActions.delete.failed', { defaultValue: 'The client could not be deleted.' }))
      );
    }
  };

  const confirmRestore = async (organization: ClientOrganizationTarget) => {
    const typedName = newName.trim();
    if (nameConflict !== null && !typedName) return;
    try {
      await restore({ organizationId: organization.id, newName: nameConflict !== null ? typedName : undefined }).unwrap();
      message.success(
        t('orgActions.restore.success', {
          name: nameConflict !== null ? typedName : organization.name,
          defaultValue: '{{name}} was restored.',
        })
      );
      close();
      options.onRestored?.(organization);
    } catch (error) {
      if (getPortalErrorCode(error) === 'NAME_TAKEN') {
        // Ask for another name instead of failing: the client is still restorable.
        setNameConflict(nameConflict !== null ? typedName : organization.name);
        return;
      }
      close();
      message.error(
        getPortalErrorMessage(error, t('orgActions.restore.failed', { defaultValue: 'The client could not be restored.' }))
      );
    }
  };

  const actions: ClientOrganizationActions = {
    onDeactivate: organization => setPending({ kind: 'deactivate', organization }),
    onReactivate: organization => setPending({ kind: 'reactivate', organization }),
    onDelete: organization => setPending({ kind: 'delete', organization }),
    onRestore: organization => setPending({ kind: 'restore', organization }),
  };

  const organization = pending?.organization;
  const name = organization?.name ?? '';

  const hasUnpaidInvoices = (previewData?.open_invoices.length ?? 0) > 0;
  const needsApprovalAck = (previewData?.pending_approvals.length ?? 0) > 0 && !acknowledgedApprovals;
  const needsChangeRequestAck = (previewData?.open_change_requests.length ?? 0) > 0 && !acknowledgedChangeRequests;
  const deleteConfirmDisabled =
    !previewData || hasUnpaidInvoices || needsApprovalAck || needsChangeRequestAck || preview.isFetching;
  const affectedUsers = (previewData?.active_users ?? 0) + (previewData?.invited_users ?? 0);

  const deleteBody = (() => {
    if (preview.isError) {
      return (
        <Alert
          type="error"
          showIcon
          message={t('orgActions.delete.checkFailed', { defaultValue: 'We could not check what deleting this client affects.' })}
          action={
            <Button size="small" onClick={() => void preview.refetch()}>
              {t('retry', { defaultValue: 'Try again' })}
            </Button>
          }
        />
      );
    }
    if (!previewData) {
      return (
        <div aria-busy="true" aria-label={t('orgActions.delete.checking', { defaultValue: 'Checking what deleting this client affects…' })}>
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        </div>
      );
    }
    return (
      <Flex vertical gap={12}>
        {hasUnpaidInvoices && (
          <Alert
            type="error"
            showIcon
            message={t('orgActions.delete.blockedTitle', { defaultValue: 'Unpaid invoices' })}
            description={t('orgActions.delete.blocked', {
              numbers: previewData.open_invoices.map(invoice => invoice.invoice_no).join(', '),
              defaultValue: '{{numbers}}. Settle or cancel these invoices before deleting this client.',
            })}
          />
        )}
        {affectedUsers > 0 && (
          <Typography.Text strong>
            {t('orgActions.delete.usersAffected', {
              count: affectedUsers,
              defaultValue: 'Users who lose access right away: {{count}}',
            })}
          </Typography.Text>
        )}
        <Typography.Text>
          {t('orgActions.delete.effect', {
            days: previewData.retention_days,
            defaultValue:
              'Their next request fails and they are signed out. Nothing is removed yet: the client, its users, projects, approvals, discussions and invoices are kept for {{days}} days.',
          })}
        </Typography.Text>
        <Typography.Text type="secondary">
          {t('orgActions.delete.restorable', {
            defaultValue:
              'Until then you can restore the client from the Deleted view with all its history. After that it is removed permanently; invoices are kept as records.',
          })}
        </Typography.Text>
        {(previewData.pending_approvals.length > 0 || previewData.open_change_requests.length > 0) && !hasUnpaidInvoices && (
          <Alert
            type="warning"
            showIcon
            message={t('orgActions.delete.warningsTitle', { defaultValue: 'Confirm before deleting' })}
            description={
              <Flex vertical gap={8}>
                {previewData.pending_approvals.length > 0 && (
                  <div>
                    <div>
                      {t('orgActions.delete.approvals', {
                        refs: previewData.pending_approvals.map(approval => approval.ref_no).join(', '),
                        defaultValue: 'Approvals still waiting for a decision: {{refs}}.',
                      })}
                    </div>
                    <Checkbox checked={acknowledgedApprovals} onChange={event => setAcknowledgedApprovals(event.target.checked)}>
                      {t('orgActions.delete.approvalsAck', {
                        defaultValue: 'I understand these approvals can no longer be decided.',
                      })}
                    </Checkbox>
                  </div>
                )}
                {previewData.open_change_requests.length > 0 && (
                  <div>
                    <div>
                      {t('orgActions.delete.changeRequests', {
                        titles: previewData.open_change_requests.map(request => request.title).join(', '),
                        defaultValue: 'Open change requests: {{titles}}.',
                      })}
                    </div>
                    <Checkbox
                      checked={acknowledgedChangeRequests}
                      onChange={event => setAcknowledgedChangeRequests(event.target.checked)}
                    >
                      {t('orgActions.delete.changeRequestsAck', {
                        defaultValue: 'I understand these change requests can no longer be worked on.',
                      })}
                    </Checkbox>
                  </div>
                )}
              </Flex>
            }
          />
        )}
      </Flex>
    );
  })();

  const modals = (
    <>
      <ConfirmEffectModal
        open={pending?.kind === 'deactivate'}
        danger
        title={t('orgActions.deactivate.title', { name, defaultValue: 'Deactivate {{name}}?' })}
        confirmLabel={t('orgActions.deactivate.confirm', { defaultValue: 'Deactivate client' })}
        loading={isDeactivating}
        onClose={close}
        onConfirm={() => organization && void run('deactivate', organization)}
      >
        {t('orgActions.deactivate.body', {
          name,
          defaultValue:
            'Everyone at {{name}} loses portal access right away, and anyone signed in is signed out on their next request. All data is kept, and you can reactivate the client at any time.',
        })}
      </ConfirmEffectModal>

      <ConfirmEffectModal
        open={pending?.kind === 'reactivate'}
        title={t('orgActions.reactivate.title', { name, defaultValue: 'Reactivate {{name}}?' })}
        confirmLabel={t('orgActions.reactivate.confirm', { defaultValue: 'Reactivate client' })}
        loading={isReactivating}
        onClose={close}
        onConfirm={() => organization && void run('reactivate', organization)}
      >
        {t('orgActions.reactivate.body', {
          defaultValue: 'Its users can sign in again, with the same access they had before.',
        })}
      </ConfirmEffectModal>

      <ConfirmEffectModal
        open={isDeleteOpen}
        danger
        title={t('orgActions.delete.title', { name, defaultValue: 'Delete {{name}}?' })}
        confirmLabel={t('orgActions.delete.confirm', { defaultValue: 'Delete client' })}
        loading={isDeleting}
        confirmDisabled={deleteConfirmDisabled}
        onClose={close}
        onConfirm={() => organization && void confirmDelete(organization)}
      >
        {deleteBody}
      </ConfirmEffectModal>

      <ConfirmEffectModal
        open={pending?.kind === 'restore'}
        title={t('orgActions.restore.title', { name, defaultValue: 'Restore {{name}}?' })}
        confirmLabel={t('orgActions.restore.confirm', { defaultValue: 'Restore client' })}
        loading={isRestoring}
        confirmDisabled={nameConflict !== null && newName.trim() === ''}
        onClose={close}
        onConfirm={() => organization && void confirmRestore(organization)}
      >
        <Flex vertical gap={12}>
          <Typography.Text>
            {t('orgActions.restore.body', {
              defaultValue:
                'Its users can sign in again, and its projects, approvals, discussions, invoices and history come back exactly as they were.',
            })}
          </Typography.Text>
          {nameConflict !== null && (
            <>
              <Alert
                type="warning"
                showIcon
                message={t('orgActions.restore.nameTaken', {
                  name: nameConflict,
                  defaultValue: 'Another client is already named “{{name}}”. Give this client a new name to restore it.',
                })}
              />
              <Input
                autoFocus
                maxLength={255}
                value={newName}
                onChange={event => setNewName(event.target.value)}
                onPressEnter={() => organization && void confirmRestore(organization)}
                aria-label={t('orgActions.restore.newName', { defaultValue: 'New client name' })}
                placeholder={t('orgActions.restore.newName', { defaultValue: 'New client name' })}
                status={newName !== '' && newName.trim() === '' ? 'error' : undefined}
              />
            </>
          )}
        </Flex>
      </ConfirmEffectModal>
    </>
  );

  return { actions, modals };
};
