import { ITaskFormViewModel } from '@/types/tasks/task.types';
import { Tag } from 'antd';

import { Form } from 'antd';

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
