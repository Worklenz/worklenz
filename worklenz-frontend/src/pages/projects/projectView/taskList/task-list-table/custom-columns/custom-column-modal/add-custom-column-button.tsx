import { PlusOutlined, CrownOutlined } from '@/shared/antd-imports';
import { Button, Tooltip } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setCustomColumnModalAttributes,
  toggleCustomColumnModalOpen,
} from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { useAuthService } from '@/hooks/useAuth';
import { isFreeUser } from '@/utils/subscription-utils';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useTranslation } from 'react-i18next';

const AddCustomColumnButton = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('common');
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const isFree = isFreeUser(currentSession);

  const handleModalOpen = () => {
    if (isFree) {
      dispatch(toggleUpgradeModal());
      return;
    }
    dispatch(setCustomColumnModalAttributes({ modalType: 'create', columnId: null }));
    dispatch(toggleCustomColumnModalOpen(true));
  };

  const tooltipTitle = isFree ? t('upgrade-plan') : 'Add a custom column';

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
          disabled={isFree}
        />
      </Tooltip>
    </>
  );
};

export default AddCustomColumnButton;
