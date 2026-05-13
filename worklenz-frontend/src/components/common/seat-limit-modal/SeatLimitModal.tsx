import { Button, Flex, Modal, Typography } from '@/shared/antd-imports';
import { TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

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

  return (
    <Modal
      open={open}
      onCancel={onClose}
      closable={true}
      maskClosable={false} // Cannot dismiss by clicking outside
      keyboard={false} // Cannot dismiss with Escape
      footer={null}
      width={500}
      centered
    >
      <Flex vertical gap={20} style={{ padding: '8px 0' }}>
        {/* Icon */}
        <Flex justify="center">
          <TeamOutlined style={{ fontSize: 48, color: '#1890ff' }} />
        </Flex>

        {/* Title */}
        <Typography.Title level={4} style={{ textAlign: 'center', margin: 0 }}>
          {t('seatLimitReached', { defaultValue: 'Seat Limit Reached' })}
        </Typography.Title>

        {/* Description */}
        <Flex vertical gap={12}>
          <Typography.Text style={{ fontSize: 15 }}>
            {isAppSumoUser
              ? t('seatLimitAppSumoMessage', {
                  defaultValue: `Your AppSumo plan includes ${planLimit} members.`,
                  planLimit,
                })
              : t('seatLimitMessage', {
                  defaultValue: `Your plan includes ${planLimit} members.`,
                  planLimit,
                })}
          </Typography.Text>
          <Typography.Text style={{ fontSize: 15 }}>
            {t('seatLimitCurrentUsage', {
              defaultValue: `You are currently using ${currentMembers} of ${planLimit} seats.`,
              currentMembers,
              planLimit,
            })}
          </Typography.Text>
          <Typography.Text style={{ fontSize: 15 }}>
            {t('seatLimitOptions', {
              defaultValue: 'To invite a new member, you can:',
            })}
          </Typography.Text>
        </Flex>

        {/* Action Buttons */}
        <Flex gap={12} justify="center">
          <Button size="large" onClick={onDeactivate}>
            {t('deactivateMember', { defaultValue: 'Deactivate a Member' })}
          </Button>
          <Button type="primary" size="large" onClick={onUpgrade}>
            {t('upgradeToBusiness', { defaultValue: 'Upgrade to Business' })}
          </Button>
        </Flex>

        {/* Footer Info */}
        <Typography.Text
          type="secondary"
          style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}
        >
          {t('seatLimitFooter', {
            defaultValue: `Current members: ${currentMembers} | Plan limit: ${planLimit} | After upgrade: ${businessLimit}`,
            currentMembers,
            planLimit,
            businessLimit,
          })}
        </Typography.Text>
      </Flex>
    </Modal>
  );
};
