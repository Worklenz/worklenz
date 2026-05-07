import { Form, FormInstance, Select, Typography } from '@/shared/antd-imports';
import { TFunction } from 'i18next';

import { ITaskPrioritiesGetResponse } from '@/types/tasks/taskPriority.types';

interface ProjectPrioritySectionProps {
  priorities: ITaskPrioritiesGetResponse[];
  form: FormInstance;
  t: TFunction;
  disabled: boolean;
}

const ProjectPrioritySection = ({ priorities, form, t, disabled }: ProjectPrioritySectionProps) => {
  const priorityOptions = priorities.map((priority, index) => ({
    key: index,
    value: priority.id,
    label: (
      <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {priority.name}
      </Typography.Text>
    ),
  }));

  return (
    <Form.Item name="priority_id" label={t('priority')}>
      <Select
        options={priorityOptions}
        onChange={value => form.setFieldValue('priority_id', value)}
        placeholder={t('selectPriority')}
        disabled={disabled}
      />
    </Form.Item>
  );
};

export default ProjectPrioritySection;