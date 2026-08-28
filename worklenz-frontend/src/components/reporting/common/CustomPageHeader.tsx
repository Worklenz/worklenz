import React, { memo } from 'react';
import WorklenzPageHeader from '@/components/common/WorklenzPageHeader';

interface CustomPageHeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const CustomPageHeader: React.FC<CustomPageHeaderProps> = ({
  title,
  children,
  className = 'site-page-header',
  style = { padding: '16px 0' },
}) => {
  const mergedStyle: React.CSSProperties = { flexWrap: 'wrap', rowGap: 12, ...style };
  return (
    <WorklenzPageHeader className={className} title={title} style={mergedStyle} extra={children} />
  );
};

export default memo(CustomPageHeader);
