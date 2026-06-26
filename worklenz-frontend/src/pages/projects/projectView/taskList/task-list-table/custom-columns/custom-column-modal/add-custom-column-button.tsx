import { PlusOutlined, CrownOutlined } from '@/shared/antd-imports';
import { Button, Tooltip } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setCustomColumnModalAttributes,
  toggleCustomColumnModalOpen,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { LICENSING_SETTINGS } from '@/shared/licensing_settings';

const AddCustomColumnButton = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('common');
  const { isFreeUser: isFree, hasBusinessAccess } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();
  const columnList = useAppSelector(state => state.taskColumnsReducer.columnList);
  const customColumnsCount = columnList.filter(column => column.custom_column).length;
  const hasReachedCustomFieldLimit = !hasBusinessAccess && customColumnsCount >= LICENSING_SETTINGS.CUSTOM_FIELDS_LIMIT;

  const handleModalOpen = () => {
    if (isFree || hasReachedCustomFieldLimit) {
      promptUpgrade();
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
