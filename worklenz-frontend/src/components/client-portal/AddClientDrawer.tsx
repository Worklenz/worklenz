import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAuthService } from '@/hooks/useAuth';
import { toggleAddClientDrawer } from '@/features/clients-portal/clients/clients-slice';
import { showUpgradePrompt } from '@/features/admin-center/admin-center.slice';
import { hasBusinessFeatureAccess } from '@/utils/subscription-utils';
import { AddClientWizard } from './add-client-wizard/AddClientWizard';

/**
 * The Add Client entry point. It is mounted once in the navbar and opened through the
 * `isAddClientDrawerOpen` flag, so the navbar's quick action and the Clients page keep working
 * unchanged. The flow itself lives in the wizard.
 */
const AddClientDrawer = () => {
  const { t } = useTranslation('client-portal-add-client');
  const dispatch = useAppDispatch();
  const authService = useAuthService();

  const isOpen = useAppSelector(
    state => state.clientsPortalReducer.clientsReducer.isAddClientDrawerOpen
  );
  const preset = useAppSelector(state => state.clientsPortalReducer.clientsReducer.addClientPreset);
  const hasBusinessAccess = hasBusinessFeatureAccess(authService.getCurrentSession());

  return (
    <AddClientWizard
      open={isOpen}
      preset={preset}
      // The flag is a toggle, so only flip it while open: a late close must never reopen the wizard.
      onClose={() => {
        if (isOpen) dispatch(toggleAddClientDrawer());
      }}
      canCreate={hasBusinessAccess}
      onUpgradeRequired={() =>
        dispatch(
          showUpgradePrompt({
            title: t('upgrade.title', { defaultValue: 'Clients' }),
            description: t('upgrade.description', {
              defaultValue:
                'Give clients a branded portal to track project progress. Available on the Business plan.',
            }),
          })
        )
      }
    />
  );
};

export default AddClientDrawer;
