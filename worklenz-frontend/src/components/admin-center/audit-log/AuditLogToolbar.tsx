import React from 'react';
import { Button, Flex, Input, theme } from '@/shared/antd-imports';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { TimeLogsDatePresetPill } from '@/pages/reporting/time-sheets/components/time-logs/TimeLogsDatePresetPill';
import type { TimeLogsDatePreset } from '@/pages/reporting/time-sheets/components/time-logs/time-logs-filters';
import {
  FILTER_PILL_BUTTON_STYLE,
  MultiSelectFilterPill,
} from '@/components/common/filters/MultiSelectFilterPill';
import { useGetAuditLogActorsQuery } from '@/api/admin-center/audit-log.api.service';
import {
  AUDIT_EVENT_CATEGORY_LIST,
  AUDIT_LOG_I18N_NAMESPACE,
  AuditEventCategoryId,
} from '@/shared/audit-log-constants';
import { IAuditLogActorOption, IAuditLogSummary } from '@/types/admin-center/audit-log.types';
import { IAuditLogFilterState } from '@/features/admin-center/audit-log/audit-log-filters';
import { getCategoryChipLabel, getCategoryTokenColor } from './audit-log-display';

const SEARCH_DEBOUNCE_MS = 300;

interface AuditLogToolbarProps {
  filters: IAuditLogFilterState;
  summary: IAuditLogSummary | undefined;
  onSearchChange: (search: string) => void;
  onDateChange: (datePreset: TimeLogsDatePreset, customRange: [string, string] | null) => void;
  onCategoriesChange: (categories: AuditEventCategoryId[]) => void;
  onActorsChange: (actorUserIds: string[]) => void;
  onExport: () => void;
  isExporting: boolean;
  /** A background export is already running for this workspace. */
  isExportBlocked: boolean;
}

export const AuditLogToolbar: React.FC<AuditLogToolbarProps> = ({
  filters,
  summary,
  onSearchChange,
  onDateChange,
  onCategoriesChange,
  onActorsChange,
  onExport,
  isExporting,
  isExportBlocked,
}) => {
  const { t } = useTranslation(AUDIT_LOG_I18N_NAMESPACE);

  return (
    <Flex vertical gap={12}>
      <Flex gap={8} wrap="wrap" align="center">
        <AuditLogSearchInput value={filters.search} onChange={onSearchChange} />
        <TimeLogsDatePresetPill
          datePreset={filters.datePreset}
          customRange={filters.customRange}
          onChange={onDateChange}
          allowedPresets={['last_7_days', 'last_30_days', 'last_90_days', 'all_time']}
        />
        <AuditLogActorFilter value={filters.actorUserIds} onChange={onActorsChange} />
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={onExport}
          loading={isExporting}
          disabled={isExportBlocked}
          style={{ ...FILTER_PILL_BUTTON_STYLE, marginInlineStart: 'auto' }}
        >
          {t('exportCsv', { defaultValue: 'Export to CSV' })}
        </Button>
      </Flex>
      <AuditLogCategoryChips value={filters.categories} summary={summary} onChange={onCategoriesChange} />
    </Flex>
  );
};

interface AuditLogSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

const AuditLogSearchInput: React.FC<AuditLogSearchInputProps> = ({ value, onChange }) => {
  const { t } = useTranslation(AUDIT_LOG_I18N_NAMESPACE);
  const [draft, setDraft] = React.useState(value);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmittedRef = React.useRef(value);

  // Follow resets coming from outside (e.g. "Clear filters"), not our own debounced echo.
  React.useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      setDraft(value);
    }
  }, [value]);

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleChange = (next: string) => {
    setDraft(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastEmittedRef.current = next;
      onChange(next);
    }, SEARCH_DEBOUNCE_MS);
  };

  const placeholder = t('searchPlaceholder', { defaultValue: 'Search actor or event…' });

  return (
    <Input
      prefix={<SearchOutlined />}
      placeholder={placeholder}
      aria-label={placeholder}
      value={draft}
      onChange={e => handleChange(e.target.value)}
      allowClear
      style={{ width: 260, maxWidth: '100%', ...FILTER_PILL_BUTTON_STYLE, paddingInline: 11 }}
    />
  );
};

interface AuditLogActorFilterProps {
  value: string[];
  onChange: (value: string[]) => void;
}

const AuditLogActorFilter: React.FC<AuditLogActorFilterProps> = ({ value, onChange }) => {
  const { t } = useTranslation(AUDIT_LOG_I18N_NAMESPACE);
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [knownActors, setKnownActors] = React.useState<Record<string, string>>({});
  const { data: options = [], isFetching } = useGetAuditLogActorsQuery(debouncedSearch);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    if (!options.length) return;
    setKnownActors(prev => ({
      ...prev,
      ...Object.fromEntries(options.map(option => [option.value, option.label])),
    }));
  }, [options]);

  // Keep selected actors listed, so they can still be unticked, when the current search no longer returns them.
  const mergedOptions: IAuditLogActorOption[] = [
    ...value
      .filter(id => !options.some(option => option.value === id))
      .map(id => ({ value: id, label: knownActors[id] ?? id })),
    ...options,
  ];

  return (
    <MultiSelectFilterPill
      label={t('actorFilterLabel', { defaultValue: 'Actors' })}
      options={mergedOptions}
      value={value}
      onChange={onChange}
      onSearchChange={setSearch}
      loading={isFetching && !options.length}
      searchPlaceholder={t('actorSearchPlaceholder', { defaultValue: 'Search workspace users' })}
      emptyText={t('actorNoMatches', { defaultValue: 'No users match' })}
    />
  );
};

interface AuditLogCategoryChipsProps {
  value: AuditEventCategoryId[];
  summary: IAuditLogSummary | undefined;
  onChange: (value: AuditEventCategoryId[]) => void;
}

/** "All" plus one toggle per category (multi-select), each with its count from the summary. */
const AuditLogCategoryChips: React.FC<AuditLogCategoryChipsProps> = ({ value, summary, onChange }) => {
  const { t } = useTranslation(AUDIT_LOG_I18N_NAMESPACE);
  const { token } = theme.useToken();

  const handleToggle = (category: AuditEventCategoryId) => {
    onChange(value.includes(category) ? value.filter(c => c !== category) : [...value, category]);
  };

  const chips = [
    {
      key: 'all',
      label: t('chipAll', { defaultValue: 'All' }),
      count: summary?.total,
      active: value.length === 0,
      color: token.colorPrimary,
      onClick: () => onChange([]),
    },
    ...AUDIT_EVENT_CATEGORY_LIST.map(category => ({
      key: category.id,
      label: getCategoryChipLabel(t, category.id),
      count: summary?.by_category[category.id],
      active: value.includes(category.id),
      color: getCategoryTokenColor(category.id, token),
      onClick: () => handleToggle(category.id),
    })),
  ];

  return (
    <Flex
      gap={6}
      wrap="wrap"
      role="group"
      aria-label={t('categoryFilterLabel', { defaultValue: 'Filter by category' })}
    >
      {chips.map(chip => (
        <Button
          key={chip.key}
          size="small"
          shape="round"
          aria-pressed={chip.active}
          onClick={chip.onClick}
          style={
            chip.active
              ? { background: chip.color, borderColor: chip.color, color: token.colorTextLightSolid }
              : { color: token.colorTextSecondary }
          }
        >
          {chip.label}
          {chip.count !== undefined && <span style={{ fontWeight: 700, opacity: 0.85 }}>{chip.count}</span>}
        </Button>
      ))}
    </Flex>
  );
};
