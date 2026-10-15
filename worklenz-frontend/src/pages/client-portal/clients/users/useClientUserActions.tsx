import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';
import {
  useDeactivatePortalUserMutation,
  useReactivatePortalUserMutation,
  useRemovePortalUserMutation,
  useResendPortalInvitationMutation,
} from '@/api/client-portal/portal-access-api';
import { getPortalErrorCode, getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { ConfirmEffectModal, InvitationLinkModal } from '@/components/client-portal/v2';
import type { ClientUser } from '@/types/client-portal/v2';
import { MessageClientModal } from '../../discussions/MessageClientModal';
import { AssignClientProjectsModal } from './AssignClientProjectsModal';
import { ClientUserProfileModal } from './ClientUserProfileModal';
import { EditClientUserModal } from './EditClientUserModal';

export interface ClientUserActions {
  onView: (user: ClientUser) => void;
  onEdit: (user: ClientUser) => void;
  onAssign: (user: ClientUser) => void;
  onMessage: (user: ClientUser) => void;
  onResend: (user: ClientUser) => void;
  onCreateLink: (user: ClientUser) => void;
  onDeactivate: (user: ClientUser) => void;
  onReactivate: (user: ClientUser) => void;
  onRemove: (user: ClientUser) => void;
}

type ConfirmKind = 'deactivate' | 'remove';

interface PendingConfirm {
  kind: ConfirmKind;
  user: ClientUser;
  /** Set when the server says this is the last active Client Admin; the next confirm sends the override. */
  lastAdminWarning: string | null;
}

/**
 * Every row action on a client user, plus the dialogs they open. Used by both the Client Users tab
 * and a workspace's Users & Access tab, so the two always behave the same.
 */
export const useClientUserActions = () => {
  const { t } = useTranslation('client-portal-v2-clients');

  const [viewUser, setViewUser] = useState<ClientUser | null>(null);
  const [editUser, setEditUser] = useState<ClientUser | null>(null);
  const [assignUser, setAssignUser] = useState<ClientUser | null>(null);
  const [messageUser, setMessageUser] = useState<ClientUser | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [shareLink, setShareLink] = useState<{
    link: string;
    email: string;
    reason: 'created' | 'emailFailed';
  } | null>(null);

  const [resendInvitation] = useResendPortalInvitationMutation();
  const [deactivateUser, { isLoading: isDeactivating }] = useDeactivatePortalUserMutation();
  const [reactivateUser] = useReactivatePortalUserMutation();
  const [removeUser, { isLoading: isRemoving }] = useRemovePortalUserMutation();

  const handleResend = async (user: ClientUser) => {
    try {
      const result = await resendInvitation({ userId: user.id }).unwrap();
      const invite = result.body;
      if (invite && !invite.emailSent && invite.link) {
        setShareLink({ link: invite.link, email: user.email, reason: 'emailFailed' });
        return;
      }
      message.success(
        t('actions.resent', {
          email: user.email,
          defaultValue: 'Invitation resent to {{email}}. The link is valid for 7 days.',
        })
      );
    } catch (error) {
      message.error(
        getPortalErrorMessage(
          error,
          t('actions.resendFailed', { defaultValue: 'The invitation could not be resent.' })
        )
      );
    }
  };

  /** Creates a sign-in (magic) link for the user without emailing it; staff copy and share it themselves. */
  const handleCreateLink = async (user: ClientUser) => {
    try {
      const result = await resendInvitation({ userId: user.id, delivery: 'link' }).unwrap();
      const link = result.body?.link;
      if (!link) throw new Error('No link was returned');
      setShareLink({ link, email: user.email, reason: 'created' });
    } catch (error) {
      message.error(
        getPortalErrorMessage(
          error,
          t('actions.createLinkFailed', { defaultValue: 'The sign-in link could not be created.' })
        )
      );
    }
  };

  const handleReactivate = async (user: ClientUser) => {
    try {
      await reactivateUser(user.id).unwrap();
      message.success(
        t('actions.reactivated', {
          name: user.name,
          defaultValue: '{{name}} can sign in again. Their previous status was restored.',
        })
      );
    } catch (error) {
      message.error(
        getPortalErrorMessage(
          error,
          t('actions.reactivateFailed', { defaultValue: 'The user could not be reactivated.' })
        )
      );
    }
  };

  const runConfirmed = async (pending: PendingConfirm, confirmLastAdmin: boolean) => {
    const { kind, user } = pending;
    try {
      if (kind === 'deactivate') {
        await deactivateUser({ userId: user.id, confirmLastAdmin }).unwrap();
        message.success(
          t('actions.deactivated', {
            name: user.name,
            defaultValue: '{{name}} was deactivated. Portal and API access is revoked immediately.',
          })
        );
      } else {
        await removeUser({ userId: user.id, confirmLastAdmin }).unwrap();
        message.success(
          t('actions.removed', { name: user.name, defaultValue: '{{name}} was removed from the portal.' })
        );
      }
      setConfirm(null);
    } catch (error) {
      const errorCode = getPortalErrorCode(error);
      if (errorCode === 'LAST_CLIENT_ADMIN' || errorCode === 'PENDING_APPROVALS') {
        setConfirm({ ...pending, lastAdminWarning: getPortalErrorMessage(error, '') });
        return;
      }
      setConfirm(null);
      message.error(
        getPortalErrorMessage(
          error,
          kind === 'deactivate'
            ? t('actions.deactivateFailed', { defaultValue: 'The user could not be deactivated.' })
            : t('actions.removeFailed', { defaultValue: 'The user could not be removed.' })
        )
      );
    }
  };

  /** Opens the new-discussion dialog for this person; someone with no projects has nothing to talk about yet. */
  const handleMessage = (user: ClientUser) => {
    if (user.projects.length === 0) {
      message.info(
        t('actions.messageNoProjects', {
          name: user.name,
          defaultValue: '{{name}} has no projects yet. Assign a project first, then start a discussion.',
        })
      );
      return;
    }
    setMessageUser(user);
  };

  const actions: ClientUserActions = {
    onView: setViewUser,
    onEdit: setEditUser,
    onAssign: setAssignUser,
    onMessage: handleMessage,
    onResend: user => void handleResend(user),
    onCreateLink: user => void handleCreateLink(user),
    onDeactivate: user => setConfirm({ kind: 'deactivate', user, lastAdminWarning: null }),
    onReactivate: user => void handleReactivate(user),
    onRemove: user => setConfirm({ kind: 'remove', user, lastAdminWarning: null }),
  };

  const confirmUser = confirm?.user;
  const isLastAdminStep = confirm?.lastAdminWarning != null;
  const isBusy = isDeactivating || isRemoving;

  const modals = (
    <>
      {editUser && <EditClientUserModal key={editUser.id} user={editUser} onClose={() => setEditUser(null)} />}
      {assignUser && (
        <AssignClientProjectsModal key={assignUser.id} user={assignUser} onClose={() => setAssignUser(null)} />
      )}
      {messageUser && (
        <MessageClientModal
          key={messageUser.id}
          target={{
            organizationId: messageUser.organization_id,
            projectIds: messageUser.projects.map(project => project.id),
            recipientIds: [messageUser.id],
          }}
          onClose={() => setMessageUser(null)}
        />
      )}
      {viewUser && <ClientUserProfileModal user={viewUser} onClose={() => setViewUser(null)} />}

      <ConfirmEffectModal
        open={confirm?.kind === 'deactivate' && !isLastAdminStep}
        danger
        title={t('deactivate.title', { defaultValue: 'Deactivate this client user?' })}
        confirmLabel={t('deactivate.confirm', { defaultValue: 'Deactivate' })}
        loading={isBusy}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void runConfirmed(confirm, false)}
      >
        {confirmUser &&
          t('deactivate.body', {
            name: confirmUser.name,
            defaultValue:
              '{{name}} loses access right away. If they have a session open, their next request fails and they are signed out. You can reactivate them later and their previous status is restored.',
          })}
      </ConfirmEffectModal>

      <ConfirmEffectModal
        open={confirm?.kind === 'remove' && !isLastAdminStep}
        danger
        title={t('remove.title', { defaultValue: 'Remove this client user?' })}
        confirmLabel={t('remove.confirm', { defaultValue: 'Remove user' })}
        loading={isBusy}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void runConfirmed(confirm, false)}
      >
        {confirmUser &&
          t('remove.body', {
            name: confirmUser.name,
            defaultValue:
              '{{name}} and their project assignments are removed. Comments and approvals they made stay in the history.',
          })}
      </ConfirmEffectModal>

      <ConfirmEffectModal
        open={isLastAdminStep}
        danger
        title={t('lastAdmin.title', { defaultValue: 'This is the last Client Admin' })}
        confirmLabel={t('lastAdmin.confirm', { defaultValue: 'Continue anyway' })}
        loading={isBusy}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void runConfirmed(confirm, true)}
      >
        {confirm?.lastAdminWarning}
      </ConfirmEffectModal>

      {shareLink && (
        <InvitationLinkModal
          open
          link={shareLink.link}
          email={shareLink.email}
          reason={shareLink.reason}
          onClose={() => setShareLink(null)}
        />
      )}
    </>
  );

  return { actions, modals };
};
