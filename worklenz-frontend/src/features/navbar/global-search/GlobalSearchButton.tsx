import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  Input,
  Spin,
  theme,
  Tooltip,
  SearchOutlined,
  ProjectOutlined,
  TeamOutlined,
  UserOutlined,
  CheckCircleOutlined,
} from '@/shared/antd-imports';
import type { InputRef } from '@/shared/antd-imports';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { clientsApiService } from '@/api/clients/clients.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { useTooltipTheme } from '@/hooks/useTooltipTheme';
import { useTranslation } from 'react-i18next';
import '@/features/navbar/navbar-icon-hover.css';

const { useToken } = theme;

type ResultType = 'Project' | 'Client' | 'Member' | 'Task';

interface SearchResult {
  type: ResultType;
  id: string;
  name: string;
  sub?: string;
  projectId?: string;
}

const TYPE_ICON: Record<ResultType, React.ReactNode> = {
  Project: <ProjectOutlined />,
  Client: <UserOutlined />,
  Member: <TeamOutlined />,
  Task: <CheckCircleOutlined />,
};

const GlobalSearchButton: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useToken();
  const { t } = useTranslation('navbar');
  const { tooltipProps } = useTooltipTheme();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const inputRef = useRef<InputRef>(null);

  const runSearch = async (q: string) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const [projectsRes, clientsRes, membersRes, tasksRes] = await Promise.allSettled([
        projectsApiService.getProjects(1, 5, null, null, q),
        clientsApiService.getClients(1, 5, null, null, q),
        teamMembersApiService.get(1, 5, null, null, q),
        tasksApiService.searchTasks(1, 5, q),
      ]);

      if (requestId !== requestIdRef.current) return;

      const next: SearchResult[] = [];

      if (projectsRes.status === 'fulfilled') {
        for (const p of projectsRes.value.body?.data ?? []) {
          if (p.id && p.name) next.push({ type: 'Project', id: p.id, name: p.name });
        }
      }
      if (clientsRes.status === 'fulfilled') {
        for (const c of clientsRes.value.body?.data ?? []) {
          if (c.id && c.name) {
            next.push({
              type: 'Client',
              id: c.id,
              name: c.name,
              sub: c.projects_count ? `${c.projects_count} projects` : undefined,
            });
          }
        }
      }
      if (membersRes.status === 'fulfilled') {
        for (const m of membersRes.value.body?.data ?? []) {
          if (m.id && m.name) next.push({ type: 'Member', id: m.id, name: m.name, sub: m.role_name });
        }
      }
      if (tasksRes.status === 'fulfilled') {
        for (const t of tasksRes.value.body?.data ?? []) {
          if (t.id && t.name) {
            next.push({
              type: 'Task',
              id: t.id,
              name: t.name,
              sub: t.project_name,
              projectId: t.project_id,
            });
          }
        }
      }

      setResults(next);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(query.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const closeAndReset = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const handleResultClick = (result: SearchResult) => {
    closeAndReset();
    switch (result.type) {
      case 'Project':
        navigate(`/worklenz/projects/${result.id}?tab=tasks-list&pinned_tab=tasks-list`);
        break;
      case 'Client':
        navigate('/worklenz/settings/clients');
        break;
      case 'Member':
        navigate('/worklenz/settings/team-members');
        break;
      case 'Task':
        if (result.projectId) {
          navigate(
            `/worklenz/projects/${result.projectId}?tab=tasks-list&pinned_tab=tasks-list&task=${result.id}&task_project=${result.projectId}`
          );
        }
        break;
    }
  };

  return (
    <>
      <Tooltip title={t('searchAnything', { defaultValue: 'Search anything' })} {...tooltipProps}>
        <button className="navbar-icon-hover" onClick={() => setOpen(true)}>
          <SearchOutlined style={{ fontSize: 20 }} />
        </button>
      </Tooltip>

      <Modal
        open={open}
        onCancel={closeAndReset}
        footer={null}
        closable={false}
        width={560}
        style={{ top: 80 }}
        styles={{ body: { padding: 16 } }}
        afterOpenChange={visible => {
          if (visible) inputRef.current?.focus();
        }}
      >
        <Input
          ref={inputRef}
          autoFocus
          size="large"
          allowClear
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder={t('globalSearchPlaceholder', { defaultValue: 'Search tasks, projects, clients, members…' })}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        {loading && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin size="small" />
          </div>
        )}

        {!loading && results.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {results.map(r => (
              <div
                key={`${r.type}-${r.id}`}
                onClick={() => handleResultClick(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 8px',
                  cursor: 'pointer',
                  borderRadius: 6,
                  lineHeight: 'normal',
                }}
                onMouseEnter={e =>
                  ((e.currentTarget as HTMLDivElement).style.background = token.colorFillTertiary)
                }
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
              >
                <span style={{ color: token.colorTextSecondary }}>{TYPE_ICON[r.type]}</span>
                <span style={{ fontSize: 13 }}>
                  <span style={{ opacity: 0.45, fontSize: 11 }}>{r.type} · </span>
                  {r.name}
                </span>
                {r.sub && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.45 }}>{r.sub}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && query.trim().length > 1 && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, opacity: 0.45, fontSize: 13 }}>
             {t('noResultsFor', { defaultValue: 'No results for "{{query}}"', query: query.trim() })}
          </div>
        )}

      </Modal>
    </>
  );
};

export default GlobalSearchButton;
