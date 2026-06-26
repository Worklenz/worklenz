import { memo, useState, useEffect } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  Input,
  Typography,
  Spin,
} from '@/shared/antd-imports';
import { CaretDownFilled, SearchOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { clientsApiService } from '@/api/clients/clients.api.service';
import { IClient } from '@/types/client.types';
import {
  setSelectedClients,
  toggleClient,
  fetchAllTasks,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksClientFilter = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();

  const { selectedClients } = useAppSelector(state => state.allTasksReportsReducer);

  const [clients, setClients] = useState<IClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const response = await clientsApiService.getClients(1, 100, null, null);
        if (response.done && response.body) {
          setClients(response.body.data || []);
        }
      } catch (error) {
        console.error('Error fetching clients:', error);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (clientId: string) => {
    dispatch(toggleClient(clientId));
    dispatch(fetchAllTasks());
  };

  const handleClearAll = () => {
    dispatch(setSelectedClients([]));
    dispatch(fetchAllTasks());
  };

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 280 } }}>
      <Flex vertical gap={8}>
        <Input
          placeholder={t('searchClients', { defaultValue: 'Search clients...' })}
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
        />
        <Flex justify="flex-end">
          <Button type="link" size="small" onClick={handleClearAll}>
            {t('clearAll', { defaultValue: 'Clear All' })}
          </Button>
        </Flex>

        {loading ? (
          <Flex justify="center" style={{ padding: 16 }}>
            <Spin size="small" />
          </Flex>
        ) : filteredClients.length === 0 ? (
          <Typography.Text type="secondary" style={{ padding: '4px 8px', fontSize: 12 }}>
            {t('noClients', { defaultValue: 'No clients found' })}
          </Typography.Text>
        ) : (
          <Flex vertical gap={4} style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filteredClients.map(client => (
              <Checkbox
                key={client.id}
                checked={selectedClients.includes(client.id || '')}
                onChange={() => handleToggle(client.id || '')}
              >
                <Typography.Text>{client.name}</Typography.Text>
              </Checkbox>
            ))}
          </Flex>
        )}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button>
        <Flex align="center" gap={4}>
          {t('clientFilter', { defaultValue: 'Client' })}
          {selectedClients.length > 0 && (
            <Typography.Text type="secondary">({selectedClients.length})</Typography.Text>
          )}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(AllTasksClientFilter);