import { Tag, Typography } from '@/shared/antd-imports';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { ALPHA_CHANNEL } from '@/shared/constants';

const CustomColorLabel = ({ label }: { label: ITaskLabel | null }) => {
  const getContrastColor = (hexColor: string): string => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
  };

  const textColor = getContrastColor(label?.color_code || '#000000');

  return (
    <Tag
      key={label?.id}
      color={label?.color_code + ALPHA_CHANNEL}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyItems: 'center',
        height: 18,
        width: 'fit-content',
        fontSize: 11,
      }}
    >
      <Typography.Text
        style={{
          fontSize: 11,
          color: textColor,
        }}
      >
        {label?.name}
      </Typography.Text>
    </Tag>
  );
};

export default CustomColorLabel;