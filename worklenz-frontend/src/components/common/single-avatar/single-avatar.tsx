import { AvatarNamesMap } from '@/shared/constants';
import { Avatar, Flex, Space } from '@/shared/antd-imports';

interface SingleAvatarProps {
  avatarUrl?: string;
  name?: string;
  email?: string;
}

const SingleAvatar: React.FC<SingleAvatarProps> = ({ avatarUrl, name, email = null }) => {
  return (
    <Avatar
      src={avatarUrl}
      size={28}
      style={{
        backgroundColor: avatarUrl ? 'transparent' : AvatarNamesMap[name?.charAt(0) || ''],
        border: avatarUrl ? 'none' : '1px solid #d9d9d9',
        marginRight: '8px',
      }}
    >
      {name?.charAt(0)}
    </Avatar>
  );
};

export default SingleAvatar;
