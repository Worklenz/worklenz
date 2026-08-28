import { AvatarNamesMap } from '@/shared/constants';
import { Avatar, Flex, Space } from '@/shared/antd-imports';

interface SingleAvatarProps {
  avatarUrl?: string;
  name?: string;
  email?: string;
  size?: number;
  marginRight?: string | number;
}

const SingleAvatar: React.FC<SingleAvatarProps> = ({
  avatarUrl,
  name,
  email = null,
  size = 28,
  marginRight = '8px',
}) => {
  return (
    <Avatar
      src={
        avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name ?? 'avatar'}
            width={size}
            height={size}
            style={{ objectFit: 'cover', display: 'block' }}
          />
        ) : undefined
      }
      size={size}
      style={{
        backgroundColor: avatarUrl ? 'transparent' : AvatarNamesMap[name?.charAt(0) || ''],
        border: avatarUrl ? 'none' : '1px solid #d9d9d9',
        marginRight,
        flexShrink: 0,
      }}
    >
      {name?.charAt(0)}
    </Avatar>
  );
};

export default SingleAvatar;
