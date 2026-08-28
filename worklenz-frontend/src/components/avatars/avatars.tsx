import React from 'react';
import { Avatar, Tooltip } from '@/shared/antd-imports';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';

interface AvatarsProps {
  members: InlineMember[];
  maxCount?: number;
  allowClickThrough?: boolean;
}

const getDisplayName = (member: InlineMember) =>
  member.end && member.names ? member.names.join(', ') : member.name;

const renderAvatar = (member: InlineMember, index: number, allowClickThrough: boolean = false) => (
  <span key={member.team_member_id || index} onClick={allowClickThrough ? undefined : (e: React.MouseEvent) => e.stopPropagation()}>
    <Tooltip title={getDisplayName(member)}>
      {member.avatar_url ? (
        <Avatar src={member.avatar_url} size={28} />
      ) : (
        <Avatar
          size={28}
          style={{
            backgroundColor: member.color_code || '#ececec',
            fontSize: '14px',
          }}
        >
          {member.end && member.names ? member.name : member.name?.charAt(0).toUpperCase()}
        </Avatar>
      )}
    </Tooltip>
  </span>
);

const HiddenMembersList = ({ members }: { members: InlineMember[] }) => (
  <div style={{ padding: '8px 0', maxWidth: 300 }}>
    <span style={{ fontSize: '13px', lineHeight: '1.5', wordWrap: 'break-word' }}>
      {members.map((member, index) => (
        <span key={member.team_member_id || index}>
          {getDisplayName(member)}
          {index < members.length - 1 && ', '}
        </span>
      ))}
    </span>
  </div>
);

const Avatars: React.FC<AvatarsProps> = React.memo(
  ({ members, maxCount, allowClickThrough = false }) => {
    // Filter out members with null or empty names
    const validMembers = (members || []).filter(member => member.name && member.name.trim());
    
    const displayMembers = maxCount ? validMembers.slice(0, maxCount) : validMembers;
    const hiddenMembers = maxCount ? validMembers.slice(maxCount) : [];
    const hasOverflow = maxCount && validMembers.length > maxCount;

    return (
      <div
        onClick={allowClickThrough ? undefined : (e: React.MouseEvent) => e.stopPropagation()}
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        <Avatar.Group>
          {displayMembers.map((member, index) => renderAvatar(member, index, allowClickThrough))}
          {hasOverflow && (
            <Tooltip
              title={<HiddenMembersList members={hiddenMembers} />}
              overlayClassName="avatar-overflow-tooltip"
            >
              <Avatar
                style={{
                  backgroundColor: '#fde3cf',
                  color: '#f56a00',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                size={28}
              >
                +{hiddenMembers.length}
              </Avatar>
            </Tooltip>
          )}
        </Avatar.Group>
      </div>
    );
  }
);

Avatars.displayName = 'Avatars';

export default Avatars;