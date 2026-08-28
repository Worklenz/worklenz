import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Typography, Flex, CrownOutlined } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { hideUpgradePrompt, toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';

const { Title, Paragraph } = Typography;

// A lightweight "short description + Upgrade Now" prompt for gated actions
// that don't have a full page to show a blurred preview on (quick actions,
// project integrations, etc.) — mirrors the popover the top nav used to
// show. Mounted once globally; triggered via dispatch(showUpgradePrompt(...)).
const UpgradePromptModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('upgrade-preview');
  const { open, title, description } = useAppSelector(
    state => state.adminCenterReducer.upgradePrompt
  );

  const handleClose = () => dispatch(hideUpgradePrompt());

  const handleUpgrade = () => {
    dispatch(hideUpgradePrompt());
    setTimeout(() => {
      dispatch(toggleUpgradeModal());
    }, 0);
  };

  return (
    // Explicit zIndex so this always sits above whatever gated form/modal
    // (e.g. Add Expense) triggered it — antd Modals default to the same
    // z-index (1000), so without this the one mounted first (this one, since
    // it's mounted globally at app start) would paint underneath a modal that
    // opened later, like the quick-action forms it's meant to interrupt.
    <Modal open={open} onCancel={handleClose} footer={null} centered width={380} zIndex={1050}>
      <Flex vertical align="center" gap={16} style={{ textAlign: 'center', paddingTop: 8 }}>
        <Flex
          align="center"
          justify="center"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(250, 173, 20, 0.15)',
          }}
        >
          <CrownOutlined style={{ fontSize: 22, color: '#faad14' }} />
        </Flex>

        <div>
          <Title level={4} style={{ marginBottom: 4 }}>
            {title}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {description}
          </Paragraph>
        </div>

        <Button type="primary" size="large" block onClick={handleUpgrade}>
          {t('upgradeNowButton', { defaultValue: 'Upgrade Now' })}
        </Button>
      </Flex>
    </Modal>
  );
};

export default UpgradePromptModal;
