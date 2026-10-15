import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { DownloadOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { Button, DatePicker, Tooltip, Dropdown, Flex, Typography, dayjs, theme } from '@/shared/antd-imports';
import config from '@/config/env';
import { API_BASE_URL } from '@/shared/constants';
import { useGetPortalOrganizationsQuery } from '@/api/client-portal/portal-access-api';
import { getAuditExportUrl } from '@/api/client-portal/portal-api-utils';
import { useGetAuditLogQuery } from '@/api/client-portal/portal-workflow-api';
import {
  PORTAL_TOOLBAR_BUTTON_STYLE,
  PortalFieldsButton,
  PortalFilterButton,
  PortalListToolbar,
  PortalPagedTable,
  StatusTag,
  formatPortalDate,
  formatPortalTime,
  usePortalColumnVisibility,
  useDebouncedValue,
  usePortalPaging,
} from '@/components/client-portal/v2';
import type { MenuProps } from '@/shared/antd-imports';
import type { PortalField, PortalFilterGroup } from '@/components/client-portal/v2';
import { parseAuditTarget } from './target-details';
import type { AuditEvent, AuditEventType, PortalSide } from '@/types/client-portal/v2';

const TYPE_OPTIONS: { value: AuditEventType; key: string; defaultValue: string }[] = [
  { value: 'access', key: 'types.access', defaultValue: 'Access' },
  { value: 'visibility', key: 'types.visibility', defaultValue: 'Visibility' },
  { value: 'file', key: 'types.files', defaultValue: 'Files' },
  { value: 'comment', key: 'types.comments', defaultValue: 'Comments' },
  { value: 'approval', key: 'types.approvals', defaultValue: 'Approvals' },
  { value: 'change_request', key: 'types.changeRequests', defaultValue: 'Change requests' },
];

/**
 * Every important client and internal action, timestamped and attributed. Read-only: there is no way
 * to edit or delete an entry. Export CSV downloads exactly the filtered view.
 */
const TARGET_CELL_STYLE = {
  display: 'block',
  maxWidth: 320,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 12.5,
} as const;

const AuditLogPage = () => {
  const { t, i18n } = useTranslation('client-portal-v2-audit');
  const { token } = theme.useToken();
  const [searchParams] = useSearchParams();
  const paging = usePortalPaging();

  const [search, setSearch] = useState('');
  const [types, setTypes] = useState<AuditEventType[]>([]);
  const [sides, setSides] = useState<PortalSide[]>([]);
  // "Open full audit log" from a client's workspace arrives with that client already selected.
  const [organizationIds, setOrganizationIds] = useState<string[]>(() => {
    const initial = searchParams.get('organization_id');
    return initial ? [initial] : [];
  });
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const columnVisibility = usePortalColumnVisibility('worklenz.portal.auditLog.hiddenColumns');

  useEffect(() => {
    paging.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, types, sides, organizationIds, range]);

  const organizations = useGetPortalOrganizationsQuery({ limit: 100 });
  const filters = {
    search: debouncedSearch.trim() || undefined,
    type: types.length ? types.join(',') : undefined,
    side: sides.length ? sides.join(',') : undefined,
    organization_id: organizationIds.length ? organizationIds.join(',') : undefined,
    date_from: range ? range[0].startOf('day').toISOString() : undefined,
    date_to: range ? range[1].endOf('day').add(1, 'millisecond').toISOString() : undefined,
  };

  const clearFilters = () => {
    setTypes([]);
    setSides([]);
    setOrganizationIds([]);
    setRange(null);
  };

  const filterGroups: PortalFilterGroup[] = [
    {
      key: 'type',
      label: t('typeLabel', { defaultValue: 'Event type' }),
      options: TYPE_OPTIONS.map(option => ({ value: option.value, label: t(option.key, { defaultValue: option.defaultValue }) })),
      value: types,
      onChange: value => setTypes(value as AuditEventType[]),
    },
    {
      key: 'side',
      label: t('sideLabel', { defaultValue: 'Who acted' }),
      options: [
        { value: 'client', label: t('clientActions', { defaultValue: 'Client actions' }) },
        { value: 'internal', label: t('internalActions', { defaultValue: 'Internal actions' }) },
      ],
      value: sides,
      onChange: value => setSides(value as PortalSide[]),
    },
    {
      key: 'client',
      label: t('clientLabel', { defaultValue: 'Client' }),
      options: (organizations.data?.body?.items ?? []).map(item => ({ value: item.id, label: item.name })),
      value: organizationIds,
      onChange: setOrganizationIds,
      searchPlaceholder: t('searchClients', { defaultValue: 'Search clients…' }),
    },
  ];

  const fields: PortalField[] = [
    { key: 'when', label: t('columns.when', { defaultValue: 'When' }) },
    { key: 'actor', label: t('columns.actor', { defaultValue: 'Actor' }) },
    { key: 'event', label: t('columns.event', { defaultValue: 'Event' }) },
    { key: 'target', label: t('columns.target', { defaultValue: 'Target' }) },
    { key: 'client', label: t('columns.client', { defaultValue: 'Client' }) },
  ];
  const query = useGetAuditLogQuery({ page: paging.page, limit: paging.limit, ...filters });
  const list = query.data?.body;

  const downloadCsv = (exportFilters?: typeof filters) =>
    window.open(getAuditExportUrl(`${config.apiUrl}${API_BASE_URL}`, exportFilters), '_blank', 'noopener,noreferrer');

  const exportItems: MenuProps['items'] = [
    { key: 'all', label: t('exportAll', { defaultValue: 'Export all as CSV' }), onClick: () => downloadCsv() },
    {
      key: 'filtered',
      label: t('exportFiltered', { defaultValue: 'Export filtered as CSV' }),
      onClick: () => downloadCsv(filters),
    },
  ];

  const weekRange = (offset: number): [Dayjs, Dayjs] => [
    dayjs().add(offset, 'week').startOf('week'),
    dayjs().add(offset, 'week').endOf('week'),
  ];
  const monthRange = (offset: number): [Dayjs, Dayjs] => [
    dayjs().add(offset, 'month').startOf('month'),
    dayjs().add(offset, 'month').endOf('month'),
  ];
  const datePresets = [
    { label: t('presets.thisWeek', { defaultValue: 'This week' }), value: weekRange(0) },
    { label: t('presets.lastWeek', { defaultValue: 'Last week' }), value: weekRange(-1) },
    { label: t('presets.thisMonth', { defaultValue: 'This month' }), value: monthRange(0) },
    { label: t('presets.lastMonth', { defaultValue: 'Last month' }), value: monthRange(-1) },
    { label: t('presets.thisYear', { defaultValue: 'This year' }), value: [dayjs().startOf('year'), dayjs().endOf('year')] as [Dayjs, Dayjs] },
  ];

  const columns: ColumnsType<AuditEvent> = [
    {
      key: 'when',
      title: t('columns.when', { defaultValue: 'When' }),
      render: (_value, event) => (
        <Flex align="baseline" gap={6} style={{ whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{formatPortalDate(event.at, i18n.language)}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {formatPortalTime(event.at, i18n.language)}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'actor',
      title: t('columns.actor', { defaultValue: 'Actor' }),
      render: (_value, event) => (
        <Flex align="center" gap={6} wrap="wrap">
          <strong style={{ fontSize: 13 }}>{event.actor}</strong>
          <StatusTag tone={event.side === 'client' ? 'purple' : 'gray'}>
            {event.side === 'client'
              ? t('sideClient', { defaultValue: 'Client' })
              : t('sideInternal', { defaultValue: 'Internal' })}
          </StatusTag>
        </Flex>
      ),
    },
    {
      key: 'event',
      title: t('columns.event', { defaultValue: 'Event' }),
      render: (_value, event) => <span style={{ fontSize: 13 }}>{event.event}</span>,
    },
    {
      key: 'target',
      title: t('columns.target', { defaultValue: 'Target' }),
      render: (_value, event) => {
        const details = parseAuditTarget(event).map(item => ({
          label: t(item.key, { defaultValue: item.defaultValue }),
          value: item.value,
        }));
        const fullText = details.map(item => `${item.label}: ${item.value}`).join(' · ');
        // One line, clipped with an ellipsis; hovering shows the whole value.
        return (
          <Tooltip title={fullText} placement="topLeft">
            <span style={TARGET_CELL_STYLE}>
              {details.map((item, index) => (
                <span key={item.label}>
                  {index > 0 && <Typography.Text type="secondary"> · </Typography.Text>}
                  <Typography.Text type="secondary">{item.label}: </Typography.Text>
                  {item.value}
                </span>
              ))}
            </span>
          </Tooltip>
        );
      },
    },
    {
      key: 'client',
      title: t('columns.client', { defaultValue: 'Client' }),
      render: (_value, event) => event.organization_name ?? '—',
    },
  ];

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <Flex justify="space-between" align="flex-start" gap={12} wrap="wrap" style={{ marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0, fontSize: 22 }}>
            {t('title', { defaultValue: 'Audit Log' })}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('description', {
              defaultValue: 'Every important client and internal action, timestamped and attributed to a user.',
            })}
          </Typography.Text>
        </div>
      </Flex>

      <PortalListToolbar
        controls={
          <>
            <PortalFilterButton
              groups={filterGroups}
              onClear={clearFilters}
              isExtraActive={range !== null}
              extra={
                <div style={{ marginTop: 14 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
                    {t('dateFilter', { defaultValue: 'Date range' })}
                  </Typography.Text>
                  <DatePicker.RangePicker
                    allowClear
                    value={range}
                    presets={datePresets}
                    onChange={value => setRange(value?.[0] && value[1] ? [value[0], value[1]] : null)}
                    placeholder={[t('dateFrom', { defaultValue: 'From' }), t('dateTo', { defaultValue: 'To' })]}
                    aria-label={t('dateFilter', { defaultValue: 'Date range' })}
                    style={{ width: '100%' }}
                  />
                </div>
              }
            />
            <PortalFieldsButton fields={fields} hidden={columnVisibility.hidden} onToggle={columnVisibility.toggle} />
            <Dropdown menu={{ items: exportItems }} trigger={['click']} placement="bottomRight">
              <Button type="primary" icon={<DownloadOutlined />} style={PORTAL_TOOLBAR_BUTTON_STYLE}>
                {t('exportCsv', { defaultValue: 'Export CSV' })}
              </Button>
            </Dropdown>
          </>
        }
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('search', { defaultValue: 'Search actor, event or target…' })}
        searchLabel={t('searchLabel', { defaultValue: 'Search the audit log' })}
      />

      <PortalPagedTable<AuditEvent>
        ariaLabel={t('tableLabel', { defaultValue: 'Audit events' })}
        columns={columnVisibility.visibleColumns(columns)}
        rows={list?.items ?? []}
        rowKey={event => event.id}
        total={list?.total ?? 0}
        paging={paging}
        loading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        emptyText={
          hasFilters
            ? t('emptyFiltered', { defaultValue: 'No events match these filters.' })
            : t('empty', { defaultValue: 'No events yet. Client and team actions appear here as they happen.' })
        }
      />

      <Typography.Paragraph type="secondary" style={{ fontSize: 11.5, marginTop: 10 }}>
        <span style={{ color: token.colorTextTertiary }}>
          {t('footnote', {
            defaultValue:
              'The log cannot be edited or deleted. It never stores comment text or internal notes, and client sign-ins are not logged.',
          })}
        </span>
      </Typography.Paragraph>
    </div>
  );
};

export default AuditLogPage;
