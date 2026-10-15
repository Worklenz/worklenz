import React from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/shared/antd-imports';
import type { PortalVisibility } from '@/types/client-portal/v2';

interface VisibilitySwitchProps {
  visibility: PortalVisibility;
  onChange: (next: PortalVisibility) => void;
  /** Name of the item, used for the accessible label, e.g. the task or file name. */
  itemLabel: string;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Shares or withdraws one item (task, file, milestone). The caller writes the audit event and
 * shows the toast; switching back to Internal Only removes the item from the portal immediately.
 */
export const VisibilitySwitch = ({
  visibility,
  onChange,
  itemLabel,
  disabled,
  loading,
}: VisibilitySwitchProps) => {
  const { t } = useTranslation('client-portal-v2');
  return (
    <Switch
      size="small"
      checked={visibility === 'client'}
      disabled={disabled}
      loading={loading}
      onChange={checked => onChange(checked ? 'client' : 'internal')}
      aria-label={t('visibilitySwitchLabel', {
        defaultValue: 'Client visible: {{item}}',
        item: itemLabel,
      })}
    />
  );
};
