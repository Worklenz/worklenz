import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
} from '@/shared/antd-imports';
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
  message,
} from '@/shared/antd-imports';
import { useEffect, useCallback, useMemo, useState } from 'react';
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
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_clients_visit } from '@/shared/worklenz-analytics-events';
import { decodeHtmlEntities } from '@/utils/html-entities';

const ClientsSettings: React.FC = () => {
  const { t } = useTranslation('settings/clients');
  const { clients, loading } = useAppSelector(state => state.clientReducer);
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();

  useDocumentTitle(t('pageTitle', { defaultValue: 'Clients' }));

  const [selectedClient, setSelectedClient] = useState<IClientViewModel | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmOpenForId, setConfirmOpenForId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
  });

  const getClients = useCallback(() => {
    const params = {
      index: pagination.current,
      size: pagination.pageSize,
      field: pagination.field,
      order: pagination.order,
      search: searchQuery,
    };
    dispatch(fetchClients(params));
  }, [pagination, searchQuery, dispatch]);

  useEffect(() => {
    trackMixpanelEvent(evt_settings_clients_visit);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    getClients();
  }, [searchQuery, pagination]);

  const handleClientSelect = (record: IClientViewModel) => {
    setSelectedClient(record);
    dispatch(toggleClientDrawer());
  };

  const deleteClientHandler = useCallback(
    async (id: string | undefined) => {
      if (!id) return;
      setIsDeleting(true);
      try {
        await dispatch(deleteClient(id)).unwrap();
        message.success(
          t('deleteClientSuccessMessage', { defaultValue: 'Client deleted successfully.' })
        );
        setConfirmOpenForId(null);
        // Row is removed from Redux immediately via deleteClient.fulfilled — no refetch wait.
      } catch (error) {
        // API interceptor already surfaces the server validation message.
        logger.error('Failed to delete client:', error);
      } finally {
        setIsDeleting(false);
      }
    },
    [dispatch, t]
  );

  const columns: TableProps['columns'] = useMemo(
    () => [
      {
        key: 'name',
        sorter: true,
        title: t('nameColumn', { defaultValue: 'Name' }),
        onCell: record => ({
          onClick: () => handleClientSelect(record),
        }),
        render: (record: IClientViewModel) => (
          <Typography.Text>{decodeHtmlEntities(record.name)}</Typography.Text>
        ),
      },
      {
        key: 'project',
        title: t('projectColumn', { defaultValue: 'Projects' }),
        onCell: record => ({
          onClick: () => handleClientSelect(record),
        }),
        render: (record: IClientViewModel) =>
          record.projects_count ? (
            <Typography.Text>{record.projects_count}</Typography.Text>
          ) : (
            <Typography.Text type="secondary">
              {t('noProjectsAvailable', { defaultValue: 'No projects' })}
            </Typography.Text>
          ),
      },
      {
        key: 'actionBtns',
        width: 80,
        render: (record: IClientViewModel) => {
          const hasProjects = Number(record.projects_count ?? 0) > 0;
          const projectCount = Number(record.projects_count ?? 0);
          const isConfirmOpen = confirmOpenForId === record.id;

          return (
            <div
              className={`row-action-buttons${isConfirmOpen ? ' row-action-buttons--open' : ''}`}
              onClick={e => e.stopPropagation()}
            >
              <Flex gap={8} style={{ padding: 0 }}>
                <Tooltip title={t('editTooltip', { defaultValue: 'Edit' })}>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={e => {
                      e.stopPropagation();
                      handleClientSelect(record);
                    }}
                  />
                </Tooltip>
                <Popconfirm
                  open={isConfirmOpen}
                  onOpenChange={open => {
                    if (isDeleting) return;
                    setConfirmOpenForId(open ? (record.id ?? null) : null);
                  }}
                  title={
                    hasProjects
                      ? t('cannotDeleteTitle', { defaultValue: 'Cannot delete client' })
                      : t('deleteConfirmationTitle', { defaultValue: 'Are you sure?' })
                  }
                  description={
                    hasProjects
                      ? t('cannotDeleteWithProjects', {
                          count: projectCount,
                          defaultValue:
                            'This client is assigned to {{count}} project(s) and cannot be deleted. Reassign or remove those projects first.',
                        })
                      : undefined
                  }
                  icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
                  okText={
                    hasProjects
                      ? t('cannotDeleteOk', { defaultValue: 'OK' })
                      : t('deleteConfirmationOk', { defaultValue: 'Yes' })
                  }
                  cancelText={t('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
                  showCancel={!hasProjects}
                  okType={hasProjects ? 'default' : 'primary'}
                  okButtonProps={{ loading: isDeleting && !hasProjects }}
                  onConfirm={e => {
                    e?.stopPropagation();
                    if (hasProjects) {
                      setConfirmOpenForId(null);
                      return;
                    }
                    return deleteClientHandler(record.id);
                  }}
                  onCancel={e => {
                    e?.stopPropagation();
                    setConfirmOpenForId(null);
                  }}
                  destroyTooltipOnHide={false}
                >
                  <Tooltip title={t('deleteTooltip', { defaultValue: 'Delete' })}>
                    <Button
                      shape="default"
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={e => e.stopPropagation()}
                    />
                  </Tooltip>
                </Popconfirm>
              </Flex>
            </div>
          );
        },
      },
    ],
    [t, deleteClientHandler, confirmOpenForId, isDeleting]
  );

  return (
    <>
      <style>
        {`
          .custom-two-colors-row-table .row-action-buttons {
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
          }

          .custom-two-colors-row-table .ant-table-tbody > tr:hover .row-action-buttons,
          .custom-two-colors-row-table .row-action-buttons--open {
            opacity: 1;
          }
        `}
      </style>
      <Card
        style={{ width: '100%' }}
        title={
          <Flex justify="flex-end">
            <Flex gap={8} align="center" justify="flex-end" style={{ width: '100%', maxWidth: 400 }}>
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.currentTarget.value)}
                placeholder={t('searchPlaceholder', { defaultValue: 'Search by name' })}
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
                {t('createClient', { defaultValue: 'Create Client' })}
              </Button>
              <Tooltip title={t('pinTooltip', { defaultValue: 'Pin to navbar' })} trigger={'hover'}>
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
          loading={loading && !isDeleting}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: DEFAULT_PAGE_SIZE,
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: clients.total,
          }}
          onChange={(paginationInfo, _filters, sorter) => {
            const sort = Array.isArray(sorter) ? sorter[0] : sorter;
            setPagination(prev => ({
              current: paginationInfo.current ?? prev.current,
              pageSize: paginationInfo.pageSize ?? prev.pageSize,
              field: (sort?.field as string) ?? prev.field,
              order:
                sort?.order === 'ascend' ? 'asc' : sort?.order === 'descend' ? 'desc' : prev.order,
            }));
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
    </>
  );
};

export default ClientsSettings;
