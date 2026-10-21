import { Flex, Tag, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface ProjectSettingsHeaderProps {
  projectId: string | null;
  project: IProjectViewModel | null | undefined;
}

const ProjectSettingsHeader = ({ projectId, project }: ProjectSettingsHeaderProps) => {
  const { t } = useTranslation('project-drawer');
  const { token } = theme.useToken();

  if (!projectId) {
    return (
      <Typography.Text style={{ fontWeight: 600, fontSize: 16 }}>
        {t('createProject')}
      </Typography.Text>
    );
  }

  const projectName = decodeHtmlEntities(project?.name ?? '');

  return (
    <Flex align="center" gap={12} className="min-w-0">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
        style={{
          background: project?.color_code || token.colorPrimary,
          color: token.colorWhite,
        }}
      >
        {(project?.key || projectName || '?').slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0">
        <Flex align="center" gap={8} className="min-w-0">
          <Typography.Text strong ellipsis style={{ fontSize: 16, maxWidth: 420 }}>
            {projectName || t('projectSettings', { defaultValue: 'Project Settings' })}
          </Typography.Text>
          {project?.key && (
            <Tag bordered={false} style={{ marginInlineEnd: 0, fontFamily: 'monospace' }}>
              {project.key}
            </Tag>
          )}
        </Flex>
        <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
          {t('projectSettings', { defaultValue: 'Project Settings' })}
        </Typography.Text>
      </div>
    </Flex>
  );
};

export default ProjectSettingsHeader;
