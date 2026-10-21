import { useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Steps, message } from '@/shared/antd-imports';
import { useAddPortalClientMutation } from '@/api/client-portal/portal-access-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { InvitationLinkModal, ROLE_LABEL_COPY } from '@/components/client-portal/v2';
import type { AddClientPreset } from '@/features/clients-portal/clients/clients-slice';
import type { AddClientResult } from '@/types/client-portal/v2';
import { AccessStep } from './AccessStep';
import { DetailsStep } from './DetailsStep';
import { MethodStep } from './MethodStep';
import {
  INITIAL_WIZARD_STATE,
  buildAddClientRequest,
  canContinue,
  getEffectiveRole,
  wizardReducer,
} from './wizard-state';

interface AddClientWizardProps {
  open: boolean;
  /** Opens straight on the user's details for an organization, when started from its workspace. */
  preset?: AddClientPreset | null;
  onClose: () => void;
  /** False when the plan does not include the client portal: saving then asks to upgrade instead. */
  canCreate: boolean;
  onUpgradeRequired: () => void;
}

/**
 * Add Client: two ways in (a new organization, or a user for an existing one), three steps (method,
 * details, access and review) and one transaction on the server. "Send the invitation now" can be
 * unchecked to save the user without inviting anyone, so nothing is ever an irreversible single submit.
 */
export const AddClientWizard = ({ open, preset = null, onClose, canCreate, onUpgradeRequired }: AddClientWizardProps) => {
  const { t } = useTranslation('client-portal-v2-add-client');
  const { t: tShared } = useTranslation('client-portal-v2');
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);
  const [shareLink, setShareLink] = useState<{ link: string; email: string } | null>(null);
  const [addClient, { isLoading }] = useAddPortalClientMutation();

  // Started from an organization: skip the choice of method and organization.
  useEffect(() => {
    if (!open || !preset) return;
    dispatch({ type: 'startForOrganization', organization: preset.company });
  }, [open, preset]);

  const role = getEffectiveRole(state);
  const isLastStep = state.step === 3;

  const titles = {
    1: t('title.method', { defaultValue: 'How do you want to add this client?' }),
    2:
      state.method === 'new_organization'
        ? t('title.detailsNew', { defaultValue: 'Tell us about the organization' })
        : t('title.detailsExisting', { defaultValue: 'Choose the organization and the user' }),
    3: t('title.access', { defaultValue: 'Access & review' }),
  } as const;

  const reportResult = (result: AddClientResult) => {
    const name = result.user.name;
    const invite = result.invite;

    if (invite.requested && !invite.email_sent) {
      if (invite.link) setShareLink({ link: invite.link, email: result.user.email });
      message.warning(
        t('result.emailNotSent', {
          name,
          defaultValue: '{{name}} was saved, but the invitation email could not be sent. Share the link instead.',
        })
      );
      return;
    }

    if (!invite.requested) {
      message.success(
        t('result.addedNoInvite', {
          name,
          role: tShared(ROLE_LABEL_COPY[role].key, { defaultValue: ROLE_LABEL_COPY[role].defaultValue }),
          defaultValue: '{{name}} was added as {{role}}. No invitation was sent yet.',
        })
      );
      return;
    }

    const switchedOn =
      result.portals_switched_on > 0
        ? t('result.portalsSwitchedOn', {
            count: result.portals_switched_on,
            defaultValue: 'Client Portal switched on for {{count}} project(s).',
          })
        : '';
    message.success(
      `${t('result.invited', {
        email: result.user.email,
        defaultValue: 'Invitation sent to {{email}}.',
      })} ${switchedOn} ${t('result.activationHint', {
        defaultValue:
          'They open the link in the email and sign in with a 6-digit code sent to their address. There is no password.',
      })}`.replace(/\s+/g, ' ')
    );
  };

  const handleNext = async () => {
    if (!isLastStep) {
      dispatch({ type: 'next' });
      return;
    }

    if (!canCreate) {
      onUpgradeRequired();
      return;
    }

    try {
      const result = await addClient(buildAddClientRequest(state)).unwrap();
      if (result.body) reportResult(result.body);
      onClose();
    } catch (error) {
      message.error(
        getPortalErrorMessage(error, t('result.failed', { defaultValue: 'The client could not be added.' }))
      );
    }
  };

  const submitLabel = state.sendInvitation
    ? t('footer.sendInvitation', { defaultValue: 'Send invitation' })
    : t('footer.addUser', { defaultValue: 'Add user' });

  const stepContent =
    state.step === 1 ? (
      <MethodStep method={state.method} onSelect={method => dispatch({ type: 'selectMethod', method })} />
    ) : state.step === 2 ? (
      <DetailsStep
        state={state}
        onOrganizationName={value => dispatch({ type: 'setOrganizationName', value })}
        onOrganization={organization => dispatch({ type: 'selectOrganization', organization })}
        onPerson={(field, value) => dispatch({ type: 'setPerson', field, value })}
        onRole={nextRole => dispatch({ type: 'setRole', role: nextRole })}
      />
    ) : (
      <AccessStep
        state={state}
        role={role}
        onToggleProject={projectId => dispatch({ type: 'toggleProject', projectId })}
        onSendInvitation={value => dispatch({ type: 'setSendInvitation', value })}
      />
    );

  return (
    <>
      <Modal
        open={open}
        title={titles[state.step]}
        width={600}
        onCancel={isLoading ? undefined : onClose}
        afterClose={() => dispatch({ type: 'reset' })}
        maskClosable={false}
        destroyOnHidden
        footer={[
          <Button
            key="back"
            disabled={isLoading}
            onClick={() => (state.step === 1 ? onClose() : dispatch({ type: 'back' }))}
          >
            {state.step === 1
              ? tShared('cancel', { defaultValue: 'Cancel' })
              : t('footer.back', { defaultValue: 'Back' })}
          </Button>,
          <Button
            key="next"
            type="primary"
            loading={isLoading}
            disabled={!canContinue(state)}
            onClick={() => void handleNext()}
          >
            {isLastStep ? submitLabel : t('footer.continue', { defaultValue: 'Continue' })}
          </Button>,
        ]}
      >
        <Steps
          size="small"
          current={state.step - 1}
          style={{ marginBottom: 20 }}
          items={[
            { title: t('steps.method', { defaultValue: 'Method' }) },
            { title: t('steps.details', { defaultValue: 'Details' }) },
            { title: t('steps.access', { defaultValue: 'Access' }) },
          ]}
        />
        {stepContent}
      </Modal>

      {shareLink && (
        <InvitationLinkModal open link={shareLink.link} email={shareLink.email} onClose={() => setShareLink(null)} />
      )}
    </>
  );
};

