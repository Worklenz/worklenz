import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { colors } from '@/styles/colors';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  deleteClient,
  fetchClients,
  toggleClientDrawer,
} from '@features/settings/client/clientSlice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IClientViewModel } from '@/types/client.types';
import PinRouteToNavbarButton from '@components/PinRouteToNavbarButton';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import ClientDrawer from './client-drawer';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import logger from '@/utils/errorLogger';

const ClientsSettings: React.FC = () => {
  const { t } = useTranslation('settings/clients');
  const { clients } = useAppSelector(state => state.clientReducer);
  const dispatch = useAppDispatch();

  useDocumentTitle('Manage Clients');

  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<IClientViewModel | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
  });

  const getClients = useMemo(() => {
    return () => {
      const params = {
        index: pagination.current,
        size: pagination.pageSize,
        field: pagination.field,
        order: pagination.order,
        search: searchQuery,
      };
      dispatch(fetchClients(params));
    };
  }, [pagination, searchQuery, dispatch]);

  useEffect(() => {
    getClients();
  }, [searchQuery]);

  const handleClientSelect = (record: IClientViewModel) => {
    setSelectedClient(record);
    dispatch(toggleClientDrawer());
  };

  const deleteClientHandler = async (id: string | undefined) => {
    if (!id) return;
    try {
      await dispatch(deleteClient(id)).unwrap();
      getClients();
    } catch (error) {
      logger.error('Failed to delete client:', error);
    }
  };


  const columns: TableProps['columns'] = useMemo(
    () => [
      {
        key: 'name',
        sorter: true,
        title: t('nameColumn'),
        onCell: record => ({
          onClick: () => handleClientSelect(record),
        }),
        render: (record: IClientViewModel) => <Typography.Text>{record.name}</Typography.Text>,
      },
      {
        key: 'project',
        title: t('projectColumn'),
        onCell: record => ({
          onClick: () => handleClientSelect(record),
        }),
        render: (record: IClientViewModel) =>
          record.projects_count ? (
            <Typography.Text>{record.projects_count}</Typography.Text>
          ) : (
            <Typography.Text type="secondary">{t('noProjectsAvailable')}</Typography.Text>
          ),
      },
      {
        key: 'actionBtns',
        width: 80,
        render: (record: IClientViewModel) =>
          hoverRow === record.id && (
            <Flex gap={8} style={{ padding: 0 }}>
              <Tooltip title="Edit">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleClientSelect(record)}
                />
              </Tooltip>
              <Popconfirm
                title={t('deleteConfirmationTitle')}
                icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
                okText={t('deleteConfirmationOk')}
                cancelText={t('deleteConfirmationCancel')}
                onConfirm={() => deleteClientHandler(record.id)}
              >
                <Tooltip title="Delete">
                  <Button
                    shape="default"
                    icon={<DeleteOutlined />}
                    size="small"
                    onClick={() => deleteClientHandler(record.id)}
                  />
                </Tooltip>
              </Popconfirm>
            </Flex>
          ),
      },
    ],
    [hoverRow, t, dispatch]
  );

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="flex-end">
          <Flex gap={8} align="center" justify="flex-end" style={{ width: '100%', maxWidth: 400 }}>
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.currentTarget.value)}
              placeholder={t('searchPlaceholder')}
              style={{ maxWidth: 232 }}
              suffix={<SearchOutlined />}
            />
            <Button
              type="primary"
              onClick={() => {
                dispatch(toggleClientDrawer());
                setSelectedClient(null);
              }}
            >
              {t('createClient')}
            </Button>
            <Tooltip title={t('pinTooltip')} trigger={'hover'}>
              <PinRouteToNavbarButton
                name="clients"
                path="/worklenz/settings/clients"
                adminOnly={true}
              />
            </Tooltip>
          </Flex>
        </Flex>
      }
    >
      <Table
        className="custom-two-colors-row-table"
        dataSource={clients.data}
        columns={columns}
        rowKey={record => record.id}
        onRow={record => ({
          onMouseEnter: () => setHoverRow(record.id),
        })}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
        }}
      />
      <ClientDrawer
        client={selectedClient}
        drawerClosed={() => {
          setSelectedClient(null);
          getClients();
        }}
      />
    </Card>
  );
};

export default ClientsSettings;
