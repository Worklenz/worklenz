import { ITaskFormViewModel } from '@/types/tasks/task.types';
import { Tag } from '@/shared/antd-imports';

import { Form } from '@/shared/antd-imports';

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
