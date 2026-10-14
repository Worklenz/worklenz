import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Col, Flex, Row, Select, Typography, theme } from '@/shared/antd-imports';
import { ThunderboltOutlined } from '@ant-design/icons';
import type {
  GithubTransitionEvent,
  IGithubProjectStatus,
  IGithubStatusMap,
} from '@/api/github/github.api.service';

interface GithubStatusAutomationProps {
  statuses: IGithubProjectStatus[];
  value: IGithubStatusMap;
  disabled: boolean;
  onChange: (event: GithubTransitionEvent, statusId: string | null) => void;
}

const EVENTS: Array<{ event: GithubTransitionEvent; key: string; defaultValue: string }> = [
  { event: 'branch_created', key: 'project.automation.branchCreated', defaultValue: 'Branch created' },
  { event: 'pr_opened', key: 'project.automation.prOpened', defaultValue: 'Pull request opened' },
  { event: 'pr_merged', key: 'project.automation.prMerged', defaultValue: 'Pull request merged' },
];

/** Per-repository mapping from Git activity to the status an issue should move to. */
export const GithubStatusAutomation = ({
  statuses,
  value,
  disabled,
  onChange,
}: GithubStatusAutomationProps) => {
  const { t } = useTranslation('github-integration');
  const { token } = theme.useToken();

  const options = useMemo(
    () =>
      statuses.map(status => ({
        value: status.id,
        label: status.name,
      })),
    [statuses]
  );

  return (
    <Flex vertical gap={8} style={{ marginTop: 8 }}>
      <Flex align="center" gap={6}>
        <ThunderboltOutlined style={{ color: token.colorTextSecondary }} aria-hidden />
        <Typography.Text strong style={{ fontSize: 13 }}>
          {t('project.automation.title', { defaultValue: 'Status automation' })}
        </Typography.Text>
      </Flex>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('project.automation.description', {
          defaultValue:
            'Move issues automatically as GitHub activity happens. Issues never move backwards or out of a done status.',
        })}
      </Typography.Text>
      <Row gutter={[12, 8]}>
        {EVENTS.map(({ event, key, defaultValue }) => {
          const label = t(key, { defaultValue });
          return (
            <Col key={event} xs={24} md={8}>
              <Flex vertical gap={4}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {label}
                </Typography.Text>
                <Select
                  allowClear
                  size="middle"
                  disabled={disabled}
                  value={value[event] ?? undefined}
                  options={options}
                  placeholder={t('project.automation.noChange', {
                    defaultValue: 'Don’t change status',
                  })}
                  aria-label={label}
                  onChange={next => onChange(event, next ?? null)}
                  onClear={() => onChange(event, null)}
                />
              </Flex>
            </Col>
          );
        })}
      </Row>
    </Flex>
  );
};

export default GithubStatusAutomation;
