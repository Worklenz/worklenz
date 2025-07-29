import { ColorPicker, Form, FormInstance, Input } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { IProjectViewModel } from '@/types/project/projectViewModel.types';

interface ProjectBasicInfoProps {
  editMode: boolean;
  project: IProjectViewModel | null;
  form: FormInstance;
  disabled: boolean;
}

const ProjectBasicInfo = ({ editMode, project, form, disabled }: ProjectBasicInfoProps) => {
  const { t } = useTranslation('project-drawer');

  const defaultColorCode = '#154c9b';

  return (
    <>
      <Form.Item
        name="name"
        label={t('name')}
        rules={[{ required: true, message: t('pleaseEnterAName') }]}
      >
        <Input placeholder={t('enterProjectName')} disabled={disabled} />
      </Form.Item>

      {editMode && (
        <Form.Item name="key" label={t('key')}>
          <Input placeholder={t('enterProjectKey')} value={project?.key} disabled={disabled} />
        </Form.Item>
      )}

      <Form.Item name="color_code" label={t('projectColor')} layout="horizontal" required>
        <ColorPicker
          value={project?.color_code || defaultColorCode}
          onChange={value => form.setFieldValue('color_code', value.toHexString())}
          disabled={disabled}
        />
      </Form.Item>
    </>
  );
};

export default ProjectBasicInfo;
