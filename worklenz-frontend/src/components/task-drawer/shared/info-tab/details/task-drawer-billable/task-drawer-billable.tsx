import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { ITaskViewModel } from '@/types/tasks/task.types';
import logger from '@/utils/errorLogger';
import { Switch, Tooltip } from '@/shared/antd-imports';
import { CrownOutlined } from '@ant-design/icons';
import { useAuthService } from '@/hooks/useAuth';
import { shouldRestrictProjectHealth } from '@/utils/subscription-utils';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';

interface TaskDrawerBillableProps {
  task?: ITaskViewModel | null;
}

const TaskDrawerBillable = ({ task = null }: TaskDrawerBillableProps) => {
  const { socket, connected } = useSocket();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  const isRestricted = shouldRestrictProjectHealth(currentSession);

  const handleBillableChange = (checked: boolean) => {
    if (isRestricted) {
      dispatch(toggleUpgradeModal());
      return;
    }

    if (!connected) return;

    try {
      socket?.emit(SocketEvents.TASK_BILLABLE_CHANGE.toString(), {
        task_id: task?.id,
        billable: checked,
      });
    } catch (error) {
      logger.error('Error updating billable status', error);
    }
  };

  if (isRestricted) {
    return (
      <Tooltip title={t('upgrade-plan')} placement="top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => dispatch(toggleUpgradeModal())}>
          <Switch defaultChecked={false} disabled />
          <CrownOutlined style={{ fontSize: '14px', color: '#faad14' }} />
        </div>
      </Tooltip>
    );
  }

  return <Switch defaultChecked={task?.billable} onChange={handleBillableChange} />;
};

export default TaskDrawerBillable;
