import { Form, FormInstance, Select, Typography } from '@/shared/antd-imports';
import { TFunction } from 'i18next';

import { IProjectStatus } from '@/types/project/projectStatus.types';

import { getStatusIcon } from '@/utils/projectUtils';

interface ProjectStatusSectionProps {
  statuses: IProjectStatus[];
  form: FormInstance;
  t: TFunction;
  disabled: boolean;
}

const ProjectStatusSection = ({ statuses, form, t, disabled }: ProjectStatusSectionProps) => {
  const statusOptions = statuses.map((status, index) => ({
    key: index,
    value: status.id,
    label: (
      <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {status.icon && status.color_code && getStatusIcon(status.icon, status.color_code)}
        {status.name}
      </Typography.Text>
    ),
  }));

  return (
    <Form.Item name="status_id" label={t('status')}>
      <Select
        options={statusOptions}
        onChange={value => form.setFieldValue('status_id', value)}
        placeholder={t('selectStatus')}
        disabled={disabled}
      />
    </Form.Item>
  );
};

export default ProjectStatusSection;
