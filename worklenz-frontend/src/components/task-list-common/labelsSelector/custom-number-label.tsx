import { Tag, Tooltip } from '@/shared/antd-imports';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';

const CustomNumberLabel = ({ labelList }: { labelList: ITaskLabel[] | null }) => {
  const list = labelList?.slice(2);

  const labelNamesStirng = list?.map(label => label.names).join(', ');

  return (
    <Tooltip title={labelNamesStirng}>
      <Tag
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyItems: 'center',
          height: 18,
          fontSize: 11,
        }}
      >
        +{list?.length}
      </Tag>
    </Tooltip>
  );
};

export default CustomNumberLabel;
