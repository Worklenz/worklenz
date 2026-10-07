import { useEffect, useState } from 'react';
import { Flex, Input, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import PillToggle from '@/pages/home/PillToggle';
import TicketsStats from './TicketsStats';
import TicketsTable from './tickets-table';
import TicketsBoard from './tickets-board';

const { Title } = Typography;

const SEARCH_DEBOUNCE_MS = 300;

const ClientPortalTickets = () => {
  const { t } = useTranslation('client-portal-tickets');
  const [view, setView] = useState<'list' | 'board'>('list');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
  };

  // Search runs on the server, so wait for a pause in typing instead of querying per keystroke.
  useEffect(() => {
    if (searchInput === search) return undefined;
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        maxWidth: '100%',
      }}
    >
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <Title level={4} style={{ margin: 0, fontSize: 22 }}>
          {t('title', { defaultValue: 'Ticketing' })}
        </Title>
        <Typography.Text type="secondary">
          {t('description', { defaultValue: 'Support tickets clients raise from their portal.' })}
        </Typography.Text>
      </div>

      <div style={{ flexShrink: 0 }}>
        <TicketsStats />
      </div>

      <Flex justify="space-between" align="center" wrap="wrap" gap={16} style={{ marginBottom: 16, flexShrink: 0 }}>
        <PillToggle<'list' | 'board'>
          value={view}
          onChange={setView}
          ariaLabel={t('viewToggleLabel', { defaultValue: 'Ticketing view' })}
          options={[
            { value: 'list', label: t('listViewTab', { defaultValue: 'List' }) },
            { value: 'board', label: t('boardViewTab', { defaultValue: 'Board' }) },
          ]}
        />

        {view === 'list' && (
          <Input.Search
            allowClear
            size="small"
            placeholder={t('searchTicketsPlaceholder', { defaultValue: 'Search tickets, clients or subjects...' })}
            aria-label={t('searchTicketsPlaceholder', { defaultValue: 'Search tickets, clients or subjects...' })}
            style={{ width: '100%', maxWidth: 280 }}
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            onSearch={value => {
              setSearchInput(value);
              setSearch(value);
            }}
          />
        )}
      </Flex>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'list' ? (
          <TicketsTable search={search} onClearSearch={clearSearch} />
        ) : (
          <TicketsBoard />
        )}
      </div>

      {/* tickets/:id renders here as a modal over this list/board, so a direct or shared link
          still shows the queue underneath it instead of a blank page. */}
      <Outlet />
    </div>
  );
};

export default ClientPortalTickets;
