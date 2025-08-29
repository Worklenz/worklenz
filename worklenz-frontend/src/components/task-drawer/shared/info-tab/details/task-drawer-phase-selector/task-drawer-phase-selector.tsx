import { useSocket } from '@/socket/socketContext';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { Select } from '@/shared/antd-imports';

import { Form } from '@/shared/antd-imports';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskViewModel } from '@/types/tasks/task.types';

interface TaskDrawerPhaseSelectorProps {
  phases: ITaskPhase[];
  task: ITaskViewModel;
}

const TaskDrawerPhaseSelector = ({ phases, task }: TaskDrawerPhaseSelectorProps) => {
  const { socket, connected } = useSocket();

  const phaseMenuItems = phases?.map(phase => ({
    key: phase.id,
    value: phase.id,
    label: phase.name,
  }));

  const handlePhaseChange = (value: string) => {
    socket?.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
      task_id: task.id,
      phase_id: value,
      parent_task: task.parent_task_id || null,
    });
  };

  return (
    <Form.Item name="phase" label="Phase">
      <Select
        allowClear
        placeholder="Select Phase"
        options={phaseMenuItems}
        styles={{
          root: {
            width: 'fit-content',
          },
        }}
        onChange={handlePhaseChange}
      />
    </Form.Item>
  );
};

export default TaskDrawerPhaseSelector;
