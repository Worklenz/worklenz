import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { ITaskViewModel } from '@/types/tasks/task.types';
import logger from '@/utils/errorLogger';
import { Switch, Tooltip, Button, Popover, Flex, Typography } from '@/shared/antd-imports';
import { CrownOutlined } from '@ant-design/icons';
import { useAuthService } from '@/hooks/useAuth';
import { shouldRestrictBillableFeature } from '@/ee/utils/subscription-utils';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useEffect, useState } from 'react';
import { useAppSumoTracking } from '@/ee/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';

interface TaskDrawerBillableProps {
  task?: ITaskViewModel | null;
  disabled?: boolean;
}

const TaskDrawerBillable = ({ task = null, disabled = false }: TaskDrawerBillableProps) => {
  const { socket, connected } = useSocket();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  const isRestricted = shouldRestrictBillableFeature(currentSession);
  const [isSpendPopoverOpen, setIsSpendPopoverOpen] = useState(false);
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');

  // Read billable status directly from Redux to ensure real-time updates
  const billableFromRedux = useAppSelector(
    state => state.taskDrawerReducer?.taskFormViewModel?.task?.billable
  );

  // Use local state to track the billable value for immediate UI feedback
  const [localBillable, setLocalBillable] = useState<boolean>(false);

  // Sync local state with Redux or prop value
  useEffect(() => {
    const billableValue = billableFromRedux !== undefined ? billableFromRedux : task?.billable;
    if (billableValue !== undefined) {
      setLocalBillable(billableValue);
    }
  }, [billableFromRedux, task?.billable]);

  const handleBillableChange = (checked: boolean) => {
    if (isRestricted) {
      dispatch(toggleUpgradeModal());
      return;
    }

    if (!connected) return;

    // Optimistically update local state for immediate UI feedback
    setLocalBillable(checked);

    try {
      socket?.emit(SocketEvents.TASK_BILLABLE_CHANGE.toString(), {
        task_id: task?.id,
        billable: checked,
      });
    } catch (error) {
      logger.error('Error updating billable status', error);
      // Revert on error
      setLocalBillable(!checked);
    }
  };

  if (isRestricted) {
    return (
      <Flex gap={8} align="center">
        <Tooltip title={t('upgrade-plan')} placement="top">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            onClick={() => dispatch(toggleUpgradeModal())}
          >
            <Switch defaultChecked={false} disabled />
            <CrownOutlined style={{ fontSize: '14px', color: '#faad14' }} />
          </div>
        </Tooltip>
        <Popover
          trigger="click"
          placement="bottomLeft"
          open={isSpendPopoverOpen}
          onOpenChange={open => {
            setIsSpendPopoverOpen(open);
            if (isAppSumoUser) {
              if (open) {
                trackAppSumoEvent(AppSumoUpsellEvents.PROJECT_FINANCE_GATED_CLICK, { feature: 'project_finance' });
                trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN, { feature: 'project_finance' });
              } else {
                trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_PROMPT_DISMISSED, { feature: 'project_finance' });
              }
            }
          }}
          title={
            <Flex align="center" justify="space-between" style={{ width: 240 }}>
              <Typography.Text strong>
                {t('projectFinanceTitle', { defaultValue: t('projectFinanceTitle') })}
              </Typography.Text>
              <Button
                type="text"
                size="small"
                aria-label={t('closePopover', { defaultValue: t('closePopover') })}
                onClick={event => {
                  event.stopPropagation();
                  setIsSpendPopoverOpen(false);
                }}
              >
                ×
              </Button>
            </Flex>
          }
          content={
            <Flex vertical gap={12} style={{ maxWidth: 280 }}>
              <Typography.Text>
                {t('projectFinanceUpgradeBody', {
                  defaultValue:
                    t('projectFinanceUpgradeBody'),
                })}
              </Typography.Text>
              <Button
                type="primary"
                onClick={() => {
                  setIsSpendPopoverOpen(false);
                  if (isAppSumoUser) {
                    trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_NOW_CLICKED, { feature: 'project_finance' });
                  }
                  dispatch(toggleUpgradeModal());
                }}
              >
                {t('upgrade-now', { defaultValue: "Upgrade Now" })}
              </Button>
            </Flex>
          }
        >
          <Button size="small" type="default">
            {t('seeSpends', { defaultValue: t('seeSpends') })}
          </Button>
        </Popover>
      </Flex>
    );
  }

  return (
    <Flex gap={8} align="center">
      <Switch checked={localBillable} onChange={handleBillableChange} disabled={disabled} />
    </Flex>
  );
};

export default TaskDrawerBillable;
