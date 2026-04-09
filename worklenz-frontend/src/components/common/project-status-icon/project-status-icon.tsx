import React from 'react';
import { Flex, Typography } from '@/shared/antd-imports';
import Icon, {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
} from '@/shared/antd-imports';

const iconMap = {
  'clock-circle': ClockCircleOutlined,
  'close-circle': CloseCircleOutlined,
  stop: StopOutlined,
  'check-circle': CheckCircleOutlined,
};

interface ProjectStatusIconProps {
  iconName: string;
  color: string;
  statusName?: string; // Optional prop to display status name
  showName?: boolean; // Optional prop to control whether to show name
}

const ProjectStatusIcon = React.forwardRef<HTMLSpanElement, ProjectStatusIconProps>(
  ({ iconName, color, statusName, showName = false }, ref) => {
    const IconComponent = iconMap[iconName as keyof typeof iconMap];
    if (!IconComponent) return null;

    // If showName is true and statusName is provided, display both icon and name
    if (showName && statusName) {
      return (
        <span ref={ref} style={{ display: 'inline-block' }}>
          <Flex align="center" gap={6}>
            <IconComponent style={{ color: color, fontSize: 14 }} />
            <Typography.Text style={{ fontSize: 13, color: color, fontWeight: 500 }}>
              {statusName}
            </Typography.Text>
          </Flex>
        </span>
      );
    }

    // Default behavior: show only icon
    return (
      <span ref={ref} style={{ display: 'inline-block' }}>
        <IconComponent style={{ color: color }} />
      </span>
    );
  }
);

ProjectStatusIcon.displayName = 'ProjectStatusIcon';

export default ProjectStatusIcon;
