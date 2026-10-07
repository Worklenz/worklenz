import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  DownOutlined,
  Empty,
  Flex,
  Input,
  Modal,
  Result,
  RightOutlined,
  SearchOutlined,
  Segmented,
  Spin,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useEnsureProjectEpics } from '@/hooks/useEnsureProjectEpics';
import { projectReleasesApiService } from '@/api/project-releases/project-releases.api.service';
import { upsertRelease } from '@/features/projects/singleProject/releases/releases.slice';
import { IProjectEpic } from '@/types/project/projectEpic.types';
import { IProjectRelease, IReleaseWorkItem } from '@/types/project/projectRelease.types';
import { isAnnouncedApiError } from './release-utils';
import { WorkItemStatus, WorkItemSummary } from './release-work-item-parts';

type PickerTab = 'items' | 'epics';

interface ReleaseWorkPickerModalProps {
  open: boolean;
  projectId: string;
  release: IProjectRelease | null;
  onClose: () => void;
  onAdded: () => void;
}

export const ReleaseWorkPickerModal = ({
  open,
  projectId,
  release,
  onClose,
  onAdded,
}: ReleaseWorkPickerModalProps) => {
  const { t } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) setSelectedIds(new Set());
  }, [open]);

  const handleSubmit = async () => {
    if (!release || !selectedIds.size) return;
    setIsSaving(true);
    try {
      const response = await projectReleasesApiService.addItems(
        projectId,
        release.id,
        Array.from(selectedIds)
      );
      if (!response.done || !response.body) return;
      dispatch(upsertRelease(response.body.release));
      message.success(
        t('releaseItemsAdded', {
          defaultValue: '{{count}} work item(s) added',
          count: response.body.added_count,
        })
      );
      onAdded();
    } catch (error) {
      if (!isAnnouncedApiError(error)) {
        message.error(t('releaseItemsAddError', { defaultValue: 'Could not add the work items' }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={780}
      destroyOnHidden
      title={t('releaseAddWorkTitle', {
        defaultValue: 'Add work to {{name}}',
        name: release?.name ?? '',
      })}
      footer={
        <Flex align="center" gap={8}>
          <ReleaseSelectionCount count={selectedIds.size} />
          <Button onClick={onClose}>{t('cancel', { defaultValue: 'Cancel' })}</Button>
          <Button
            type="primary"
            disabled={!selectedIds.size}
            loading={isSaving}
            onClick={handleSubmit}
          >
            {t('releaseAddSelected', { defaultValue: 'Add selected' })}
          </Button>
        </Flex>
      }
    >
      <ReleaseWorkSelector
        projectId={projectId}
        isActive={open}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        autoFocusSearch
      />
    </Modal>
  );
};

export const ReleaseSelectionCount = ({ count }: { count: number }) => {
  const { t } = useTranslation('project-view');
  return (
    <Typography.Text type="secondary" className="text-xs mr-auto" aria-live="polite">
      {t('releaseSelectedCount', { defaultValue: '{{count}} selected', count })}
    </Typography.Text>
  );
};

interface ReleaseWorkSelectorProps {
  projectId: string;
  /** Loads available work and resets search/tabs each time this becomes true. */
  isActive: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  autoFocusSearch?: boolean;
  listMaxHeight?: number;
}

/** Search + Work items / Epics tabs for choosing work that is not yet in a release. */
export const ReleaseWorkSelector = ({
  projectId,
  isActive,
  selectedIds,
  onSelectionChange,
  autoFocusSearch = false,
  listMaxHeight = 360,
}: ReleaseWorkSelectorProps) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  useEnsureProjectEpics(isActive ? projectId : null);
  const epics = useAppSelector(state => state.epicsReducer.epics);

  const [availableItems, setAvailableItems] = useState<IReleaseWorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [activeTab, setActiveTab] = useState<PickerTab>('items');
  const [query, setQuery] = useState('');
  const [expandedEpicIds, setExpandedEpicIds] = useState<Set<string>>(new Set());

  const loadAvailableItems = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await projectReleasesApiService.getAvailableItems(projectId);
      if (!response.done) throw new Error(response.message);
      setAvailableItems(response.body ?? []);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isActive) return;
    setActiveTab('items');
    setQuery('');
    setExpandedEpicIds(new Set());
    void loadAvailableItems();
  }, [isActive, loadAvailableItems]);

  const normalizedQuery = query.trim().toLowerCase();

  const visibleItems = useMemo(
    () => availableItems.filter(item => matchesQuery(getItemSearchText(item), normalizedQuery)),
    [availableItems, normalizedQuery]
  );

  const epicGroups = useMemo(
    () =>
      epics
        .filter(epic => !epic.is_archived)
        .map(epic => ({
          epic,
          eligibleItems: availableItems.filter(item => item.epic_id === epic.id),
        }))
        .filter(({ epic, eligibleItems }) =>
          matchesQuery(
            [epic.name, epic.description ?? '', ...eligibleItems.map(getItemSearchText)].join(' '),
            normalizedQuery
          )
        ),
    [availableItems, epics, normalizedQuery]
  );

  const toggleItem = (itemId: string, isChecked: boolean) => {
    const next = new Set(selectedIds);
    if (isChecked) next.add(itemId);
    else next.delete(itemId);
    onSelectionChange(next);
  };

  const toggleEpic = (epicId: string, eligibleItems: IReleaseWorkItem[], isChecked: boolean) => {
    const next = new Set(selectedIds);
    eligibleItems.forEach(item => (isChecked ? next.add(item.id) : next.delete(item.id)));
    onSelectionChange(next);
    if (isChecked) setExpandedEpicIds(current => new Set(current).add(epicId));
  };

  const toggleEpicExpanded = (epicId: string) => {
    setExpandedEpicIds(current => {
      const next = new Set(current);
      if (next.has(epicId)) next.delete(epicId);
      else next.add(epicId);
      return next;
    });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Flex justify="center" className="py-10">
          <Spin />
        </Flex>
      );
    }
    if (hasError) {
      return (
        <Result
          status="warning"
          title={t('releaseAvailableLoadError', { defaultValue: 'Could not load available work' })}
          extra={
            <Button onClick={() => void loadAvailableItems()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      );
    }
    if (activeTab === 'items') {
      if (!visibleItems.length) {
        return (
          <PickerEmpty
            title={t('releaseNoAvailableWork', { defaultValue: 'No available work' })}
            hint={t('releaseNoAvailableWorkHint', {
              defaultValue: "Try another search or use a work item's Release field to reassign it.",
            })}
          />
        );
      }
      return visibleItems.map(item => (
        <PickerItemRow
          key={item.id}
          item={item}
          isChecked={selectedIds.has(item.id)}
          onToggle={toggleItem}
        />
      ));
    }

    return (
      <>
        <Typography.Text
          type="secondary"
          className="block px-3 py-2.5 text-xs"
          style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}
        >
          {t('releaseEpicPickerHint', {
            defaultValue:
              'Selecting an Epic selects its eligible child work. Expand it to review or exclude items.',
          })}
        </Typography.Text>
        {epicGroups.length ? (
          epicGroups.map(({ epic, eligibleItems }) => (
            <PickerEpicGroup
              key={epic.id}
              epic={epic}
              eligibleItems={eligibleItems}
              selectedIds={selectedIds}
              isExpanded={expandedEpicIds.has(epic.id)}
              onToggleEpic={toggleEpic}
              onToggleExpanded={toggleEpicExpanded}
              onToggleItem={toggleItem}
            />
          ))
        ) : (
          <PickerEmpty
            title={t('releaseNoMatchingEpics', { defaultValue: 'No matching Epics' })}
            hint={t('releaseTryAnotherSearch', { defaultValue: 'Try another search.' })}
          />
        )}
      </>
    );
  };

  return (
    <div>
      <Input
        allowClear
        autoFocus={autoFocusSearch}
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder={t('releasePickerSearchPlaceholder', {
          defaultValue: 'Search by key, summary, or Epic…',
        })}
        aria-label={t('releasePickerSearchAria', {
          defaultValue: 'Search available work or Epics',
        })}
        className="mb-3"
      />
      <Segmented<PickerTab>
        value={activeTab}
        onChange={setActiveTab}
        className="mb-3"
        options={[
          { value: 'items', label: t('releasePickerTabItems', { defaultValue: 'Work items' }) },
          { value: 'epics', label: t('releasePickerTabEpics', { defaultValue: 'Epics' }) },
        ]}
      />
      <div
        className="overflow-auto rounded-lg"
        style={{ maxHeight: listMaxHeight, border: `1px solid ${token.colorBorderSecondary}` }}
      >
        {renderContent()}
      </div>
    </div>
  );
};

interface PickerItemRowProps {
  item: IReleaseWorkItem;
  isChecked: boolean;
  isNested?: boolean;
  onToggle: (itemId: string, isChecked: boolean) => void;
}

const PickerItemRow = ({ item, isChecked, isNested = false, onToggle }: PickerItemRowProps) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  return (
    <Checkbox
      checked={isChecked}
      onChange={event => onToggle(item.id, event.target.checked)}
      className="flex w-full items-center m-0 px-3 [&>span:last-child]:flex-1 [&>span:last-child]:min-w-0"
      style={{
        minHeight: isNested ? 42 : 48,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <span className="grid w-full items-center gap-2.5 grid-cols-[minmax(0,1fr)_110px_110px]">
        <WorkItemSummary item={item} />
        <WorkItemStatus item={item} />
        <Typography.Text type="secondary" className="truncate text-xs">
          {item.sprint_name ?? t('backlog', { defaultValue: 'Backlog' })}
        </Typography.Text>
      </span>
    </Checkbox>
  );
};

interface PickerEpicGroupProps {
  epic: IProjectEpic;
  eligibleItems: IReleaseWorkItem[];
  selectedIds: Set<string>;
  isExpanded: boolean;
  onToggleEpic: (epicId: string, eligibleItems: IReleaseWorkItem[], isChecked: boolean) => void;
  onToggleExpanded: (epicId: string) => void;
  onToggleItem: (itemId: string, isChecked: boolean) => void;
}

const PickerEpicGroup = ({
  epic,
  eligibleItems,
  selectedIds,
  isExpanded,
  onToggleEpic,
  onToggleExpanded,
  onToggleItem,
}: PickerEpicGroupProps) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const selectedCount = eligibleItems.filter(item => selectedIds.has(item.id)).length;
  const isAllSelected = eligibleItems.length > 0 && selectedCount === eligibleItems.length;
  const unavailableCount = Math.max(epic.issue_count - eligibleItems.length, 0);
  const expandLabel = isExpanded
    ? t('releaseCollapseEpic', { defaultValue: 'Collapse {{name}}', name: epic.name })
    : t('releaseExpandEpic', { defaultValue: 'Expand {{name}}', name: epic.name });

  return (
    <section style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <div className="grid items-center gap-2 px-3 py-1.5 min-h-[58px] grid-cols-[24px_28px_minmax(0,1fr)_150px]">
        <Checkbox
          checked={isAllSelected}
          indeterminate={selectedCount > 0 && !isAllSelected}
          disabled={!eligibleItems.length}
          onChange={event => onToggleEpic(epic.id, eligibleItems, event.target.checked)}
          aria-label={t('releaseSelectEpic', {
            defaultValue: 'Select eligible work in {{name}}',
            name: epic.name,
          })}
        />
        <Button
          type="text"
          size="small"
          icon={isExpanded ? <DownOutlined /> : <RightOutlined />}
          onClick={() => onToggleExpanded(epic.id)}
          aria-expanded={isExpanded}
          aria-label={expandLabel}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            <span
              aria-hidden="true"
              className="inline-block w-2.5 h-2.5 rounded-sm flex-none"
              style={{ backgroundColor: epic.color_code }}
            />
            <span className="truncate">{epic.name}</span>
          </div>
          {epic.description && (
            <Typography.Text type="secondary" className="block truncate text-[11px] ml-[18px]">
              {epic.description}
            </Typography.Text>
          )}
        </div>
        <div className="text-right text-[11px]" style={{ color: token.colorTextSecondary }}>
          <strong style={{ color: token.colorText }}>
            {t('releaseEligibleCount', {
              defaultValue: '{{count}} eligible',
              count: eligibleItems.length,
            })}
          </strong>
          {unavailableCount > 0 &&
            ` · ${t('releaseUnavailableCount', {
              defaultValue: '{{count}} unavailable',
              count: unavailableCount,
            })}`}
        </div>
      </div>
      {isExpanded && (
        <div className="pl-[52px]" style={{ background: token.colorFillQuaternary }}>
          {eligibleItems.length ? (
            eligibleItems.map(item => (
              <PickerItemRow
                key={item.id}
                item={item}
                isNested
                isChecked={selectedIds.has(item.id)}
                onToggle={onToggleItem}
              />
            ))
          ) : (
            <Typography.Text type="secondary" className="block p-3 text-xs">
              {t('releaseNoEligibleChildren', { defaultValue: 'No eligible child work.' })}
            </Typography.Text>
          )}
        </div>
      )}
    </section>
  );
};

const PickerEmpty = ({ title, hint }: { title: string; hint: string }) => (
  <Empty
    className="py-8"
    image={Empty.PRESENTED_IMAGE_SIMPLE}
    description={
      <Flex vertical gap={2}>
        <strong>{title}</strong>
        <Typography.Text type="secondary" className="text-xs">
          {hint}
        </Typography.Text>
      </Flex>
    }
  />
);

const getItemSearchText = (item: IReleaseWorkItem): string =>
  [item.task_key, item.name, item.epic_name ?? ''].join(' ');

const matchesQuery = (text: string, normalizedQuery: string): boolean =>
  !normalizedQuery || text.toLowerCase().includes(normalizedQuery);
