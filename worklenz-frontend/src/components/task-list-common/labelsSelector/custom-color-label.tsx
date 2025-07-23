import { Tag, Typography } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { ALPHA_CHANNEL } from '@/shared/constants';

const CustomColorLabel = ({ label }: { label: ITaskLabel | null }) => {
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
      <Typography.Text style={{ fontSize: 11, color: colors.darkGray }}>
        {label?.name}
      </Typography.Text>
    </Tag>
  );
};

export default CustomColorLabel;
