import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Select, Switch, Typography, theme } from '@/shared/antd-imports';
import { DownloadOutlined } from '@ant-design/icons';
import type { IGithubImportSettings, IGithubSprint } from '@/api/github/github.api.service';
import { ImportGithubIssuesModal } from './ImportGithubIssuesModal';

interface GithubImportSettingsProps {
  projectId: string;
  linkId: string;
  repositoryName: string;
  value: IGithubImportSettings;
  sprints: IGithubSprint[];
  /** True for members who may change project settings. */
  canManage: boolean;
  onChange: (next: IGithubImportSettings) => void;
  onImported: () => void;
}

const BACKLOG_VALUE = '__backlog__';

/** Issue import controls for one linked repository. */
export const GithubImportSettings = ({
  projectId,
  linkId,
  repositoryName,
  value,
  sprints,
  canManage,
  onChange,
  onImported,
}: GithubImportSettingsProps) => {
  const { t } = useTranslation('github-integration');
  const { token } = theme.useToken();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const update = (changes: Partial<IGithubImportSettings>) => onChange({ ...value, ...changes });

  return (
    <Flex vertical gap={10} style={{ marginTop: 12 }}>
      <Flex align="center" justify="space-between" gap={8} wrap>
        <Flex align="center" gap={6}>
          <DownloadOutlined style={{ color: token.colorTextSecondary }} aria-hidden />
          <Typography.Text strong style={{ fontSize: 13 }}>
            {t('importSettings.title', { defaultValue: 'Issue import' })}
          </Typography.Text>
        </Flex>
        <Button size="small" onClick={() => setIsImportOpen(true)}>
          {t('import.button', { defaultValue: 'Import issues…' })}
        </Button>
      </Flex>

      <Flex align="center" gap={8}>
        <Switch
          checked={!!value.auto_import}
          disabled={!canManage}
          onChange={checked => update({ auto_import: checked })}
          aria-label={t('importSettings.autoImport', { defaultValue: 'Auto-import new issues' })}
        />
        <Flex vertical>
          <Typography.Text style={{ fontSize: 13 }}>
            {t('importSettings.autoImport', { defaultValue: 'Auto-import new issues' })}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('importSettings.autoImportHint', {
              defaultValue:
                'New GitHub issues are added automatically, filtered by the labels below.',
            })}
          </Typography.Text>
        </Flex>
      </Flex>

      {value.auto_import && (
        <Flex gap={12} wrap>
          <Flex vertical gap={4} style={{ flex: 1, minWidth: 200 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('importSettings.labels', { defaultValue: 'Only issues with these labels' })}
            </Typography.Text>
            <Select
              mode="tags"
              disabled={!canManage}
              value={value.labels || []}
              tokenSeparators={[',']}
              onChange={labels => update({ labels })}
              placeholder={t('importSettings.labelsPlaceholder', { defaultValue: 'All issues' })}
              aria-label={t('importSettings.labels', {
                defaultValue: 'Only issues with these labels',
              })}
            />
          </Flex>
          <Flex vertical gap={4} style={{ minWidth: 200 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('importSettings.destination', { defaultValue: 'Add imported issues to' })}
            </Typography.Text>
            <Select
              disabled={!canManage}
              value={value.default_phase_id || BACKLOG_VALUE}
              onChange={next => update({ default_phase_id: next === BACKLOG_VALUE ? null : next })}
              options={[
                { value: BACKLOG_VALUE, label: t('import.backlog', { defaultValue: 'Backlog' }) },
                ...sprints.map(sprint => ({ value: sprint.id, label: sprint.name })),
              ]}
              aria-label={t('importSettings.destination', {
                defaultValue: 'Add imported issues to',
              })}
            />
          </Flex>
        </Flex>
      )}

      <Flex align="center" gap={8}>
        <Switch
          checked={!!value.close_on_issue_close}
          disabled={!canManage}
          onChange={checked => update({ close_on_issue_close: checked })}
          aria-label={t('importSettings.closeOnClose', {
            defaultValue: 'Finish the issue when its GitHub issue is closed',
          })}
        />
        <Typography.Text style={{ fontSize: 13 }}>
          {t('importSettings.closeOnClose', {
            defaultValue: 'Finish the issue when its GitHub issue is closed',
          })}
        </Typography.Text>
      </Flex>

      <ImportGithubIssuesModal
        open={isImportOpen}
        projectId={projectId}
        linkId={linkId}
        repositoryName={repositoryName}
        sprints={sprints}
        onClose={() => setIsImportOpen(false)}
        onImported={onImported}
      />
    </Flex>
  );
};

export default GithubImportSettings;
