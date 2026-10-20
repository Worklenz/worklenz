import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { MessageInstance } from 'antd/es/message/interface';

const REASON_MESSAGES: Record<string, { key: string; defaultValue: string }> = {
  invalid_state: {
    key: 'errors.invalidState',
    defaultValue: 'The connection request expired. Please try connecting again.',
  },
  forbidden: {
    key: 'errors.forbidden',
    defaultValue: 'You need access to this GitHub installation and must be a team owner or admin.',
  },
  already_connected: {
    key: 'errors.alreadyConnected',
    defaultValue: 'This GitHub account is already connected to another Worklenz team.',
  },
  team_already_connected: {
    key: 'errors.teamAlreadyConnected',
    defaultValue:
      'This team is already connected to a different GitHub account. Disconnect it first.',
  },
};

/**
 * Surfaces the outcome of the GitHub install redirect (`?github=success|error|requested`) as a
 * toast, then removes the params from the URL. Used wherever the install can be started.
 */
export const useGithubInstallResult = (
  messageApi: MessageInstance,
  onResult?: (status: string) => void
) => {
  const { t } = useTranslation('github-integration');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('github');
    if (!result) return;

    const reason = params.get('reason') || '';
    if (result === 'success') {
      messageApi.success(
        t('messages.connected', { defaultValue: 'GitHub connected successfully.' })
      );
    } else if (result === 'requested') {
      messageApi.info(
        t('messages.requested', {
          defaultValue: 'Installation was requested. An organization owner needs to approve it.',
        })
      );
    } else {
      const known = REASON_MESSAGES[reason];
      messageApi.error(
        known
          ? t(known.key, { defaultValue: known.defaultValue })
          : t('errors.connectFailed', {
              defaultValue: 'Could not connect GitHub. Please try again.',
            })
      );
    }

    params.delete('github');
    params.delete('reason');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    onResult?.(result);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
