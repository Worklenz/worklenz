import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { ITaskViewModel } from '@/types/tasks/task.types';
import logger from '@/utils/errorLogger';
import { Switch } from '@/shared/antd-imports';

interface TaskDrawerBillableProps {
  task?: ITaskViewModel | null;
}

const TaskDrawerBillable = ({ task = null }: TaskDrawerBillableProps) => {
  const { socket, connected } = useSocket();

  const handleBillableChange = (checked: boolean) => {
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

  return <Switch defaultChecked={task?.billable} onChange={handleBillableChange} />;
};

export default TaskDrawerBillable;
