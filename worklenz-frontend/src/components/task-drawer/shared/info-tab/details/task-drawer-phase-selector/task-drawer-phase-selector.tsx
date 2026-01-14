import { useSocket } from '@/socket/socketContext';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { Select } from '@/shared/antd-imports';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useEffect, useState } from 'react';

interface TaskDrawerPhaseSelectorProps {
  phases: ITaskPhase[];
  task: ITaskViewModel;
}

const TaskDrawerPhaseSelector = ({ phases, task }: TaskDrawerPhaseSelectorProps) => {
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  
  // Use controlled state for the selected phase
  const [selectedPhase, setSelectedPhase] = useState<string | undefined>(task?.phase_id);

  // Sync local state when task.phase_id changes from external updates
  useEffect(() => {
    setSelectedPhase(task?.phase_id);
  }, [task?.phase_id]);

  const phaseMenuItems = phases?.map(phase => ({
    key: phase.id,
    value: phase.id,
    label: phase.name,
  }));

  const handlePhaseChange = (value: string | null) => {
    // Update local state immediately for UI responsiveness
    setSelectedPhase(value || undefined);
    
    socket?.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
      task_id: task.id,
      phase_id: value,
      parent_task: task.parent_task_id || null,
    });
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
        Phase
      </label>
      <Select
        allowClear
        placeholder="Select Phase"
        value={selectedPhase}
        options={phaseMenuItems}
        style={{ width: '100%' }}
        onChange={handlePhaseChange}
      />
    </div>
  );
};

export default TaskDrawerPhaseSelector;