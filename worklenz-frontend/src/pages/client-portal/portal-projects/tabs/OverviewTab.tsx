import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeOutlined, LockOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Switch,
  Tag,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { useGetPortalStaffQuery } from '@/api/client-portal/portal-access-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import {
  useGetProjectOverviewQuery,
  usePublishProjectUpdateMutation,
  useSaveProjectOverviewMutation,
} from '@/api/client-portal/portal-projects-api';
import { formatPortalDate } from '@/components/client-portal/v2';
import {
  PROJECT_PHASES,
  type ClientProjectStatus,
  type PortalProject,
  type ProgressSource,
  type ProjectOverview,
  type ProjectPhase,
} from '@/types/client-portal/v2';
import { PortalLoader } from '@/components/client-portal/v2';
import { RichTextField } from '../../shared/rich-text/RichTextField';
import { RichTextView } from '../../shared/rich-text/RichTextView';

interface OverviewTabProps {
  project: PortalProject;
}

interface OverviewForm {
  status: ClientProjectStatus;
  phase: ProjectPhase | null;
  progress_source: ProgressSource;
  manual_progress: number | null;
  start_date: string;
  expected_completion: string;
  primary_contact_id: string | null;
  client_summary: string;
  allow_client_uploads: boolean;
}

const STATUS_OPTIONS: { value: ClientProjectStatus; key: string; defaultValue: string }[] = [
  { value: 'on_track', key: 'projectOnTrack', defaultValue: 'On track' },
  { value: 'at_risk', key: 'projectAtRisk', defaultValue: 'At risk' },
  { value: 'on_hold', key: 'projectOnHold', defaultValue: 'On hold' },
  { value: 'completed', key: 'projectCompleted', defaultValue: 'Completed' },
];

const toForm = (overview: ProjectOverview): OverviewForm => ({
  status: overview.status,
  phase: overview.phase,
  progress_source: overview.progress_source,
  manual_progress: overview.manual_progress,
  start_date: overview.start_date ?? '',
  expected_completion: overview.expected_completion ?? '',
  primary_contact_id: overview.primary_contact_id,
  client_summary: overview.client_summary,
  allow_client_uploads: overview.allow_client_uploads,
});

/** Client-facing project information, published updates, and the private notes that never leave the team. */
export const OverviewTab = ({ project }: OverviewTabProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-projects');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();

  const overviewQuery = useGetProjectOverviewQuery(project.id);
  const staffQuery = useGetPortalStaffQuery();
  const [saveOverview, { isLoading: isSaving }] = useSaveProjectOverviewMutation();
  const [publishUpdate, { isLoading: isPublishing }] = usePublishProjectUpdateMutation();

  // `null` means "no edits yet", so a background refetch (a published update, say) never wipes typed changes.
  const [draft, setDraft] = useState<OverviewForm | null>(null);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [post, setPost] = useState('');

  const overview = overviewQuery.data?.body;
  const saved = useMemo(() => (overview ? toForm(overview) : null), [overview]);
  const form = draft ?? saved;
  const isDirty = draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const notes = notesDraft ?? overview?.internal_notes ?? '';
  const notesDirty = notesDraft !== null && notesDraft !== (overview?.internal_notes ?? '');

  if (overviewQuery.isLoading) return <PortalLoader />;
  if (overviewQuery.isError || !overview || !form) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('overview.loadFailed', { defaultValue: 'The project overview could not be loaded.' })}
        action={
          <Button size="small" onClick={() => overviewQuery.refetch()}>
            {t('retry', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  const update = (patch: Partial<OverviewForm>) => setDraft({ ...form, ...patch });

  const save = async () => {
    try {
      await saveOverview({
        projectId: project.id,
        body: {
          status: form.status,
          phase: form.phase,
          progress_source: form.progress_source,
          // Switching back to WorkLenz progress discards the manual value.
          manual_progress: form.progress_source === 'manual' ? (form.manual_progress ?? 0) : null,
          start_date: form.start_date || null,
          expected_completion: form.expected_completion || null,
          primary_contact_id: form.primary_contact_id,
          client_summary: form.client_summary,
          allow_client_uploads: form.allow_client_uploads,
        },
      }).unwrap();
      setDraft(null);
      message.success(
        t('overview.saved', {
          defaultValue: 'Client-facing project information saved. Clients see it on their next page load.',
        })
      );
    } catch (error) {
      message.error(
        getPortalErrorMessage(error, t('overview.saveFailed', { defaultValue: 'The project information could not be saved.' }))
      );
    }
  };

  const saveNotes = async () => {
    try {
      await saveOverview({ projectId: project.id, body: { internal_notes: notes } }).unwrap();
      setNotesDraft(null);
      message.success(t('overview.notesSaved', { defaultValue: 'Internal notes saved.' }));
    } catch (error) {
      message.error(
        getPortalErrorMessage(error, t('overview.notesSaveFailed', { defaultValue: 'The notes could not be saved.' }))
      );
    }
  };

  const publish = async () => {
    const body = post.trim();
    if (!body) return;
    try {
      await publishUpdate({ projectId: project.id, body }).unwrap();
      setPost('');
      message.success(
        t('overview.published', { defaultValue: 'Update published. Client users are notified in the portal and by email.' })
      );
    } catch (error) {
      message.error(
        getPortalErrorMessage(error, t('overview.publishFailed', { defaultValue: 'The update could not be published.' }))
      );
    }
  };

  const followsWorklenz = form.progress_source === 'worklenz';

  const progressHint =
    form.progress_source === 'worklenz'
      ? t('overview.progressWorklenzHint', {
          value: overview.worklenz_progress,
          defaultValue:
            'Read from the project’s WorkLenz progress ({{value}}%). It updates as tasks are completed.',
        })
      : t('overview.progressManualHint', {
          defaultValue: 'Set by hand. It will not change when tasks are completed.',
        });

  return (
    <Row gutter={[20, 20]}>
      <Col xs={24} lg={14}>
        <Card
          size="small"
          title={t('overview.infoTitle', { defaultValue: 'Client-facing project information' })}
          extra={
            <Tag icon={<EyeOutlined />} color="success" style={{ margin: 0 }}>
              {t('overview.shownToClient', { defaultValue: 'Shown to the client' })}
            </Tag>
          }
        >
          <Form layout="vertical">
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item label={t('overview.status', { defaultValue: 'Status' })}>
                  <Select<ClientProjectStatus>
                    value={form.status}
                    aria-label={t('overview.status', { defaultValue: 'Status' })}
                    onChange={value => update({ status: value })}
                    options={STATUS_OPTIONS.map(option => ({
                      value: option.value,
                      label: tShared(option.key, { defaultValue: option.defaultValue }),
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t('overview.phase', { defaultValue: 'Current phase' })}>
                  <Select<ProjectPhase>
                    allowClear
                    value={form.phase ?? undefined}
                    aria-label={t('overview.phase', { defaultValue: 'Current phase' })}
                    onChange={value => update({ phase: value ?? null })}
                    placeholder={t('overview.phaseNone', { defaultValue: 'Not set' })}
                    options={PROJECT_PHASES.map(phase => ({ value: phase, label: phase }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label={t('overview.progress', { defaultValue: 'Progress' })} extra={progressHint}>
              <Flex gap={10} align="center" wrap="wrap">
                <PillToggle<ProgressSource>
                  value={form.progress_source}
                  onChange={value => update({ progress_source: value })}
                  ariaLabel={t('overview.progressSource', { defaultValue: 'Progress source' })}
                  options={[
                    { value: 'worklenz', label: t('overview.progressWorklenz', { defaultValue: 'WorkLenz progress' }) },
                    { value: 'manual', label: t('overview.progressManual', { defaultValue: 'Set manually' }) },
                  ]}
                />
                {form.progress_source === 'manual' ? (
                  <InputNumber
                    min={0}
                    max={100}
                    precision={0}
                    value={form.manual_progress ?? 0}
                    onChange={value => update({ manual_progress: typeof value === 'number' ? value : 0 })}
                    addonAfter="%"
                    style={{ width: 110 }}
                    aria-label={t('overview.progressValue', { defaultValue: 'Progress percentage' })}
                  />
                ) : (
                  <strong>{overview.worklenz_progress}%</strong>
                )}
              </Flex>
            </Form.Item>

            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item label={t('overview.startDate', { defaultValue: 'Start date' })}>
                  <Input
                    aria-label={t('overview.startDate', { defaultValue: 'Start date' })}
                    type="date"
                    disabled={followsWorklenz}
                    value={followsWorklenz ? (overview.worklenz_start_date ?? '') : form.start_date}
                    onChange={event => update({ start_date: event.target.value })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={t('overview.expectedCompletion', { defaultValue: 'Expected completion' })}
                  extra={
                    followsWorklenz
                      ? t('overview.datesFromWorklenz', {
                          defaultValue: 'Taken from the WorkLenz project. Switch progress to Set manually to enter dates here.',
                        })
                      : t('overview.expectedCompletionHint', {
                          defaultValue: 'Leave blank and the portal shows “Not set” instead of inventing a date.',
                        })
                  }
                >
                  <Input
                    type="date"
                    disabled={followsWorklenz}
                    value={followsWorklenz ? (overview.worklenz_end_date ?? '') : form.expected_completion}
                    aria-label={t('overview.expectedCompletion', { defaultValue: 'Expected completion' })}
                    onChange={event => update({ expected_completion: event.target.value })}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label={t('overview.primaryContact', { defaultValue: 'Primary contact' })}
              extra={t('overview.primaryContactHint', {
                defaultValue:
                  'The member of your team clients contact first. Only your workspace team can be chosen; client users are not listed.',
              })}
            >
              <Select<string>
                allowClear
                showSearch
                optionFilterProp="label"
                loading={staffQuery.isLoading}
                value={form.primary_contact_id ?? undefined}
                aria-label={t('overview.primaryContact', { defaultValue: 'Primary contact' })}
                onChange={value => update({ primary_contact_id: value ?? null })}
                placeholder={t('overview.primaryContactNone', { defaultValue: 'Not set' })}
                options={(staffQuery.data?.body ?? []).map(member => ({ value: member.id, label: member.name }))}
              />
            </Form.Item>

            <Form.Item
              label={t('overview.summary', { defaultValue: 'Summary for the client' })}
              extra={t('overview.summaryHint', {
                defaultValue: 'Written for the client. Keep internal context in the private notes.',
              })}
            >
              <RichTextField
                value={form.client_summary}
                onChange={html => update({ client_summary: html })}
                ariaLabel={t('overview.summary', { defaultValue: 'Summary for the client' })}
                maxLength={2000}
              />
            </Form.Item>

            <Flex
              justify="space-between"
              align="flex-start"
              gap={12}
              style={{ padding: '10px 0', borderTop: `1px solid ${token.colorBorderSecondary}` }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {t('overview.allowUploads', { defaultValue: 'Allow client uploads' })}
                </div>
                <div style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
                  {t('overview.allowUploadsHint', {
                    defaultValue:
                      'Client Admins and Client Members can add files in this project. Client Viewers never can.',
                  })}
                </div>
              </div>
              <Switch
                checked={form.allow_client_uploads}
                onChange={checked => update({ allow_client_uploads: checked })}
                aria-label={t('overview.allowUploads', { defaultValue: 'Allow client uploads' })}
              />
            </Flex>

            <Button type="primary" size="small" disabled={!isDirty} loading={isSaving && isDirty} onClick={() => void save()}>
              {t('overview.save', { defaultValue: 'Save changes' })}
            </Button>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={10}>
        <Flex vertical gap={16}>
          <Card size="small" title={t('overview.publishTitle', { defaultValue: 'Publish an update' })}>
            <RichTextField
              value={post}
              onChange={html => setPost(html)}
              placeholder={t('overview.publishPlaceholder', { defaultValue: 'What should the client know this week?' })}
              ariaLabel={t('overview.publishTitle', { defaultValue: 'Publish an update' })}
              maxLength={2000}
            />
            <Flex justify="space-between" align="center" gap={8} wrap="wrap" style={{ marginTop: 10 }}>
              <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                {t('overview.publishAudience', { defaultValue: 'Visible to every client user on this project' })}
              </Typography.Text>
              <Button type="primary" size="small" disabled={!post.trim()} loading={isPublishing} onClick={() => void publish()}>
                {t('overview.publish', { defaultValue: 'Publish update' })}
              </Button>
            </Flex>

            <div style={{ marginTop: 14 }}>
              {overview.updates.slice(0, 4).map((item, index) => (
                <div key={item.id} style={{ padding: '9px 0', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {item.author.short_name}
                    <span style={{ fontWeight: 400, color: token.colorTextTertiary, marginLeft: 6 }}>
                      {formatPortalDate(item.published_at, i18n.language)}
                    </span>
                    {index === 0 && (
                      <Tag color="processing" style={{ marginLeft: 8 }}>
                        {t('overview.latest', { defaultValue: 'Latest' })}
                      </Tag>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 3, color: token.colorTextSecondary }}>
                    <RichTextView value={item.body} />
                  </div>
                </div>
              ))}
              {overview.updates.length === 0 && (
                <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                  {t('overview.noUpdates', { defaultValue: 'No updates published yet.' })}
                </Typography.Text>
              )}
            </div>
          </Card>

          <Card
            size="small"
            title={t('overview.notesTitle', { defaultValue: 'Internal notes' })}
            extra={
              <Tag icon={<LockOutlined />} style={{ margin: 0 }}>
                {t('overview.neverShown', { defaultValue: 'Never shown to the client' })}
              </Tag>
            }
          >
            <RichTextField
              value={notes}
              onChange={html => setNotesDraft(html)}
              placeholder={t('overview.notesPlaceholder', { defaultValue: 'Margin, risks, staffing…' })}
              ariaLabel={t('overview.notesTitle', { defaultValue: 'Internal notes' })}
              maxLength={4000}
              tone="internal"
            />
            <Button size="small" style={{ marginTop: 10 }} disabled={!notesDirty} loading={isSaving && notesDirty} onClick={() => void saveNotes()}>
              {t('overview.saveNotes', { defaultValue: 'Save notes' })}
            </Button>
          </Card>
        </Flex>
      </Col>
    </Row>
  );
};
