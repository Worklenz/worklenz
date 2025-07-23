import { Tag, Tooltip } from '@/shared/antd-imports';

interface ICustomNumberLabelProps {
  labelList: string[];
  namesString: string;
}

const CustomNumberLabel = ({ labelList, namesString }: ICustomNumberLabelProps) => {
  return (
    <Tooltip title={labelList.join(', ')}>
      <Tag
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyItems: 'center',
          height: 18,
          fontSize: 11,
        }}
      >
        {namesString}
      </Tag>
    </Tooltip>
  );
};

export default CustomNumberLabel;
