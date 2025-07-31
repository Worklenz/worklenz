import { Flex, Tooltip, Typography } from 'antd';
import { colors } from '../styles/colors';
import { ExclamationCircleOutlined } from '@ant-design/icons';

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
