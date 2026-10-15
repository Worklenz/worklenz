import React from 'react';
import { Avatar } from '@/shared/antd-imports';
import { AvatarNamesMap } from '@/shared/constants';

interface PortalAvatarProps {
  name: string;
  /** Optional colour assigned to a staff member by the server (the task list's `color_code`). */
  color?: string;
  /** Defaults to 28, the size of the task list assignee avatars. */
  size?: number;
  shape?: 'circle' | 'square';
}

const FALLBACK_COLOR = '#ececec';

interface PortalPersonProps {
  name?: string | null;
  color?: string;
}

/** Avatar followed by the person's name, for table cells. Shows a dash when nobody is set. */
export const PortalPerson = ({ name, color }: PortalPersonProps) =>
  name ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <PortalAvatar name={name} color={color} />
      <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
    </span>
  ) : (
    <span>{'—'}</span>
  );

/**
 * Same avatar as the task list assignees: the first letter of the name, uppercased, on the
 * colour mapped to that letter (or the member's own colour when the server sent one).
 */
export const PortalAvatar = ({ name, color, size = 28, shape = 'circle' }: PortalAvatarProps) => {
  const letter = name.trim().charAt(0).toUpperCase();

  return (
    <Avatar
      size={size}
      shape={shape}
      style={{
        backgroundColor: color || AvatarNamesMap[letter] || FALLBACK_COLOR,
        flexShrink: 0,
        fontSize: size >= 28 ? 14 : Math.round(size * 0.5),
      }}
      aria-hidden
    >
      {letter || '?'}
    </Avatar>
  );
};
