import React from 'react';
import {
  Avatar,
  Card,
  Col,
  Flex,
  Progress,
  Row,
  Steps,
  Tag,
  Typography,
  AuditOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  FlagOutlined,
  MessageOutlined,
  SwapOutlined,
  theme,
} from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetThreadsQuery } from '@/store/api-v2';
import { useFormatters } from '@/hooks/useFormatters';
import { ActionRow, KeyValueList, RichTextView, StatusTag } from '@/components/v2';
import type { ClientProjectV2 } from '@/types/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';

const PROJECT_PHASES = ['Discovery', 'Design', 'Development', 'UAT', 'Deployment'] as const;

/** Summary, progress and phase, latest update, key dates, contact and quick links. */
export const OverviewTab: React.FC<{ project: ClientProjectV2 }> = ({ project }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { date } = useFormatters();
  const { data: threads } = useGetThreadsQuery({ projectId: project.id });

  const phaseIndex = PROJECT_PHASES.findIndex(phase => phase === project.phase);
  const base = `/projects/${project.id}`;
  const links = [
    { label: t('projects.tabs.milestones', { defaultValue: 'Milestones' }), count: project.shared_counts.milestones, path: `${base}/milestones`, icon: <FlagOutlined /> },
    { label: t('projects.tabs.tasks', { defaultValue: 'Tasks' }), count: project.shared_counts.tasks, path: `${base}/tasks`, icon: <CheckSquareOutlined /> },
    { label: t('projects.tabs.files', { defaultValue: 'Files' }), count: project.shared_counts.files, path: `${base}/files`, icon: <FileTextOutlined /> },
    { label: t('projects.tabs.discussions', { defaultValue: 'Discussions' }), count: threads?.length ?? 0, path: `${base}/discussions`, icon: <MessageOutlined /> },
  ];
  const openApprovals = project.open_approvals ?? 0;
  const openRequests = project.open_change_requests ?? 0;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={15}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ lineHeight: 1.6 }}>
            <RichTextView value={project.summary} />
          </div>
          <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary">{t('projects.progress', { defaultValue: 'Progress' })}</Typography.Text>
            <Progress percent={project.progress} strokeColor={project.color ?? undefined} style={{ flex: 1, margin: 0 }} />
          </Flex>
          {phaseIndex >= 0 && (
            <Steps
              size="small"
              current={phaseIndex}
              items={PROJECT_PHASES.map(phase => ({ title: t(`projects.phases.${phase}`, { defaultValue: phase }) }))}
            />
          )}
        </Card>
        <Card title={t('projects.latestUpdate', { defaultValue: 'Latest update' })}>
          {project.latest_update ? (
            <>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {date(project.latest_update.published_at)}
              </Typography.Text>
              <div style={{ marginTop: 4, lineHeight: 1.6 }}>
                <RichTextView value={project.latest_update.body} />
              </div>
            </>
          ) : (
            <Typography.Text type="secondary">
              {t('projects.noUpdates', { defaultValue: 'No updates have been published yet.' })}
            </Typography.Text>
          )}
        </Card>
      </Col>
      <Col xs={24} lg={9}>
        <Card title={t('projects.keyDates', { defaultValue: 'Key dates' })} style={{ marginBottom: 16 }}>
          <KeyValueList
            rows={[
              [t('projects.start', { defaultValue: 'Start' }), date(project.start_date)],
              [t('projects.expectedCompletion', { defaultValue: 'Expected completion' }), date(project.expected_completion)],
              [t('projects.status', { defaultValue: 'Status' }), <StatusTag key="s" kind="project" status={project.status} />],
              [t('projects.currentPhase', { defaultValue: 'Current phase' }), decodeHtmlEntities(project.phase ?? undefined) || '—'],
            ]}
          />
        </Card>
        <Card title={t('projects.contact', { defaultValue: 'Project contact' })} style={{ marginBottom: 16 }}>
          {project.primary_contact ? (
            <Flex gap={12} align="center">
              <Avatar style={{ backgroundColor: project.color ?? token.colorPrimary }}>{decodeHtmlEntities(project.primary_contact)[0]}</Avatar>
              <div>
                <Typography.Text strong style={{ display: 'block' }}>{decodeHtmlEntities(project.primary_contact)}</Typography.Text>
                {project.contact_title && (
                  <Typography.Text type="secondary" style={{ display: 'block', fontSize: token.fontSizeSM }}>
                    {decodeHtmlEntities(project.contact_title)}
                  </Typography.Text>
                )}
                {project.contact_email && <a href={`mailto:${project.contact_email}`}>{project.contact_email}</a>}
              </div>
            </Flex>
          ) : (
            <Typography.Text type="secondary">{t('projects.noContact', { defaultValue: 'No contact has been named yet.' })}</Typography.Text>
          )}
        </Card>
        <Card title={t('projects.quickLinks', { defaultValue: 'Quick links' })}>
          {links.map(link => (
            <ActionRow
              key={link.path}
              icon={link.icon}
              title={<span style={{ fontWeight: 400 }}>{link.label}</span>}
              onClick={() => navigate(link.path)}
              right={<Typography.Text type="secondary">{link.count}</Typography.Text>}
            />
          ))}
          <ActionRow
            icon={<AuditOutlined />}
            title={<span style={{ fontWeight: 400 }}>{t('navigation.approvals', { defaultValue: 'Approvals' })}</span>}
            onClick={() => navigate('/approvals')}
            right={
              openApprovals > 0 ? (
                <Tag color="orange">{t('projects.pending', { count: openApprovals, defaultValue: '{{count}} pending' })}</Tag>
              ) : (
                <Typography.Text type="secondary">{t('projects.nonePending', { defaultValue: 'None pending' })}</Typography.Text>
              )
            }
          />
          <ActionRow
            icon={<SwapOutlined />}
            title={<span style={{ fontWeight: 400 }}>{t('projects.changeRequests', { defaultValue: 'Change requests' })}</span>}
            onClick={() => navigate('/change-requests')}
            right={<Typography.Text type="secondary">{t('projects.openCount', { count: openRequests, defaultValue: '{{count}} open' })}</Typography.Text>}
          />
        </Card>
      </Col>
    </Row>
  );
};
