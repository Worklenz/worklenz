import { Tag, Tooltip } from 'antd';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';

interface ICustomColordLabelProps {
  label: ITaskLabel | null;
}

const CustomColordLabel = ({ label }: ICustomColordLabelProps) => {
  if (!label) return null;

  return (
    <Tooltip title={label.name}>
      <Tag
        key={label.id}
        color={label.color_code}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 18,
          width: 'fit-content',
          fontSize: 11,
        }}
      >
        {label.name && label.name.length > 10 ? `${label.name.substring(0, 10)}...` : label.name}
      </Tag>
    </Tooltip>
  );
};

export default CustomColordLabel;
