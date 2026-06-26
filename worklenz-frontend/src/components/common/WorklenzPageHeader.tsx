import React from 'react';
import { Flex, Typography } from 'antd/es';

interface WorklenzPageHeaderProps {
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
  extra?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

const WorklenzPageHeader: React.FC<WorklenzPageHeaderProps> = ({
  title,
  subTitle,
  extra,
  style = { padding: '16px 0' },
  className,
}) => {
  return (
    <Flex className={className} align="center" justify="space-between" style={style}>
      <div>
        {title && (
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
        )}
        {subTitle && <div>{subTitle}</div>}
      </div>
      {extra && <div>{extra}</div>}
    </Flex>
  );
};

export default WorklenzPageHeader;
