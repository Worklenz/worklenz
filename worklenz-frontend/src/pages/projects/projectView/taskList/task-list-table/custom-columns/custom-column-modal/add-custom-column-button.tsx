import { PlusOutlined, CrownOutlined } from '@/shared/antd-imports';
import { Button, Tooltip } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setCustomColumnModalAttributes,
  toggleCustomColumnModalOpen,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess, isFreeUser } from '@/ee/utils/subscription-utils';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { LICENSING_SETTINGS } from '@/shared/licensing_settings';

const AddCustomColumnButton = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('common');
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isFree = isFreeUser(currentSession);
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const columnList = useAppSelector(state => state.taskColumnsReducer.columnList);
  const customColumnsCount = columnList.filter(column => column.custom_column).length;
  const hasReachedCustomFieldLimit = !hasBusinessAccess && customColumnsCount >= LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT;

  const handleModalOpen = () => {
    if (isFree || hasReachedCustomFieldLimit) {
      dispatch(toggleUpgradeModal());
      return;
    }
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null }));
    dispatch(toggleCustomColumnModalOpen(true));
  };

  const tooltipTitle = hasReachedCustomFieldLimit
    ? t('customFieldLimitReached', { defaultValue: 'Custom field limit reached. Upgrade to add more.' })
    : isFree
      ? t('upgrade-plan', { defaultValue: 'Upgrade plan' })
      : t('addCustomColumn', { defaultValue: 'Add a custom column' });

  return (
    <>
      <Tooltip title={tooltipTitle}>
        <Button
          icon={isFree ? <CrownOutlined style={{ color: '#faad14' }} /> : <PlusOutlined />}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
          }}
          onClick={handleModalOpen}
        />
      </Tooltip>
    </>
  );
};

export default AddCustomColumnButton;
