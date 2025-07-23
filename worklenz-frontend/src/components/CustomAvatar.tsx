import React from 'react';
import { AvatarNamesMap } from '../shared/constants';
import { Avatar, Tooltip } from '@/shared/antd-imports';

interface CustomAvatarProps {
  avatarName: string;
  size?: number;
}

const CustomAvatar = React.forwardRef<HTMLDivElement, CustomAvatarProps>(
  ({ avatarName, size = 32 }, ref) => {
    const avatarCharacter = avatarName[0].toUpperCase();

    return (
      <Tooltip title={avatarName}>
        <div ref={ref} style={{ display: 'inline-block' }}>
          <Avatar
            style={{
              backgroundColor: AvatarNamesMap[avatarCharacter],
              verticalAlign: 'middle',
              width: size,
              height: size,
            }}
          >
            {avatarCharacter}
          </Avatar>
        </div>
      </Tooltip>
    );
  }
);

CustomAvatar.displayName = 'CustomAvatar';

export default CustomAvatar;
