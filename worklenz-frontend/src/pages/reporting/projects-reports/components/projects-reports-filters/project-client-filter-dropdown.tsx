import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  InputRef,
  List,
  Spin,
  theme,
} from '@/shared/antd-imports';
import { CaretDownFilled } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { clientsApiService } from '@/api/clients/clients.api.service';
import { IClient } from '@/types/client.types';
import {
  setSelectedClients,
  toggleClient,
  fetchProjectDataForCurrentView,
} from '@/features/reporting/projectReports/project-reports-slice';

const NO_CLIENT_ID = '__no_client__';

// Debounce delay (ms) for the search input
const SEARCH_DEBOUNCE_MS = 300;

// How many clients to show before requiring the user to search.
// Keeps the initial render fast and the list scannable.
const INITIAL_DISPLAY_LIMIT = 50;

const ProjectClientFilterDropdown = () => {
  const { t } = useTranslation('reporting-projects-filters');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const { mode: themeMode } = useAppSelector(state => state.themeReducer);
  const { selectedClients } = useAppSelector(state => state.projectReportsReducer);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [clients, setClients] = useState<IClient[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<InputRef>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against out-of-order responses: only the response matching the
  // most recently issued request is applied to state.
  const requestIdRef = useRef(0);

  /**
   * Fetch clients from the server. The lookup endpoint supports an optional
   * search term so filtering is always performed against the full dataset —
   * never just the first N records already loaded in memory.
   *
   * On initial open (empty search) we pass a limit so we don't render
   * hundreds of rows into the DOM unprompted. Once the user starts typing,
   * the server filters and the limit is lifted — the result set will already
   * be small because it matches the search term.
   */
  const fetchClients = useCallback(async (search: string) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const response = await clientsApiService.getClientsLookup(search);
      // A newer request has since been issued (e.g. a faster later keystroke) —
      // drop this stale response instead of overwriting the dropdown with it.
      if (requestId !== requestIdRef.current) return;
      if (response.done && Array.isArray(response.body)) {
        setTotalCount(response.body.length);
        // On an empty search, cap what we render to keep the list scannable.
        // The user can type to see more. All selected clients are always shown
        // even if they fall outside the cap.
        const isSearching = search.trim().length > 0;
        if (isSearching) {
          setClients(response.body);
        } else {
          // Always include already-selected clients so their checkboxes stay visible.
          const selectedSet = new Set(selectedClients);
          const alreadySelected = response.body.filter(c => selectedSet.has(c.id || ''));
          const rest = response.body.filter(c => !selectedSet.has(c.id || ''));
          setClients([...alreadySelected, ...rest.slice(0, INITIAL_DISPLAY_LIMIT)]);
        }
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [selectedClients]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the full client list when the dropdown opens for the first time.
  useEffect(() => {
    if (isDropdownOpen && clients.length === 0 && !loading) {
      fetchClients('');
    }
  }, [isDropdownOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDropdownOpen = (open: boolean) => {
    setIsDropdownOpen(open);
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  };

  /** Debounce the search so we don't fire a request on every keystroke. */
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchClients(value);
    }, SEARCH_DEBOUNCE_MS);
  };

  /**
   * Toggle a client selection.
   *
   * toggleClient's reducer mutates state synchronously, and
   * fetchProjectDataForCurrentView reads getState() before its first await,
   * so the fetch always sees the updated selection with no explicit
   * next-state handoff needed.
   */
  const handleToggle = (clientId: string) => {
    dispatch(toggleClient(clientId));
    dispatch(fetchProjectDataForCurrentView());
  };

  const handleClearAll = () => {
    dispatch(setSelectedClients([]));
    dispatch(fetchProjectDataForCurrentView());
  };

  // Prepend the virtual "No client" option to whatever the server returned.
  const displayItems: IClient[] = [
    { id: NO_CLIENT_ID, name: t('noClient') },
    ...clients,
  ];

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 260 } }}>
      <Flex vertical gap={8}>
        <Input
          ref={searchInputRef}
          value={searchQuery}
          onChange={e => handleSearchChange(e.currentTarget.value)}
          placeholder={t('searchClientsPlaceholder')}
          allowClear
          onClear={() => handleSearchChange('')}
        />

        {loading ? (
          <Flex justify="center" style={{ padding: 16 }}>
            <Spin size="small" />
          </Flex>
        ) : (
          <>
            <List style={{ padding: 0, maxHeight: 220, overflowY: 'auto' }}>
              {displayItems.length > 1 || displayItems[0].id === NO_CLIENT_ID ? (
                displayItems.map(client => (
                  <List.Item
                    className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
                    key={client.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      gap: 8,
                      padding: '4px 8px',
                      border: 'none',
                    }}
                  >
                    <Checkbox
                      checked={selectedClients.includes(client.id || '')}
                      onChange={() => handleToggle(client.id || '')}
                    >
                      {client.name}
                    </Checkbox>
                  </List.Item>
                ))
              ) : (
                <Empty />
              )}
            </List>

            {/* When the total exceeds the display limit and the user hasn't
                searched yet, nudge them to type so they see the full set. */}
            {!searchQuery.trim() && totalCount > INITIAL_DISPLAY_LIMIT && (
              <div
                style={{
                  fontSize: 11,
                  color: token.colorTextTertiary,
                  textAlign: 'center',
                  padding: '4px 0 2px',
                }}
              >
                {t('showingFirstN', {
                  count: clients.length,
                  total: totalCount,
                  defaultValue: 'Showing {{count}} of {{total}}',
                })}
              </div>
            )}
          </>
        )}

        {selectedClients.length > 0 && (
          <Flex justify="flex-end">
            <Button type="link" size="small" onClick={handleClearAll}>
              {t('clearAll', { defaultValue: 'Clear All' })}
            </Button>
          </Flex>
        )}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => dropdownContent}
      onOpenChange={handleDropdownOpen}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        loading={loading}
        style={
          isDropdownOpen
            ? { borderColor: token.colorPrimary, color: token.colorPrimary }
            : undefined
        }
        className="transition-colors duration-300"
      >
        {t('clientText', { defaultValue: 'Client' })}
        {selectedClients.length > 0 && (
          <Badge
            count={selectedClients.length}
            size="small"
            style={{ marginLeft: 4, backgroundColor: token.colorPrimary }}
          />
        )}
      </Button>
    </Dropdown>
  );
};

export default memo(ProjectClientFilterDropdown);
