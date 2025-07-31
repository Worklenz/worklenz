import React, { useCallback, useMemo } from 'react';
import { Avatar, Tooltip } from './index';

interface Member {
  id?: string;
  team_member_id?: string;
  name?: string;
  names?: string[];
  avatar_url?: string;
  color_code?: string;
  end?: boolean;
}

interface AvatarGroupProps {
  members: Member[];
  maxCount?: number;
  size?: number | 'small' | 'default' | 'large';
  isDarkMode?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const AvatarGroup: React.FC<AvatarGroupProps> = ({
  members,
  maxCount,
  size = 28,
  isDarkMode = false,
  className = '',
  onClick,
}) => {
  const stopPropagation = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    },
    [onClick]
  );

  const renderAvatar = useCallback(
    (member: Member, index: number) => {
      const memberName = member.end && member.names ? member.names.join(', ') : member.name || '';
      const displayName =
        member.end && member.names ? member.name : member.name?.charAt(0).toUpperCase();

      return (
        <Tooltip
          key={member.team_member_id || member.id || index}
          title={memberName}
          isDarkMode={isDarkMode}
        >
          <Avatar
            name={member.name || ''}
            src={member.avatar_url}
            size={size}
            isDarkMode={isDarkMode}
            backgroundColor={member.color_code}
            onClick={stopPropagation}
            className="border-2 border-white"
            style={isDarkMode ? { borderColor: '#374151' } : {}}
          />
        </Tooltip>
      );
    },
    [stopPropagation, size, isDarkMode]
  );

  const visibleMembers = useMemo(() => {
    return maxCount ? members.slice(0, maxCount) : members;
  }, [members, maxCount]);

  const remainingCount = useMemo(() => {
    return maxCount ? Math.max(0, members.length - maxCount) : 0;
  }, [members.length, maxCount]);

  const avatarElements = useMemo(() => {
    return visibleMembers.map((member, index) => renderAvatar(member, index));
  }, [visibleMembers, renderAvatar]);

  const getSizeStyle = () => {
    if (typeof size === 'number') {
      return { width: size, height: size, fontSize: `${size * 0.4}px` };
    }

    const sizeMap = {
      small: { width: 24, height: 24, fontSize: '10px' },
      default: { width: 32, height: 32, fontSize: '14px' },
      large: { width: 48, height: 48, fontSize: '18px' },
    };

    return sizeMap[size];
  };

  return (
    <div onClick={stopPropagation} className={`flex -space-x-1 ${className}`}>
      {avatarElements}
      {remainingCount > 0 && (
        <Tooltip title={`${remainingCount} more`} isDarkMode={isDarkMode}>
          <div
            className={`rounded-full flex items-center justify-center text-white font-medium shadow-sm border-2 cursor-pointer ${
              isDarkMode ? 'bg-gray-600 border-gray-700' : 'bg-gray-400 border-white'
            }`}
            style={getSizeStyle()}
            onClick={stopPropagation}
          >
            +{remainingCount}
          </div>
        </Tooltip>
      )}
    </div>
  );
};

export default AvatarGroup;
