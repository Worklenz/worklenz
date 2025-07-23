import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { getTaskProgressTitle } from '@/utils/project-list-utils';
import { Tooltip, Progress } from '@/shared/antd-imports';

export const ProgressListProgress: React.FC<{ record: IProjectViewModel }> = ({ record }) => {
  return (
    <Tooltip title={getTaskProgressTitle(record)}>
      <Progress percent={record.progress} className="project-progress" />
    </Tooltip>
  );
};
