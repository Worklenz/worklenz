import { Tag } from '@/shared/antd-imports';
import React from 'react';
import { colors } from '@/styles/colors';
import { decodeHtmlEntities } from '@/utils/html-entities';

const ProjectTeamCell = ({ team }: { team: string }) => {
  return (
    <Tag
      color={colors.paleBlue}
      style={{
        borderColor: colors.skyBlue,
        color: colors.skyBlue,
        fontSize: 12,
      }}
    >
      {decodeHtmlEntities(team)}
    </Tag>
  );
};

export default ProjectTeamCell;
