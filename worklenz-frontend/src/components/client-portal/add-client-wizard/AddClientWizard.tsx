import { useEffect, useReducer, useState } from 'react';
import { Alert, Button, Flex, Modal, Steps, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  ImportOutcome,
  InviteOutcome,
  useAddCompanyUserToClientMutation,
  useGetClientProjectsListQuery,
  useImportClientsMutation,
  useInviteCompanyUserMutation,
  useOnboardClientMutation,
} from '@/api/client-portal/company-users-api';
import type { AddClientPreset } from '@/features/clients-portal/clients/clients-slice';
import { getApiErrorMessage } from '@/pages/client-portal/clients/company-users/company-users-helpers';
import { ClientInvitationLinkModal } from '@/pages/client-portal/clients/ClientInvitationLinkModal';
import { CompanyUserStep } from './CompanyUserStep';
import { CsvImportStep } from './CsvImportStep';
import { CsvProblemRows } from './CsvProblemRows';
import { ExistingContactStep } from './ExistingContactStep';
import { MethodStep } from './MethodStep';
import { NewClientStep } from './NewClientStep';
import { ReviewStep } from './ReviewStep';
import { useCsvImport } from './useCsvImport';
import {
  INITIAL_WIZARD_STATE,
  WizardMethod,
  buildAddUserRequest,
  buildOnboardRequest,
  canContinue,
  canDeferInvite,
  getReviewSubject,
  getStepCount,
  wizardReducer,
} from './wizard-state';

interface AddClientWizardProps {
  open: boolean;
  /** Opens straight on "Add a client user" for a company, when started from that company. */
  preset?: AddClientPreset | null;
  onClose: () => void;
  /** False when the plan does not include the client portal: saving then asks to upgrade instead. */
  canCreate: boolean;
  onUpgradeRequired: () => void;
}

/**
 * Add Client: four ways in (a new client, a user for an existing company, an existing contact, a
 * CSV), each with its own details step, converging on one review step. "Send portal invite now" can
 * be left unchecked to save the record without inviting anyone, so nothing is ever an irreversible
 * single submit.
 */
export const AddClientWizard = ({
  open,
  preset = null,
  onClose,
  canCreate,
  onUpgradeRequired,
}: AddClientWizardProps) => {
  const { t } = useTranslation('client-portal-add-client');
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);

  // Started from a company: skip the choice of method and company, and land on the user's details.
  useEffect(() => {
    if (!open || !preset) return;
    dispatch({ type: 'selectMethod', method: preset.method });
    dispatch({ type: 'selectUserCompany', company: preset.company });
    dispatch({ type: 'next' });
  }, [open, preset]);
  const [importOutcome, setImportOutcome] = useState<ImportOutcome | null>(null);
  const [linkToShare, setLinkToShare] = useState('');

  const [onboardClient, { isLoading: isOnboarding }] = useOnboardClientMutation();
  const [addCompanyUser, { isLoading: isAddingUser }] = useAddCompanyUserToClientMutation();
  const [inviteContact, { isLoading: isInviting }] = useInviteCompanyUserMutation();
  const [importClients, { isLoading: isImporting }] = useImportClientsMutation();
  const csvImport = useCsvImport(dispatch);

  // The chosen company's projects, to apply a Permission Template to the ones it has right now.
  const projectsQuery = useGetClientProjectsListQuery(
    { clientId: state.user.companyId ?? '' },
    { skip: state.method !== 'user' || state.user.companyId === null }
  );
  const companyProjectIds = (projectsQuery.data?.body?.projects ?? []).map(project => project.id);

  const isSubmitting = isOnboarding || isAddingUser || isInviting || isImporting;
  const stepCount = getStepCount(state.method);
  const isLastStep = state.step === stepCount;
  const subject = getReviewSubject(state);
  const canProceed =
    canContinue(state) &&
    // An import needs at least one row the server accepts.
    (state.method !== 'csv' || state.step !== 2 || (csvImport.validation?.summary.valid ?? 0) > 0);

  const handleAfterClose = () => {
    dispatch({ type: 'reset' });
    setImportOutcome(null);
    csvImport.clear();
  };

  const copyLink = () => {
    navigator.clipboard
      ?.writeText(linkToShare)
      .then(() =>
        message.success(t('messages.linkCopied', { defaultValue: 'Invitation link copied.' }))
      )
      .catch(() =>
        message.error(t('messages.linkCopyError', { defaultValue: 'Could not copy the link.' }))
      );
  };

  /** Tells the operator what happened to the invitation, and offers the link when it is needed. */
  const reportInvite = (invite: InviteOutcome, name: string) => {
    if (invite.error) {
      message.warning(
        t('messages.inviteFailed', {
          name,
          error: invite.error,
          defaultValue:
            '{{name}} was saved, but the invitation could not be sent ({{error}}). You can send it from the list.',
        })
      );
      return;
    }

    if (invite.link) setLinkToShare(invite.link);

    if (invite.requested && invite.delivery === 'email' && !invite.email_sent) {
      message.warning(
        t('messages.emailNotSent', {
          name,
          defaultValue:
            '{{name}} was saved, but the email could not be sent. Share the link instead.',
        })
      );
    }
  };

  /**
   * Says what happened once a record is saved: the invitation went out, is ready to copy, was not
   * asked for, or failed (the record is kept either way).
   */
  const reportSaved = (
    invite: InviteOutcome,
    name: string,
    texts: { invited: string; linkReady: string; notInvited: string }
  ) => {
    const emailFailed = invite.requested && invite.delivery === 'email' && !invite.email_sent;

    if (invite.error || emailFailed) {
      reportInvite(invite, name);
    } else if (invite.requested && invite.delivery === 'link') {
      reportInvite(invite, name);
      message.success(texts.linkReady);
    } else {
      message.success(invite.requested ? texts.invited : texts.notInvited);
    }
  };

  const submitNewClient = async () => {
    const welcomeText = t('newClient.welcomeMessageText', {
      name: state.company.firstName.trim(),
      defaultValue: 'Hi {{name}}, welcome to your client portal. Send us a message here any time.',
    });
    const result = (await onboardClient(buildOnboardRequest(state, welcomeText)).unwrap()).body;
    const name = result.user?.name ?? state.company.firstName.trim();
    const email = state.company.email.trim();

    reportSaved(result.invite, name, {
      invited: t('messages.clientAddedInvited', {
        name,
        email,
        defaultValue:
          'Client added, with {{name}} as POC by default. Invitation sent to {{email}}.',
      }),
      linkReady: t('messages.clientAddedLink', {
        name,
        defaultValue: 'Client added. Copy the invitation link to share it with {{name}}.',
      }),
      notInvited: t('messages.clientAddedNotInvited', {
        name,
        defaultValue: 'Client added, with {{name}} as POC by default. Not invited yet.',
      }),
    });
  };

  const submitCompanyUser = async () => {
    const result = (
      await addCompanyUser({
        clientId: state.user.companyId as string,
        body: buildAddUserRequest(state, companyProjectIds),
      }).unwrap()
    ).body;
    const name = result.user?.name ?? state.user.firstName.trim();
    const company = state.user.companyName;
    const email = state.user.email.trim();

    reportSaved(result.invite, name, {
      invited: t('messages.userAddedInvited', {
        name,
        company,
        email,
        defaultValue: '{{name}} was added to {{company}}. Invitation sent to {{email}}.',
      }),
      linkReady: t('messages.userAddedLink', {
        name,
        company,
        defaultValue: '{{name}} was added to {{company}}. Copy the invitation link to share it.',
      }),
      notInvited: t('messages.userAddedNotInvited', {
        name,
        company,
        defaultValue: '{{name}} was added to {{company}}. Not invited yet.',
      }),
    });
  };

  const submitExistingContact = async () => {
    const contact = state.existing;
    if (!contact) return;

    const result = (await inviteContact({ id: contact.id, delivery: state.delivery }).unwrap())
      .body;

    if (result.delivery === 'link' && result.link) {
      setLinkToShare(result.link);
      message.success(
        t('messages.inviteLinkReady', { defaultValue: 'Invitation link ready to copy.' })
      );
    } else if (!result.email_sent) {
      if (result.link) setLinkToShare(result.link);
      message.warning(
        t('messages.emailNotSent', {
          name: contact.name,
          defaultValue:
            '{{name}} was saved, but the email could not be sent. Share the link instead.',
        })
      );
    } else {
      message.success(
        t('messages.inviteSent', {
          email: contact.email,
          defaultValue: 'Invitation sent to {{email}}.',
        })
      );
    }
  };

  const handleSubmit = async () => {
    if (!canCreate) {
      onUpgradeRequired();
      return;
    }

    try {
      if (state.method === 'company') await submitNewClient();
      else if (state.method === 'user') await submitCompanyUser();
      else if (state.method === 'existing') await submitExistingContact();
      else return;

      onClose();
    } catch (error) {
      message.error(
        getApiErrorMessage(error) ||
          t('messages.saveError', { defaultValue: 'Could not save. Please try again.' })
      );
    }
  };

  const handleImport = async () => {
    if (!canCreate) {
      onUpgradeRequired();
      return;
    }

    try {
      const outcome = (await importClients({ rows: state.csv.rows }).unwrap()).body;
      setImportOutcome(outcome);
    } catch (error) {
      message.error(
        getApiErrorMessage(error) ||
          t('messages.importError', { defaultValue: 'The import failed. Please try again.' })
      );
    }
  };

  const handleContinue = () => {
    if (!canProceed) return;

    if (state.method === 'csv' && state.step === 2) {
      void handleImport();
      return;
    }
    if (isLastStep) {
      void handleSubmit();
      return;
    }
    dispatch({ type: 'next' });
  };

  const stepTitle = (): string => {
    if (state.step === 1)
      return t('title.method', { defaultValue: 'How do you want to add this client?' });
    if (state.step === 3) return t('title.review', { defaultValue: 'Review & send' });

    switch (state.method) {
      case 'company':
        return t('title.company', { defaultValue: 'Tell us about the client' });
      case 'user':
        return t('title.user', { defaultValue: 'Choose the company, then the new user' });
      case 'existing':
        return t('title.existing', { defaultValue: 'Choose who to invite' });
      default:
        return t('title.csv', { defaultValue: 'Upload your CSV file' });
    }
  };

  const continueLabel = (): string => {
    if (state.method === 'csv' && state.step === 2) {
      return t('actions.import', { defaultValue: 'Import' });
    }
    if (!isLastStep) return t('actions.continue', { defaultValue: 'Continue' });

    const inviting = canDeferInvite(state.method) ? state.sendInvite : true;
    const labels: Record<WizardMethod, [string, string]> = {
      company: [
        t('actions.addClient', { defaultValue: 'Add Client' }),
        t('actions.addClientAndInvite', { defaultValue: 'Add Client & Send Invite' }),
      ],
      user: [
        t('actions.addUser', { defaultValue: 'Add Client User' }),
        t('actions.addUserAndInvite', { defaultValue: 'Add User & Send Invite' }),
      ],
      existing: [
        t('actions.sendInvite', { defaultValue: 'Send Invite' }),
        t('actions.sendInvite', { defaultValue: 'Send Invite' }),
      ],
      csv: [
        t('actions.import', { defaultValue: 'Import' }),
        t('actions.import', { defaultValue: 'Import' }),
      ],
    };
    return labels[state.method ?? 'company'][inviting ? 1 : 0];
  };

  const renderStep = () => {
    if (state.step === 1) {
      return (
        <MethodStep
          method={state.method}
          onSelect={method => dispatch({ type: 'selectMethod', method })}
        />
      );
    }

    if (state.step === 2) {
      switch (state.method) {
        case 'company':
          return (
            <NewClientStep
              value={state.company}
              onChange={patch => dispatch({ type: 'updateCompany', patch })}
            />
          );
        case 'user':
          return (
            <CompanyUserStep
              value={state.user}
              onChange={patch => dispatch({ type: 'updateUser', patch })}
              onSelectCompany={company => dispatch({ type: 'selectUserCompany', company })}
            />
          );
        case 'existing':
          return (
            <ExistingContactStep
              selected={state.existing}
              onSelect={contact => dispatch({ type: 'selectExisting', contact })}
            />
          );
        case 'csv':
          return (
            <CsvImportStep
              fileName={state.csv.fileName}
              isBusy={csvImport.isBusy}
              error={csvImport.error}
              validation={csvImport.validation}
              onChooseFile={csvImport.chooseFile}
              onClear={csvImport.clear}
            />
          );
        default:
          return null;
      }
    }

    if (!state.method || !subject) return null;

    return (
      <ReviewStep
        method={state.method}
        subject={subject}
        template={state.user.template}
        templateProjectCount={companyProjectIds.length}
        sendInvite={state.sendInvite}
        delivery={state.delivery}
        onSendInviteChange={value => dispatch({ type: 'setSendInvite', value })}
        onDeliveryChange={value => dispatch({ type: 'setDelivery', value })}
      />
    );
  };

  const stepItems =
    state.method === 'csv'
      ? [
          { title: t('steps.method', { defaultValue: 'Method' }) },
          { title: t('steps.file', { defaultValue: 'File' }) },
        ]
      : [
          { title: t('steps.method', { defaultValue: 'Method' }) },
          { title: t('steps.details', { defaultValue: 'Details' }) },
          { title: t('steps.review', { defaultValue: 'Review' }) },
        ];

  const renderImportResult = () =>
    importOutcome && (
      <Flex vertical gap={12}>
        <Alert
          type={importOutcome.added_users > 0 ? 'success' : 'warning'}
          showIcon
          message={t('csv.result.title', { defaultValue: 'Import finished' })}
          description={t('csv.result.detail', {
            companies: importOutcome.created_companies,
            users: importOutcome.added_users,
            skipped: importOutcome.skipped,
            defaultValue:
              '{{companies}} companies created, {{users}} users added, {{skipped}} rows skipped. Everyone is Not invited until you invite them from the list.',
          })}
        />
        <CsvProblemRows rows={importOutcome.rows} />
      </Flex>
    );

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        afterClose={handleAfterClose}
        maskClosable={false}
        destroyOnHidden
        width={560}
        title={
          importOutcome ? t('csv.result.title', { defaultValue: 'Import finished' }) : stepTitle()
        }
        footer={
          importOutcome ? (
            <Button type="primary" onClick={onClose}>
              {t('actions.done', { defaultValue: 'Done' })}
            </Button>
          ) : (
            <Flex justify="space-between" gap={8}>
              <Button
                onClick={state.step === 1 ? onClose : () => dispatch({ type: 'back' })}
                disabled={isSubmitting}
              >
                {state.step === 1
                  ? t('actions.cancel', { defaultValue: 'Cancel' })
                  : t('actions.back', { defaultValue: 'Back' })}
              </Button>
              <Button
                type="primary"
                onClick={handleContinue}
                disabled={!canProceed}
                loading={isSubmitting}
              >
                {continueLabel()}
              </Button>
            </Flex>
          )
        }
      >
        {importOutcome ? (
          renderImportResult()
        ) : (
          <>
            <Steps
              size="small"
              current={state.step - 1}
              items={stepItems}
              style={{ marginBottom: 20 }}
              responsive
            />
            {renderStep()}
          </>
        )}
      </Modal>

      <ClientInvitationLinkModal
        open={Boolean(linkToShare)}
        link={linkToShare}
        onClose={() => setLinkToShare('')}
        onCopy={copyLink}
      />
    </>
  );
};
