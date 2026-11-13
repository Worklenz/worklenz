import { Tooltip } from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import { isSoftwareProjectType } from '@/lib/project/software-project';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';

interface ProjectTypeCellProps {
  record: IProjectViewModel;
  t: TFunction;
}

export const ProjectTypeCell: React.FC<ProjectTypeCellProps> = ({ record, t }) => {
  const isSoftware = isSoftwareProjectType(record.project_type);
  const label = isSoftware
    ? t('projectTypeSoftware', { defaultValue: 'Software Project' })
    : t('projectTypeGeneral', { defaultValue: 'General Project' });
  const tooltip = isSoftware
    ? t('projectTypeSoftwareTooltip', {
        defaultValue: 'Software project — issues, backlog, and sprints',
      })
    : t('projectTypeGeneralTooltip', {
        defaultValue: 'General project — tasks, phases, and boards',
      });

  return (
    <Tooltip title={tooltip}>
      <span style={{ fontSize: 12 }}>{label}</span>
    </Tooltip>
  );
};
