import Tooltip from 'antd/es/tooltip';
import Avatar from 'antd/es/avatar';

import { AvatarNamesMap } from '../shared/constants';

const CustomAvatar = ({ avatarName, size = 32 }: { avatarName: string; size?: number }) => {
  const avatarCharacter = avatarName[0].toUpperCase();

  return (
    <Tooltip title={avatarName}>
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
    </Tooltip>
  );
};

export default CustomAvatar;
