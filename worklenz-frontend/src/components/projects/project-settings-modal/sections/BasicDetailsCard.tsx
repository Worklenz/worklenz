import { Form, FormInstance, Input } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import ProjectBasicInfo from '../../project-drawer/project-basic-info/project-basic-info';
import ProjectHealthSection from '../../project-drawer/project-health-section/project-health-section';
import ProjectStatusSection from '../../project-drawer/project-status-section/project-status-section';
import ProjectCategorySection from '../../project-drawer/project-category-section/project-category-section';
import ProjectPrioritySection from '../../project-drawer/project-priority-section/project-priority-section';
import SettingsCard from '../components/settings-card';
import DeliveryConfidenceSettingsSection from './delivery-confidence-settings-section';

interface BasicDetailsCardProps {
  form: FormInstance;
  project: IProjectViewModel | null;
  projectId: string | null;
  editMode: boolean;
  disabled: boolean;
  isFree: boolean;
}

const BasicDetailsCard = ({
  form,
  project,
  projectId,
  editMode,
  disabled,
  isFree,
}: BasicDetailsCardProps) => {
  const { t } = useTranslation('project-drawer');
  const { projectStatuses } = useAppSelector(state => state.projectStatusesReducer);
  const { projectHealths } = useAppSelector(state => state.projectHealthReducer);
  const { priorities } = useAppSelector(state => state.projectPriorityReducer);

  return (
    <SettingsCard title={t('basicDetailsCardTitle', { defaultValue: 'Basic Details' })}>
      <ProjectBasicInfo editMode={editMode} project={project} form={form} disabled={disabled} />
      <ProjectStatusSection statuses={projectStatuses} form={form} t={t} disabled={disabled} />
      <ProjectHealthSection
        healths={projectHealths}
        form={form}
        t={t}
        disabled={isFree || disabled}
      />
      {editMode && projectId ? (
        <DeliveryConfidenceSettingsSection form={form} t={t} disabled={disabled} />
      ) : null}
      <ProjectCategorySection form={form} t={t} disabled={isFree || disabled} />
      <ProjectPrioritySection priorities={priorities} form={form} t={t} disabled={disabled} />

      <Form.Item name="notes" label={t('notes')}>
        <Input.TextArea
          placeholder={t('enterNotes')}
          disabled={disabled}
          maxLength={500}
          showCount
        />
      </Form.Item>
    </SettingsCard>
  );
};

export default BasicDetailsCard;
