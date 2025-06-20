import { IProjectViewModel } from '@/types/project/project-view-model.types';
import { getTaskProgressTitle } from '@/utils/project-list-utils';
import { Tooltip, Progress } from '@/components/ui';

export const ProgressListProgress: React.FC<{ record: IProjectViewModel }> = ({ record }) => {
  return (
    <Tooltip title={getTaskProgressTitle(record)}>
      <Progress percent={record.progress} className="project-progress" />
    </Tooltip>
  );
};
