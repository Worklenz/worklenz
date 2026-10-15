import React, { useEffect, useState } from 'react';
import { Card, Flex, Typography, AuditOutlined, CheckSquareOutlined, FileTextOutlined, theme } from '@/shared/antd-imports';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetApprovalsQuery, useGetMilestonesQuery } from '@/store/api-v2';
import { useFormatters } from '@/hooks/useFormatters';
import { ActionRow, EmptyState, QueryState, RichTextView, StatusTag, UnavailableBanner } from '@/components/v2';
import type { ClientMilestoneV2, ClientProjectV2, MilestoneStatus } from '@/types/v2';

/** Vertical timeline of the milestones the team shared. `?ms=` opens one; a missing one shows a banner. */
export const MilestonesTab: React.FC<{ project: ClientProjectV2 }> = ({ project }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const wanted = searchParams.get('ms');
  const query = useGetMilestonesQuery(project.id);
  const { data: approvals } = useGetApprovalsQuery();
  const [openId, setOpenId] = useState<string | null>(wanted);

  useEffect(() => {
    if (wanted) setOpenId(wanted);
  }, [wanted]);

  const milestones = query.data ?? [];
  const missing = Boolean(wanted) && query.isSuccess && !milestones.some(m => m.id === wanted);

  return (
    <QueryState {...query} refetch={query.refetch}>
      {missing && <UnavailableBanner what="milestone" />}
      {milestones.length === 0 ? (
        <EmptyState title={t('milestones.none', { defaultValue: 'No milestones are shared with you yet.' })} />
      ) : (
        <Card>
          {milestones.map((milestone, index) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              project={project}
              isLast={index === milestones.length - 1}
              isOpen={openId === milestone.id}
              onToggle={() => setOpenId(current => (current === milestone.id ? null : milestone.id))}
              approvals={(approvals ?? []).filter(a => a.linked_item.type === 'milestone' && a.linked_item.id === milestone.id)}
            />
          ))}
        </Card>
      )}
    </QueryState>
  );
};

interface MilestoneRowProps {
  milestone: ClientMilestoneV2;
  project: ClientProjectV2;
  isLast: boolean;
  isOpen: boolean;
  onToggle: () => void;
  approvals: Array<{ id: string; ref_no: string; title: string; status: string }>;
}

const MilestoneRow = ({ milestone, project, isLast, isOpen, onToggle, approvals }: MilestoneRowProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { date } = useFormatters();

  const dotColor: Record<MilestoneStatus, string> = {
    completed: token.colorSuccess,
    in_progress: token.colorPrimary,
    delayed: token.colorWarning,
    upcoming: token.colorBorder,
  };
  const hasLinked = milestone.linked_tasks.length + milestone.linked_files.length > 0;
  const hasDetails = Boolean(milestone.completion_note) || milestone.date_moved || hasLinked || approvals.length > 0;

  return (
    <Flex gap={14}>
      <Flex vertical align="center" style={{ width: 16, flexShrink: 0 }} aria-hidden>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            marginTop: 5,
            background: milestone.status === 'upcoming' ? 'transparent' : dotColor[milestone.status],
            border: `2px solid ${dotColor[milestone.status]}`,
          }}
        />
        {!isLast && <span style={{ flex: 1, width: 2, background: token.colorBorderSecondary, marginTop: 4 }} />}
      </Flex>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 16 }}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          onClick={onToggle}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggle();
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <Flex gap={10} align="center" wrap="wrap">
            <Typography.Text strong>{milestone.name}</Typography.Text>
            <StatusTag kind="milestone" status={milestone.status} />
          </Flex>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: token.fontSizeSM, marginTop: 2 }}>
            {t('milestones.target', { date: date(milestone.target_date), defaultValue: 'Target {{date}}' })}
            {milestone.completed_at &&
              ` · ${t('milestones.completedOn', { date: date(milestone.completed_at), defaultValue: 'Completed {{date}}' })}`}
          </Typography.Text>
          {milestone.description && (
            <div style={{ marginTop: 4 }}>
              <RichTextView value={milestone.description} />
            </div>
          )}
        </div>

        {isOpen && (
          <div style={{ marginTop: 10 }}>
            {milestone.completion_note && (
              <Card size="small" style={{ marginBottom: 8 }}>
                <Typography.Text type="secondary" strong style={{ fontSize: token.fontSizeSM }}>
                  {t('milestones.completionNote', { defaultValue: 'COMPLETION NOTE' })}
                </Typography.Text>
                <RichTextView value={milestone.completion_note} />
              </Card>
            )}
            {milestone.date_moved && (
              <Typography.Paragraph type="secondary">
                {t('milestones.delayedNote', { defaultValue: 'The target date has moved. Your project contact can share more detail.' })}
              </Typography.Paragraph>
            )}
            {hasLinked && (
              <div style={{ marginBottom: 8 }}>
                <Typography.Text type="secondary" strong style={{ fontSize: token.fontSizeSM }}>
                  {t('milestones.linkedWork', { defaultValue: 'LINKED WORK' })}
                </Typography.Text>
                {milestone.linked_tasks.map(task => (
                  <ActionRow
                    key={task.id}
                    icon={<CheckSquareOutlined />}
                    title={<span style={{ fontWeight: 400 }}>{task.title}</span>}
                    onClick={() => navigate(`/projects/${project.id}/tasks?task=${encodeURIComponent(task.id)}`)}
                  />
                ))}
                {milestone.linked_files.map(file => (
                  <ActionRow
                    key={file.id}
                    icon={<FileTextOutlined />}
                    title={<span style={{ fontWeight: 400 }}>{file.name}</span>}
                    onClick={() => navigate(`/projects/${project.id}/files?file=${encodeURIComponent(file.id)}`)}
                  />
                ))}
              </div>
            )}
            {approvals.map(approval => (
              <ActionRow
                key={approval.id}
                icon={<AuditOutlined />}
                title={<span style={{ fontWeight: 400 }}>{`${approval.ref_no} · ${approval.title}`}</span>}
                onClick={() => navigate(`/approvals/${approval.id}`)}
                right={<StatusTag kind="approval" status={approval.status} />}
              />
            ))}
            {!hasDetails && (
              <Typography.Text type="secondary">
                {t('milestones.nothingMore', { defaultValue: 'Nothing more to share on this milestone yet.' })}
              </Typography.Text>
            )}
          </div>
        )}
      </div>
    </Flex>
  );
};
