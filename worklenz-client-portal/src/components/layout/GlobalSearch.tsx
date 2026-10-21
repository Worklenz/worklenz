import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Flex, Input, Modal, Typography, SearchOutlined, theme } from '@/shared/antd-imports';
import type { InputRef } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { clientPortalV2Api, useGetApprovalsQuery, useGetChangeRequestsQuery, useGetOrgUsersQuery, useGetProjectsV2Query } from '@/store/api-v2';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { targetPath } from '@/utils/targets';
import type { ClientTaskV2 } from '@/types/v2';

const MAX_PER_GROUP = 5;

type GroupKey = 'projects' | 'tasks' | 'approvals' | 'changeRequests' | 'members';

interface SearchHit {
  key: string;
  group: GroupKey;
  title: string;
  subtitle: string | null;
  /** The id-like label (ref number, task key) shown on the right. */
  reference: string | null;
  path: string;
}

const GROUP_ORDER: GroupKey[] = ['projects', 'tasks', 'approvals', 'changeRequests', 'members'];
const GROUP_LABELS: Record<GroupKey, { key: string; defaultValue: string }> = {
  projects: { key: 'search.groups.projects', defaultValue: 'Projects' },
  tasks: { key: 'search.groups.tasks', defaultValue: 'Tasks' },
  approvals: { key: 'search.groups.approvals', defaultValue: 'Approvals' },
  changeRequests: { key: 'search.groups.changeRequests', defaultValue: 'Change requests' },
  members: { key: 'search.groups.members', defaultValue: 'Members' },
};

const matches = (needle: string, ...fields: Array<string | null | undefined>): boolean =>
  fields.some(field => field?.toLowerCase().includes(needle));

/**
 * Everything the portal already loads for this client, searchable in one place by name, title, id or
 * reference number. Tasks are per project on the server, so they are fetched (once, then cached) the
 * first time the search is used.
 */
const useSearchHits = (query: string, enabled: boolean): SearchHit[] => {
  const dispatch = useAppDispatch();
  const { data: projects } = useGetProjectsV2Query(undefined, { skip: !enabled });
  const { data: approvals } = useGetApprovalsQuery(undefined, { skip: !enabled });
  const { data: changeRequests } = useGetChangeRequestsQuery(undefined, { skip: !enabled });
  const { data: members } = useGetOrgUsersQuery(undefined, { skip: !enabled });
  const [tasksByProject, setTasksByProject] = useState<Record<string, ClientTaskV2[]>>({});

  useEffect(() => {
    if (!enabled || !projects) return;
    const subscriptions = projects.map(project => {
      const subscription = dispatch(clientPortalV2Api.endpoints.getTasks.initiate(project.id));
      void subscription.then(result => {
        if (result.data) setTasksByProject(current => ({ ...current, [project.id]: result.data ?? [] }));
      });
      return subscription;
    });
    return () => subscriptions.forEach(subscription => subscription.unsubscribe());
  }, [dispatch, enabled, projects]);

  return useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const hits: SearchHit[] = [];

    (projects ?? []).forEach(project => {
      if (!matches(needle, project.id, project.name, project.primary_contact, project.phase)) return;
      hits.push({
        key: `project-${project.id}`,
        group: 'projects',
        title: decodeHtmlEntities(project.name),
        subtitle: project.phase ? decodeHtmlEntities(project.phase) : null,
        reference: null,
        path: `/projects/${project.id}`,
      });
    });
    (projects ?? []).forEach(project => {
      (tasksByProject[project.id] ?? []).forEach(task => {
        if (!matches(needle, task.id, task.key, task.title)) return;
        hits.push({
          key: `task-${task.id}`,
          group: 'tasks',
          title: decodeHtmlEntities(task.title),
          subtitle: decodeHtmlEntities(project.name),
          reference: task.key,
          path: targetPath({ page: 'task', projectId: project.id, id: task.id }),
        });
      });
    });
    (approvals ?? []).forEach(approval => {
      if (!matches(needle, approval.id, approval.ref_no, approval.title, approval.project_name, approval.approver_name)) return;
      hits.push({
        key: `approval-${approval.id}`,
        group: 'approvals',
        title: decodeHtmlEntities(approval.title),
        subtitle: approval.project_name ? decodeHtmlEntities(approval.project_name) : null,
        reference: approval.ref_no,
        path: `/approvals/${approval.id}`,
      });
    });
    (changeRequests ?? []).forEach(request => {
      if (!matches(needle, request.id, request.cr_no, request.title, request.project_name, request.requester_name)) return;
      hits.push({
        key: `cr-${request.id}`,
        group: 'changeRequests',
        title: decodeHtmlEntities(request.title),
        subtitle: request.project_name ? decodeHtmlEntities(request.project_name) : null,
        reference: request.cr_no,
        path: `/change-requests/${request.id}`,
      });
    });
    (members ?? []).forEach(member => {
      if (!matches(needle, member.id, member.name, member.email)) return;
      hits.push({
        key: `member-${member.id}`,
        group: 'members',
        title: decodeHtmlEntities(member.name),
        subtitle: member.email,
        reference: null,
        path: '/settings/members',
      });
    });
    return hits;
  }, [query, projects, tasksByProject, approvals, changeRequests, members]);
};

interface ResultsProps {
  hits: SearchHit[];
  query: string;
  activeKey: string | null;
  onPick: (hit: SearchHit) => void;
  onHover: (key: string) => void;
}

const Results = ({ hits, query, activeKey, onPick, onHover }: ResultsProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  if (!query.trim()) {
    return (
      <div style={{ padding: 16 }}>
        <Typography.Text type="secondary">
          {t('search.hint', { defaultValue: 'Search projects, tasks, approvals, change requests and members by name or ID.' })}
        </Typography.Text>
      </div>
    );
  }
  if (hits.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <Typography.Text type="secondary">{t('search.empty', { defaultValue: 'No results found' })}</Typography.Text>
      </div>
    );
  }

  return (
    <div role="listbox" style={{ maxHeight: 'min(440px, calc(100vh - 140px))', overflowY: 'auto' }}>
      {GROUP_ORDER.map(group => {
        const inGroup = hits.filter(hit => hit.group === group);
        if (inGroup.length === 0) return null;
        const label = GROUP_LABELS[group];
        return (
          <div key={group}>
            <div style={{ padding: '8px 16px 4px', fontSize: 12, fontWeight: 500, color: token.colorTextSecondary }}>
              {t(label.key, { defaultValue: label.defaultValue })}
            </div>
            {inGroup.slice(0, MAX_PER_GROUP).map(hit => (
              <button
                key={hit.key}
                type="button"
                role="option"
                aria-selected={hit.key === activeKey}
                onMouseEnter={() => onHover(hit.key)}
                onClick={() => onPick(hit)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 16px',
                  border: 0,
                  textAlign: 'start',
                  cursor: 'pointer',
                  color: token.colorText,
                  background: hit.key === activeKey ? 'var(--portal-brand-tint)' : 'transparent',
                }}
              >
                <Flex justify="space-between" align="center" gap={12}>
                  <Flex vertical style={{ minWidth: 0 }}>
                    <Typography.Text ellipsis>{hit.title}</Typography.Text>
                    {hit.subtitle && (
                      <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                        {hit.subtitle}
                      </Typography.Text>
                    )}
                  </Flex>
                  {hit.reference && (
                    <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                      {hit.reference}
                    </Typography.Text>
                  )}
                </Flex>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
};

interface GlobalSearchProps {
  /** On phones the search is an icon that opens a dialog, as there is no room for the field. */
  isMobile: boolean;
}

/** Top bar search across projects, tasks, approvals, change requests and members. */
export const GlobalSearch = ({ isMobile }: GlobalSearchProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const inputRef = useRef<InputRef>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const hits = useSearchHits(query, open);

  // The keyboard walks the visible rows in the order they are drawn: group by group, five per group.
  const visibleHits = useMemo(
    () => GROUP_ORDER.flatMap(group => hits.filter(hit => hit.group === group).slice(0, MAX_PER_GROUP)),
    [hits]
  );

  useEffect(() => {
    setActiveKey(visibleHits[0]?.key ?? null);
  }, [visibleHits]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (hit: SearchHit) => {
    close();
    navigate(hit.path);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
      inputRef.current?.blur();
      return;
    }
    if (visibleHits.length === 0) return;
    const index = visibleHits.findIndex(hit => hit.key === activeKey);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveKey(visibleHits[(index + 1) % visibleHits.length].key);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveKey(visibleHits[(index - 1 + visibleHits.length) % visibleHits.length].key);
    } else if (event.key === 'Enter') {
      const hit = visibleHits[Math.max(index, 0)];
      if (hit) pick(hit);
    }
  };

  const searchLabel = t('search.label', { defaultValue: 'Search the portal' });
  const field = (
    <Input
      ref={inputRef}
      allowClear
      value={query}
      placeholder={t('search.placeholder', { defaultValue: 'Search...' })}
      aria-label={searchLabel}
      prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
      onChange={event => {
        setQuery(event.target.value);
        setOpen(true);
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={onKeyDown}
      style={{ width: isMobile ? '100%' : 240, borderRadius: '50rem', background: 'transparent', borderColor: token.colorBorder }}
    />
  );
  const results = <Results hits={hits} query={query} activeKey={activeKey} onPick={pick} onHover={setActiveKey} />;

  if (isMobile) {
    return (
      <>
        <Button type="text" shape="circle" icon={<SearchOutlined style={{ fontSize: 18 }} />} aria-label={searchLabel} onClick={() => setOpen(true)} />
        <Modal
          open={open}
          onCancel={close}
          footer={null}
          closable={false}
          destroyOnClose
          style={{ top: 16 }}
          afterOpenChange={visible => visible && inputRef.current?.focus()}
        >
          <div style={{ marginBottom: 8 }}>{field}</div>
          {results}
        </Modal>
      </>
    );
  }

  return (
    <Dropdown
      open={open}
      onOpenChange={next => {
        if (!next) close();
      }}
      trigger={['click']}
      placement="bottomRight"
      popupRender={() => (
        <div
          style={{
            width: 360,
            maxWidth: 'calc(100vw - 24px)',
            overflow: 'hidden',
            background: token.colorBgElevated,
            borderRadius: 12,
            boxShadow: token.boxShadowSecondary,
          }}
        >
          {results}
        </div>
      )}
    >
      <div>{field}</div>
    </Dropdown>
  );
};
