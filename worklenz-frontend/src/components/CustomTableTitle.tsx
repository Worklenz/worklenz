import { Flex, Tooltip, Typography } from '@/shared/antd-imports';
import { colors } from '../styles/colors';
import { ExclamationCircleOutlined } from '@/shared/antd-imports';

// this custom table title used when the typography font weigh 500 needed
const CustomTableTitle = ({ title, tooltip }: { title: string; tooltip?: string | null }) => {
  return (
    <Flex gap={8} align="center">
      <Typography.Text style={{ fontWeight: 500, textAlign: 'center' }}>{title}</Typography.Text>
      {tooltip && (
        <Tooltip title={tooltip} trigger={'hover'}>
          <ExclamationCircleOutlined style={{ color: colors.skyBlue }} />
        </Tooltip>
      )}
    </Flex>
  );
};

export default CustomTableTitle;
