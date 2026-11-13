import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  DeleteOutlined,
  ExclamationCircleOutlined,
  Flex,
  Input,
  Modal,
  Skeleton,
  Typography,
} from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useMessage } from '@/hooks/useMessage';
import { logoutUser } from '@/store/slices/authSlice';
import { useRequestAccountDeletionMutation, useSubmitAccountDeletionRequestMutation } from '@/store/api-v2';
import { errorMessage } from '@/components/v2';

/**
 * What a Client Member or Viewer sees instead of the delete button. A Client Admin decides who has an identity
 * in the organization's portal, so only an admin deletes their own account directly. Everyone else is never left
 * without a way to ask: the request is recorded and goes to the project team, and a Client Admin can also remove
 * them at once under Members.
 */
const RequestAccountDeletion: React.FC = () => {
  const { t } = useTranslation();
  const message = useMessage();
  const [submit, { isLoading }] = useSubmitAccountDeletionRequestMutation();
  const [isSent, setIsSent] = useState(false);

  const onRequest = async () => {
    try {
      const result = await submit().unwrap();
      setIsSent(true);
      void message.success(
        result.sent
          ? t('settings.deleteAccount.request.sent', { defaultValue: 'Your request was sent to your project team.' })
          : t('settings.deleteAccount.request.alreadySent', {
              defaultValue: 'You already sent a request today. Your project team has been notified.',
            })
      );
    } catch (error) {
      void message.error(
        errorMessage(error) ??
          t('settings.deleteAccount.request.failed', { defaultValue: 'We could not send your request. Please try again.' })
      );
    }
  };

  return (
    <Card title={t('settings.deleteAccount.title', { defaultValue: 'Delete Account' })}>
      <Flex vertical gap={16}>
        <Alert
          type="info"
          showIcon
          message={t('settings.deleteAccount.request.adminOnly', {
            defaultValue: 'Only a Client Admin can delete an account here.',
          })}
          description={t('settings.deleteAccount.request.explain', {
            defaultValue:
              'A Client Admin of your organization decides who has access to your portal, so you cannot delete your account yourself. You can ask your project team to delete yours. A Client Admin can also remove you right away under Settings > Members.',
          })}
        />
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {t('settings.deleteAccount.request.note', {
            defaultValue:
              'Your request is recorded and sent to your project team. They will follow up with you, including about any data you want erased.',
          })}
        </Typography.Paragraph>
        <div>
          <Button type="primary" icon={<DeleteOutlined />} onClick={onRequest} loading={isLoading} disabled={isSent}>
            {t('settings.deleteAccount.request.button', { defaultValue: 'Request account deletion' })}
          </Button>
        </div>
      </Flex>
    </Card>
  );
};

/**
 * A Client Admin soft-deletes their own whole login (every portal they belong to). Same rules as the main app's
 * account deletion: deactivated now, data removed within 30 days, restored only by support or the project team.
 * The profile stays in the project team's admin console, marked "Account deleted", until the window ends.
 */
const DeleteAccountSettings: React.FC = () => {
  const { t } = useTranslation();
  const message = useMessage();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { can, isLoading: isAccessLoading } = useClientAccess();
  const [requestDeletion, { isLoading }] = useRequestAccountDeletionMutation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const confirmWord = t('settings.deleteAccount.confirmWord', { defaultValue: 'DELETE' });
  const closeConfirm = () => {
    setIsConfirmOpen(false);
    setConfirmText('');
  };

  const onConfirm = async () => {
    try {
      // The server checks the same word, in English, whatever the display language.
      await requestDeletion({ confirmation: 'DELETE' }).unwrap();
      closeConfirm();
      setIsSubmitted(true);
    } catch (error) {
      // A blocked deletion (last Client Admin, sole approver) says exactly what to fix first.
      void message.error(errorMessage(error) ?? t('settings.deleteAccount.failed', { defaultValue: 'We could not delete your account. Please try again.' }));
    }
  };

  const signOut = async () => {
    await dispatch(logoutUser());
    navigate('/auth/login', { replace: true });
  };

  // The role is known before anything about deleting is shown: the delete form is never flashed at someone
  // who cannot use it. The server enforces the same rule.
  if (isAccessLoading) {
    return (
      <Card title={t('settings.deleteAccount.title', { defaultValue: 'Delete Account' })}>
        <Skeleton active />
      </Card>
    );
  }
  if (!can.manageUsers) return <RequestAccountDeletion />;

  return (
    <Card title={t('settings.deleteAccount.title', { defaultValue: 'Delete Account' })}>
      <Flex vertical gap={16}>
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={t('settings.deleteAccount.warningTitle', { defaultValue: 'Warning: this action cannot be undone' })}
          description={
            <div>
              <Typography.Paragraph>{t('settings.deleteAccount.warningIntro', { defaultValue: 'Deleting your account will:' })}</Typography.Paragraph>
              <ul>
                <li>{t('settings.deleteAccount.warningPoint1', { defaultValue: 'Remove your access to every client portal you belong to' })}</li>
                <li>{t('settings.deleteAccount.warningPoint2', { defaultValue: 'Sign you out on all of your devices' })}</li>
                <li>
                  {t('settings.deleteAccount.warningPoint3', {
                    defaultValue: "Keep your past comments and approvals in each portal's history under your name",
                  })}
                </li>
              </ul>
              <Typography.Paragraph strong style={{ marginBottom: 0 }}>
                {t('settings.deleteAccount.retention', {
                  defaultValue:
                    'Your account is deactivated right away and your data is permanently deleted within 30 days of your request. To restore your account during that time, contact support.',
                })}
              </Typography.Paragraph>
            </div>
          }
        />

        <div>
          <Typography.Paragraph>{t('settings.deleteAccount.beforeTitle', { defaultValue: 'Before you delete your account:' })}</Typography.Paragraph>
          <ul>
            <li>{t('settings.deleteAccount.before1', { defaultValue: 'Download any files you want to keep' })}</li>
            <li>{t('settings.deleteAccount.before2', { defaultValue: 'Make sure another person is a Client Admin of your organization' })}</li>
            <li>{t('settings.deleteAccount.before3', { defaultValue: 'Tell your project team you are leaving' })}</li>
          </ul>
        </div>

        <div>
          <Button danger type="primary" icon={<DeleteOutlined />} onClick={() => setIsConfirmOpen(true)}>
            {t('settings.deleteAccount.button', { defaultValue: 'Delete My Account' })}
          </Button>
        </div>
      </Flex>

      <Modal
        open={isConfirmOpen}
        title={t('settings.deleteAccount.confirmTitle', { defaultValue: 'Confirm account deletion' })}
        onCancel={closeConfirm}
        onOk={onConfirm}
        okText={t('settings.deleteAccount.confirmButton', { defaultValue: 'Yes, delete my account' })}
        cancelText={t('settings.deleteAccount.cancel', { defaultValue: 'Cancel' })}
        okButtonProps={{ danger: true, disabled: confirmText !== confirmWord, loading: isLoading }}
        cancelButtonProps={{ disabled: isLoading }}
        maskClosable={!isLoading}
        destroyOnHidden
      >
        <Flex vertical gap={16}>
          <Alert type="error" showIcon message={t('settings.deleteAccount.finalWarning', { defaultValue: 'This action is permanent and cannot be reversed by you.' })} />
          <div>
            <Typography.Paragraph id="delete-account-instructions">
              {t('settings.deleteAccount.confirmInstructions', { defaultValue: 'To confirm, type DELETE below exactly as shown.' })}
            </Typography.Paragraph>
            <Input
              value={confirmText}
              onChange={event => setConfirmText(event.target.value)}
              onPressEnter={() => confirmText === confirmWord && void onConfirm()}
              placeholder={confirmWord}
              aria-label={t('settings.deleteAccount.confirmLabel', { defaultValue: 'Type DELETE to confirm' })}
              aria-describedby="delete-account-instructions"
              autoComplete="off"
            />
          </div>
        </Flex>
      </Modal>

      <Modal
        open={isSubmitted}
        title={t('settings.deleteAccount.submittedTitle', { defaultValue: 'Request submitted' })}
        closable={false}
        maskClosable={false}
        keyboard={false}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText={t('settings.deleteAccount.submittedOk', { defaultValue: 'Sign out' })}
        onOk={signOut}
      >
        <Typography.Paragraph>
          {t('settings.deleteAccount.submittedBody', {
            defaultValue:
              'Your account deletion request has been received. Your data will be permanently deleted within 30 days. You will now be signed out.',
          })}
        </Typography.Paragraph>
      </Modal>
    </Card>
  );
};

export default DeleteAccountSettings;
