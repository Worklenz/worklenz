import React from 'react';
import AvatarGroup from '@/components/AvatarGroup';
import { ITimeLogMember } from '@/api/tasks/task-time-logs.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';

interface TimeEntryMemberAvatarsProps {
  members: ITimeLogMember[];
}

/**
 * The Member column's cell: avatars only, no names, exactly like the Assignee
 * column in Home > My Tasks — same AvatarGroup, same size, and the same
 * name-derived colours (stamped server-side). A row with several members (the
 * "By task" view, when more than one person logged on the task) shows them
 * overlapping, capped at three plus a "+N" chip; hovering an avatar shows the
 * person's name.
 */
export const TimeEntryMemberAvatars: React.FC<TimeEntryMemberAvatarsProps> = ({ members }) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  // Names are user data, not UI copy — the avatars alone carry no text for
  // screen readers, so expose them as the group's accessible name.
  const names = members
    .map(member => member.user_name)
    .filter(Boolean)
    .join(', ');

  return (
    <span role="group" aria-label={names || undefined} style={{ display: 'inline-flex' }}>
      <AvatarGroup
        members={members.map(member => ({
          team_member_id: member.user_id,
          name: member.user_name ?? '',
          avatar_url: member.avatar_url || undefined,
          color_code: member.color_code || undefined,
        }))}
        maxCount={3}
        size={26}
        isDarkMode={themeMode === 'dark'}
      />
    </span>
  );
};
