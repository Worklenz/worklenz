import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, Tooltip, message } from '@/shared/antd-imports';
import { useSetPortalProjectPortalMutation } from '@/api/client-portal/portal-projects-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import type { PortalProject } from '@/types/client-portal/v2';
import { ConfirmEffectModal } from './ConfirmEffectModal';

interface PortalSwitchProps {
  project: Pick<PortalProject, 'id' | 'name' | 'organization_id' | 'portal_enabled' | 'active_client_users'>;
}

/**
 * Turns a project's Client Portal on or off. Off asks first and names how many active client users
 * lose access; a project with no client cannot be switched on until it is linked to one.
 */
export const PortalSwitch = ({ project }: PortalSwitchProps) => {
  const { t } = useTranslation('client-portal-v2');
  const [confirmOff, setConfirmOff] = useState(false);
  const [setPortal, { isLoading }] = useSetPortalProjectPortalMutation();

  const apply = async (enabled: boolean) => {
    try {
      const result = await setPortal({ projectId: project.id, enabled }).unwrap();
      if (enabled) {
        message.success(
          t('portalSwitch.turnedOn', {
            name: project.name,
            defaultValue: 'Client Portal is on for {{name}}. Assigned client users can now see it.',
          })
        );
      } else {
        message.success(
          t('portalSwitch.turnedOff', {
            name: project.name,
            count: result.body?.affected_users ?? 0,
            defaultValue: 'Client access to {{name}} was revoked immediately.',
          })
        );
      }
      setConfirmOff(false);
    } catch (error) {
      setConfirmOff(false);
      message.error(
        getPortalErrorMessage(
          error,
          t('portalSwitch.failed', { defaultValue: 'The Client Portal setting could not be changed.' })
        )
      );
    }
  };

  const hasNoClient = project.organization_id === null && !project.portal_enabled;
  const label = t('portalSwitch.label', { name: project.name, defaultValue: 'Client Portal: {{name}}' });

  return (
    <>
      <Tooltip
        title={
          hasNoClient
            ? t('portalSwitch.linkFirst', { defaultValue: 'Link this project to a client first.' })
            : project.portal_enabled
              ? t('portalSwitch.on', { defaultValue: 'Portal on' })
              : t('portalSwitch.off', { defaultValue: 'Portal off' })
        }
      >
        <span>
          <Switch
            size="small"
            checked={project.portal_enabled}
            loading={isLoading}
            disabled={hasNoClient}
            aria-label={label}
            onChange={checked => (checked ? void apply(true) : setConfirmOff(true))}
          />
        </span>
      </Tooltip>

      <ConfirmEffectModal
        open={confirmOff}
        danger
        title={t('portalSwitch.confirmTitle', { defaultValue: 'Turn the Client Portal off for this project?' })}
        confirmLabel={t('portalSwitch.confirmOff', { defaultValue: 'Turn off portal' })}
        loading={isLoading}
        onClose={() => setConfirmOff(false)}
        onConfirm={() => void apply(false)}
      >
        {t('portalSwitch.confirmBody', {
          name: project.name,
          count: project.active_client_users,
          defaultValue:
            '{{name}} disappears from the portal for {{count}} active client user(s). Open pages stop loading on their next request. Nothing is deleted, and you can turn it back on at any time.',
        })}
      </ConfirmEffectModal>
    </>
  );
};
