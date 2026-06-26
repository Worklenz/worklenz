import React from 'react';
import { Avatar, Tooltip } from '@/shared/antd-imports';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';

interface AvatarsProps {
  members: InlineMember[];
  maxCount?: number;
  allowClickThrough?: boolean;
}

const renderAvatar = (member: InlineMember, index: number, allowClickThrough: boolean = false) => (
  <Tooltip
    key={member.team_member_id || index}
    title={member.end && member.names ? member.names.join(', ') : member.name}
  >
    {member.avatar_url ? (
      <span onClick={allowClickThrough ? undefined : (e: React.MouseEvent) => e.stopPropagation()}>
        <Avatar src={member.avatar_url} size={28} key={member.team_member_id || index} />
      </span>
    ) : (
      <span onClick={allowClickThrough ? undefined : (e: React.MouseEvent) => e.stopPropagation()}>
        <Avatar
          size={28}
          key={member.team_member_id || index}
          style={{
            backgroundColor: member.color_code || '#ececec',
            fontSize: '14px',
          }}
        >
          {member.end && member.names ? member.name : member.name?.charAt(0).toUpperCase()}
        </Avatar>
      </span>
    )}
  </Tooltip>
);

const Avatars: React.FC<AvatarsProps> = React.memo(
  ({ members, maxCount, allowClickThrough = false }) => {
    const visibleMembers = maxCount ? members.slice(0, maxCount) : members;
    return (
      <div onClick={allowClickThrough ? undefined : (e: React.MouseEvent) => e.stopPropagation()}>
        <Avatar.Group>
          {visibleMembers.map((member, index) => renderAvatar(member, index, allowClickThrough))}
        </Avatar.Group>
      </div>
    );
  }
);

Avatars.displayName = 'Avatars';

export default Avatars;
