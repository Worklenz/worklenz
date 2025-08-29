import React from 'react';
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
}

const ProjectStatusIcon = React.forwardRef<HTMLSpanElement, ProjectStatusIconProps>(
  ({ iconName, color }, ref) => {
    const IconComponent = iconMap[iconName as keyof typeof iconMap];
    if (!IconComponent) return null;
    return (
      <span ref={ref} style={{ display: 'inline-block' }}>
        <IconComponent style={{ color: color }} />
      </span>
    );
  }
);

ProjectStatusIcon.displayName = 'ProjectStatusIcon';

export default ProjectStatusIcon;
