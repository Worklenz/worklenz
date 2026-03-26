import React from 'react';
import { Tag } from 'antd';
import { getStatusConfig } from './status-labels';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = getStatusConfig(status);

  return (
    <Tag
      style={{
        color: config.color,
        background: config.bgColor,
        border: `1px solid ${config.color}20`,
        borderRadius: 4,
        fontWeight: 500,
        fontSize: 12,
      }}
    >
      {config.label}
    </Tag>
  );
};

export default StatusBadge;
