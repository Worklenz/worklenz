import { Flex, Typography, theme } from '@/shared/antd-imports';
import { FileTextOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { projectDocumentsApiService } from '@/api/projects/docs/project-documents.api.service';
import { IProjectDocumentBacklink } from '@/types/project/project-documents.types';

interface MentionedInDocsProps {
  taskId: string;
  isGuest?: boolean;
}

const MentionedInDocs = ({ taskId, isGuest = false }: MentionedInDocsProps) => {
  const { t } = useTranslation('project-view-docs');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [links, setLinks] = useState<IProjectDocumentBacklink[]>([]);

  useEffect(() => {
    if (!taskId || isGuest) {
      setLinks([]);
      return;
    }
    let cancelled = false;
    void projectDocumentsApiService
      .taskBacklinks(taskId)
      .then(response => {
        if (!cancelled && response.done) setLinks(response.body || []);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest, taskId]);

  if (isGuest || links.length === 0) return null;

  return (
    <Flex vertical gap={8} className="px-1 py-3">
      <Typography.Text strong>
        {t('mentionedIn', { defaultValue: 'Mentioned in' })}
      </Typography.Text>
      {links.map(link => (
        <button
          key={link.id}
          type="button"
          className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
          style={{ color: token.colorText }}
          aria-label={t('openDocument', { title: link.title, defaultValue: 'Open {{title}}' })}
          onClick={() => navigate(`/worklenz/projects/${link.project_id}?tab=docs&doc=${link.id}`)}
        >
          <FileTextOutlined style={{ color: token.colorTextSecondary }} />
          <span className="truncate">{link.title}</span>
        </button>
      ))}
    </Flex>
  );
};

export default MentionedInDocs;
