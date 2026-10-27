
import React from 'react';
import { AvatarNamesMap } from '../shared/constants';
import { Avatar, Tooltip } from '@/shared/antd-imports';

interface CustomAvatarProps {
  avatarName: string;
  size?: number;
  avatarUrl?: string;
  fallbackUrl?: string;
}

const CustomAvatar = React.forwardRef<HTMLDivElement, CustomAvatarProps>(
  ({ avatarName, size = 35, avatarUrl, fallbackUrl }, ref) => {
    const avatarCharacter = avatarName[0]?.toUpperCase() || '';

    return (
      <Tooltip title={avatarName}>
        <div ref={ref} style={{ display: 'inline-block' }}>
          <Avatar
            src={avatarUrl}
            style={{
              backgroundColor: '#ffffff',
              verticalAlign: 'middle',
              width: size,
              height: size,
              border: 'none',
              outline: 'none',
            }}
          >
            {!avatarUrl && fallbackUrl && (
              <img
                src={fallbackUrl}
                alt="Worklenz"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  padding: 0,
                }}
              />
            )}
          </Avatar>
        </div>
      </Tooltip>
    );
  }
);

CustomAvatar.displayName = 'CustomAvatar';

export default CustomAvatar;
