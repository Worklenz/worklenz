import { Avatar, Flex, Typography, Tooltip } from '@/shared/antd-imports';
import CustomAvatar from '@components/CustomAvatar';

type ProjectMangerCellProps = {
  member: { avatar_url: string; name: string } | null;
};

const MemberCell = ({ member }: ProjectMangerCellProps) => {
  return (
    <div>
      {member ? (
        <Flex gap={8} align="center">
          <Tooltip title={member.name} getPopupContainer={() => document.body}>
            <span style={{ display: 'inline-flex' }}>
              {member?.avatar_url ? (
                <Avatar src={member.avatar_url} />
              ) : (
                <CustomAvatar avatarName={member.name} />
              )}
            </span>
          </Tooltip>

          <Typography.Text className="group-hover:text-[#1890ff]">{member.name}</Typography.Text>
        </Flex>
      ) : (
        <Typography.Text className="group-hover:text-[#1890ff]">-</Typography.Text>
      )}
    </div>
  );
};

export default MemberCell;
