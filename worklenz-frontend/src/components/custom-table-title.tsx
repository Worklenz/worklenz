import React, { useMemo } from 'react';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Flex } from '@/components/ui/layout';
import { Tooltip } from '@/components/ui/feedback';
import { Typography } from '@/components/ui/display';
import { colors } from '../styles/colors';

interface CustomTableTitleProps {
  title: string;
  tooltip?: string | null;
}

// this custom table title used when the typography font weight 500 needed
const CustomTableTitle: React.FC<CustomTableTitleProps> = React.memo(({ title, tooltip }) => {
  // Memoize styles to prevent recreation
  const textStyles = useMemo(() => ({
    fontWeight: 500,
    textAlign: 'center' as const,
  }), []);

  const iconStyles = useMemo(() => ({
    color: colors.skyBlue,
  }), []);

  return (
    <Flex gap={8} align="center">
      <Typography.Text style={textStyles}>{title}</Typography.Text>
      {tooltip && (
        <Tooltip title={tooltip} trigger="hover">
          <ExclamationCircleOutlined style={iconStyles} />
        </Tooltip>
      )}
    </Flex>
  );
});

CustomTableTitle.displayName = 'CustomTableTitle';

export default CustomTableTitle;
