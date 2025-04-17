import { PageHeader } from '@ant-design/pro-components';
import React, { memo } from 'react';

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
  return <PageHeader className={className} title={title} style={style} extra={children} />;
};

export default memo(CustomPageHeader);
