
import React, { useEffect, useState } from 'react';
import { AvatarNamesMap } from '../shared/constants';
import { Avatar, Tooltip } from '@/shared/antd-imports';

interface CustomAvatarProps {
  avatarName: string;
  size?: number;
  avatarUrl?: string;
  fallbackUrl?: string;
}

const CustomAvatar = React.forwardRef<HTMLDivElement, CustomAvatarProps>(
  ({ avatarName, size = 32, avatarUrl, fallbackUrl }, ref) => {
    const avatarCharacter = avatarName[0]?.toUpperCase() || '';
    const [imageFailed, setImageFailed] = useState(false);

    // A new URL deserves a fresh load attempt.
    useEffect(() => {
      setImageFailed(false);
    }, [avatarUrl]);

    const showImage = !!avatarUrl && !imageFailed;

    return (
      <Tooltip title={avatarName}>
        <div ref={ref} style={{ display: 'inline-block' }}>
          <Avatar
            src={showImage ? avatarUrl : undefined}
            onError={() => {
              setImageFailed(true);
              return true;
            }}
            style={{
              backgroundColor:
                !showImage && fallbackUrl
                  ? '#ffffff'
                  : AvatarNamesMap[avatarCharacter],
              verticalAlign: 'middle',
              width: size,
              height: size,
              border: 'none',
              outline: 'none',
            }}
          >
            {!showImage &&
              (fallbackUrl ? (
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
              ) : (
                avatarCharacter
              ))}
          </Avatar>
        </div>
      </Tooltip>
    );
  }
);

CustomAvatar.displayName = 'CustomAvatar';

export default CustomAvatar;
