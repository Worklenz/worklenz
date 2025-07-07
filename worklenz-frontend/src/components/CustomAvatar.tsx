import React from 'react';
import Tooltip from 'antd/es/tooltip';
import Avatar from 'antd/es/avatar';

import { AvatarNamesMap } from '../shared/constants';

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
