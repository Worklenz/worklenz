import React, { useCallback } from 'react';
import { Select, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { switchOrganization } from '@/store/slices/authSlice';
import type { RootState } from '@/store';

const OrganizationSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { organizations, currentOrganizationId, switchingOrganization } = useAppSelector(
    (state: RootState) => state.auth
  );

  const handleOrganizationChange = useCallback(
    async (value: string) => {
      if (value === currentOrganizationId) return;

      try {
        const result = await dispatch(switchOrganization(value));

        if (switchOrganization.fulfilled.match(result)) {
          message.success(t('organizations.switch_success', { defaultValue: 'Organization switched successfully' }));
          // Force page reload to refetch all data with new organization context
          window.location.reload();
        } else {
          message.error(t('organizations.switch_error', { defaultValue: 'Failed to switch organization' }));
        }
      } catch (error) {
        console.error('Error switching organization:', error);
        message.error(t('organizations.switch_error', { defaultValue: 'Failed to switch organization' }));
      }
    },
    [dispatch, currentOrganizationId, t]
  );

  // Only show if user has multiple organizations
  if (!organizations || organizations.length <= 1) {
    return null;
  }

  return (
    <Select
      value={currentOrganizationId || undefined}
      onChange={handleOrganizationChange}
      loading={switchingOrganization}
      disabled={switchingOrganization}
      style={{ width: 200 }}
      placeholder={t('organizations.select', { defaultValue: 'Select Organization' })}
    >
      {organizations.map((org) => (
        <Select.Option key={org.teamId} value={org.teamId}>
          {org.name}
        </Select.Option>
      ))}
    </Select>
  );
};

export default OrganizationSwitcher;
