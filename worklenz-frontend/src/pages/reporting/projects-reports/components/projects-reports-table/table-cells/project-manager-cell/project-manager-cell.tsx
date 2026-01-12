import { Avatar, Flex, Typography } from '@/shared/antd-imports';
import CustomAvatar from '@components/CustomAvatar';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';

type ProjectMangerCellProps = {
  manager: ITeamMemberViewModel;
};

const ProjectManagerCell = ({ manager }: ProjectMangerCellProps) => {
  return (
    <div>
      {manager ? (
        <Flex gap={8} align="center">
          <SingleAvatar name={manager.name} avatarUrl={manager.avatar_url} />

          <Typography.Text className="group-hover:text-[#1890ff]">{manager.name}</Typography.Text>
        </Flex>
      ) : (
        <Typography.Text className="group-hover:text-[#1890ff]">-</Typography.Text>
      )}
    </div>
  );
};

export default ProjectManagerCell;
