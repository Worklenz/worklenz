import { Flex, Typography } from '@/shared/antd-imports';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { decodeHtmlEntities } from '@/utils/html-entities';

type ProjectMangerCellProps = {
  manager: ITeamMemberViewModel;
};

const ProjectManagerCell = ({ manager }: ProjectMangerCellProps) => {
  const name = decodeHtmlEntities(manager?.name);
  return (
    <div>
      {manager ? (
        <Flex gap={8} align="center">
          <SingleAvatar name={name} avatarUrl={manager.avatar_url} />

          <Typography.Text className="group-hover:text-[#1890ff]">{name}</Typography.Text>
        </Flex>
      ) : (
        <Typography.Text className="group-hover:text-[#1890ff]">-</Typography.Text>
      )}
    </div>
  );
};

export default ProjectManagerCell;
