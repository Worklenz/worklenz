import { useEffect } from 'react';
import { Button, Divider, Flex, Modal, theme, Typography, Steps } from '@/shared/antd-imports';
import { TeamOutlined, RightOutlined, UserDeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSumoTracking } from '@/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';

interface SeatLimitModalProps {
  open: boolean;
  onClose: () => void;
  currentMembers: number;
  planLimit: number;
  businessLimit: number;
  isAppSumoUser: boolean;
  onUpgrade: () => void;
  onDeactivate: () => void;
}

export const SeatLimitModal: React.FC<SeatLimitModalProps> = ({
  open,
  onClose,
  currentMembers,
  planLimit,
  businessLimit,
  isAppSumoUser,
  onUpgrade,
  onDeactivate,
}) => {
  const { t } = useTranslation('settings/team-members');
  const { token } = theme.useToken();
  const { trackAppSumoEvent } = useAppSumoTracking();

  useEffect(() => {
    if (open && isAppSumoUser) {
      trackAppSumoEvent(AppSumoUpsellEvents.SEAT_LIMIT_MODAL_SHOWN);
    }
  }, [open, isAppSumoUser]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      closable={true}
      maskClosable={false} // Cannot dismiss by clicking outside
      keyboard={false} // Cannot dismiss with Escape
      footer={null}
      width={540}
      centered
    >
      <Flex vertical gap={24} style={{ padding: '12px 8px 8px' }}>
        {/* Icon and Title Section */}
        <Flex vertical gap={16} align="center">
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: token.colorPrimaryBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TeamOutlined style={{ fontSize: 32, color: token.colorPrimary }} />
          </div>
          <Typography.Title level={3} style={{ margin: 0, textAlign: 'center' }}>
            {t('seatLimitReached', { defaultValue: 'Seat Limit Reached' })}
          </Typography.Title>
        </Flex>

        {/* Description Section */}
        <Flex vertical gap={16} style={{ textAlign: 'center' }}>
          <Typography.Paragraph style={{ fontSize: 15, margin: 0, lineHeight: 1.6 }}>
            {isAppSumoUser
              ? t('seatLimitAppSumoMessage', {
                  defaultValue: `Your AppSumo plan includes ${planLimit} members. Upgrade to Business for ${businessLimit} members, or deactivate an inactive member to invite someone new.`,
                  planLimit,
                  businessLimit,
                })
              : t('seatLimitMessage', {
                  defaultValue: `Your plan includes ${planLimit} members. Upgrade to Business for ${businessLimit} members, or deactivate an inactive member to invite someone new.`,
                  planLimit,
                  businessLimit,
                })}
          </Typography.Paragraph>

          {/* Seat Usage Stats */}
          <Flex
            justify="center"
            gap={24}
            style={{
              padding: '16px 24px',
              backgroundColor: token.colorBgLayout,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorder}`,
            }}
          >
            <Flex vertical align="center" gap={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('currentMembers', { defaultValue: 'Current Members' })}
              </Typography.Text>
              <Typography.Title level={4} style={{ margin: 0, color: token.colorError }}>
                {currentMembers}
              </Typography.Title>
            </Flex>
            <Divider type="vertical" style={{ height: 'auto', margin: 0 }} />
            <Flex vertical align="center" gap={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('planLimit', { defaultValue: 'Plan Limit' })}
              </Typography.Text>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {planLimit}
              </Typography.Title>
            </Flex>
            <Divider type="vertical" style={{ height: 'auto', margin: 0 }} />
            <Flex vertical align="center" gap={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('afterUpgrade', { defaultValue: 'After Upgrade' })}
              </Typography.Text>
              <Typography.Title level={4} style={{ margin: 0, color: token.colorSuccess }}>
                {businessLimit}
              </Typography.Title>
            </Flex>
          </Flex>
        </Flex>

        {/* Action Buttons */}
        <Flex vertical gap={16}>
          <Button type="primary" size="large" block onClick={onUpgrade}>
            {t('upgradeToBusiness', { defaultValue: 'Upgrade to Business' })}
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
};
