import { Divider, Flex, Tooltip, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';

const ProjectAuditInfo = ({ project }: { project: IProjectViewModel | null | undefined }) => {
  const { t } = useTranslation('project-drawer');
  const justNow = t('justNow', { defaultValue: 'Just now' });

  return (
    <Flex vertical gap={4}>
      <Divider />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('createdAt')}&nbsp;
        <Tooltip title={formatDateTimeWithLocale(project?.created_at || '')}>
          {calculateTimeDifference(project?.created_at || '', justNow)}
        </Tooltip>{' '}
        {t('by')} {project?.project_owner || ''}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('updatedAt')}&nbsp;
        <Tooltip title={formatDateTimeWithLocale(project?.updated_at || '')}>
          {calculateTimeDifference(project?.updated_at || '', justNow)}
        </Tooltip>
      </Typography.Text>
    </Flex>
  );
};

export default ProjectAuditInfo;
