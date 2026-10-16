import { Badge } from '@/shared/antd-imports';

interface PortalProjectNameProps {
  name: string;
  /** The project's colour (`color_code`); falls back to the primary blue the projects list uses. */
  color?: string | null;
  fontSize?: number;
  fontWeight?: number;
}

const FALLBACK_PROJECT_COLOR = '#4096ff';

/** A project name led by its colour dot, matching the name cell of the workspace projects list. */
export const PortalProjectName = ({ name, color, fontSize = 12.5, fontWeight }: PortalProjectNameProps) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0, maxWidth: '100%' }}>
    <Badge color={color || FALLBACK_PROJECT_COLOR} style={{ marginInlineEnd: 8 }} />
    <span
      title={name}
      style={{ fontSize, fontWeight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
    >
      {name}
    </span>
  </span>
);
