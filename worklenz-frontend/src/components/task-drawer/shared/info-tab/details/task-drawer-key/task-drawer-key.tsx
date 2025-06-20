import { ITaskFormViewModel } from '@/types/tasks/task.types';
import { Tag } from '@/components/ui';

import { Form } from '@/components/ui';

interface TaskDrawerKeyProps {
  taskKey: string;
  label: string;
}

const TaskDrawerKey = ({ taskKey, label }: TaskDrawerKeyProps) => {
  return (
    <Form.Item name="taskId" label={label}>
      <Tag>{taskKey}</Tag>
    </Form.Item>
  );
};

export default TaskDrawerKey;
