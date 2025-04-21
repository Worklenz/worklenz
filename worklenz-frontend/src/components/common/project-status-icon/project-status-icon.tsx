import Icon, {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';

const iconMap = {
  'clock-circle': ClockCircleOutlined,
  'close-circle': CloseCircleOutlined,
  stop: StopOutlined,
  'check-circle': CheckCircleOutlined,
};

const ProjectStatusIcon = ({ iconName, color }: { iconName: string; color: string }) => {
  const IconComponent = iconMap[iconName as keyof typeof iconMap];
  if (!IconComponent) return null;
  return <IconComponent style={{ color: color }} />;
};

export default ProjectStatusIcon;
