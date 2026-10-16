import { Typography, theme } from '@/shared/antd-imports';

interface ProjectNameProps {
  name: string;
  color?: string | null;
}

/** A project's name with its colour dot. Falls back to a neutral dot when the project has no colour. */
export const ProjectName = ({ name, color }: ProjectNameProps) => {
  const { token } = theme.useToken();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: token.marginXS, minWidth: 0 }}>
      <span
        aria-hidden
        style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: color || token.colorTextQuaternary }}
      />
      <Typography.Text strong ellipsis style={{ minWidth: 0 }}>
        {name}
      </Typography.Text>
    </span>
  );
};
