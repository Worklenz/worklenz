import {
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Popconfirm,
  Table,
  TableProps,
  Tooltip,
  Typography,
  message,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
} from '@/shared/antd-imports';
import type { TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { colors } from '../../../styles/colors';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../../hooks/useDoumentTItle';
import { durationDateFormat } from '../../../utils/durationDateFormat';
import {
  createRateCard,
  deleteRateCard,
  fetchRateCardById,
  toggleRatecardDrawer,
} from '../../../features/finance/finance-slice';
import { rateCardApiService } from '@/api/settings/rate-cards/rate-cards.api.service';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { RatecardType } from '@/types/project/ratecard.types';
import { useAppSelector } from '../../../hooks/useAppSelector';
import RateCardDrawer from '@/components/projects/project-finance/rate-card-drawer/RateCardDrawer';

interface PaginationType {
  current: number;
  pageSize: number;
  field: string;
  order: string;
  total: number;
  pageSizeOptions: string[];
  size: 'small' | 'default';
}

const RatecardSettings: React.FC = () => {
  const { t } = useTranslation('/settings/ratecard-settings');
  const dispatch = useAppDispatch();
  const [messageApi, contextHolder] = message.useMessage();
  useDocumentTitle('Manage Rate Cards');

  // Redux state
  const isDrawerOpen = useAppSelector(state => state.financeReducer.isRatecardDrawerOpen);

  // Local state
  const [loading, setLoading] = useState(false);
  const [ratecardsList, setRatecardsList] = useState<RatecardType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRatecardId, setSelectedRatecardId] = useState<string | null>(null);
  const [ratecardDrawerType, setRatecardDrawerType] = useState<'create' | 'update'>('create');
  const [pagination, setPagination] = useState<PaginationType>({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
    total: 0,
    pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
    size: 'small',
  });

  // Memoized filtered data
  const filteredRatecardsData = useMemo(() => {
    return ratecardsList.filter(item =>
      item.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [ratecardsList, searchQuery]);

  // Fetch rate cards with error handling
  const fetchRateCards = useCallback(async () => {
    setLoading(true);
    try {
      const response = await rateCardApiService.getRateCards(
        pagination.current,
        pagination.pageSize,
        pagination.field,
        pagination.order,
        searchQuery
      );
      if (response.done) {
        setRatecardsList(response.body.data || []);
        setPagination(prev => ({ ...prev, total: response.body.total || 0 }));
      } else {
        messageApi.error(t('fetchError') || 'Failed to fetch rate cards');
      }
    } catch (error) {
      console.error('Failed to fetch rate cards:', error);
      messageApi.error(t('fetchError') || 'Failed to fetch rate cards');
    } finally {
      setLoading(false);
    }
  }, [
    pagination.current,
    pagination.pageSize,
    pagination.field,
    pagination.order,
    searchQuery,
    t,
    messageApi,
  ]);

  // Fetch rate cards when drawer state changes
  useEffect(() => {
    fetchRateCards();
  }, [fetchRateCards, isDrawerOpen]);

  // Handle rate card creation
  const handleRatecardCreate = useCallback(async () => {
    try {
      const resultAction = await dispatch(
        createRateCard({
          name: 'Untitled Rate Card',
          jobRolesList: [],
          currency: 'LKR',
        }) as any
      );

      if (createRateCard.fulfilled.match(resultAction)) {
        const created = resultAction.payload;
        setRatecardDrawerType('update');
        setSelectedRatecardId(created.id ?? null);
        dispatch(toggleRatecardDrawer());
      } else {
        messageApi.error(t('createError') || 'Failed to create rate card');
      }
    } catch (error) {
      console.error('Failed to create rate card:', error);
      messageApi.error(t('createError') || 'Failed to create rate card');
    }
  }, [dispatch, t, messageApi]);

  // Handle rate card update
  const handleRatecardUpdate = useCallback(
    (id: string) => {
      setRatecardDrawerType('update');
      dispatch(fetchRateCardById(id));
      setSelectedRatecardId(id);
      dispatch(toggleRatecardDrawer());
    },
    [dispatch]
  );

  // Handle table changes
  const handleTableChange = useCallback(
    (
      newPagination: TablePaginationConfig,
      filters: Record<string, FilterValue | null>,
      sorter: SorterResult<RatecardType> | SorterResult<RatecardType>[]
    ) => {
      const sorterResult = Array.isArray(sorter) ? sorter[0] : sorter;
      setPagination(prev => ({
        ...prev,
        current: newPagination.current || 1,
        pageSize: newPagination.pageSize || DEFAULT_PAGE_SIZE,
        field: (sorterResult?.field as string) || 'name',
        order: sorterResult?.order === 'ascend' ? 'asc' : 'desc',
      }));
    },
    []
  );

  // Table columns configuration
  const columns: TableProps['columns'] = useMemo(
    () => [
      {
        key: 'rateName',
        title: t('nameColumn'),
        render: (record: RatecardType) => (
          <Typography.Text
            style={{ color: '#1890ff', cursor: 'pointer' }}
            onClick={() => record.id && handleRatecardUpdate(record.id)}
          >
            {record.name}
          </Typography.Text>
        ),
      },
      {
        key: 'created',
        title: t('createdColumn'),
        render: (record: RatecardType) => (
          <Typography.Text onClick={() => record.id && handleRatecardUpdate(record.id)}>
            {durationDateFormat(record.created_at)}
          </Typography.Text>
        ),
      },
      {
        key: 'actionBtns',
        width: 80,
        render: (record: RatecardType) => (
          <Flex gap={8} className="hidden group-hover:flex">
            <Tooltip title={t('editTooltip') || 'Edit'}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => record.id && handleRatecardUpdate(record.id)}
              />
            </Tooltip>
            <Popconfirm
              title={t('deleteConfirmationTitle')}
              icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
              okText={t('deleteConfirmationOk')}
              cancelText={t('deleteConfirmationCancel')}
              onConfirm={async () => {
                setLoading(true);
                try {
                  if (record.id) {
                    await dispatch(deleteRateCard(record.id));
                    await fetchRateCards();
                  }
                } catch (error) {
                  console.error('Failed to delete rate card:', error);
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Tooltip title={t('deleteTooltip') || 'Delete'}>
                <Button shape="default" icon={<DeleteOutlined />} size="small" />
              </Tooltip>
            </Popconfirm>
          </Flex>
        ),
      },
    ],
    [t, handleRatecardUpdate, fetchRateCards, dispatch, messageApi]
  );

  return (
    <>
      {contextHolder}
      <Card
        style={{ width: '100%' }}
        title={
          <Flex justify="flex-end" align="center" gap={8}>
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              style={{ maxWidth: 232 }}
              suffix={<SearchOutlined />}
            />
            <Button type="primary" onClick={handleRatecardCreate}>
              {t('createRatecard')}
            </Button>
          </Flex>
        }
      >
        <Table
          loading={loading}
          className="custom-two-colors-row-table"
          dataSource={filteredRatecardsData}
          columns={columns}
          rowKey="id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            onChange: (page, pageSize) =>
              setPagination(prev => ({ ...prev, current: page, pageSize })),
          }}
          onChange={handleTableChange}
          rowClassName="group"
          locale={{
            emptyText: <Empty description={t('noRatecardsFound')} />,
          }}
        />
        <RateCardDrawer
          type={ratecardDrawerType}
          ratecardId={selectedRatecardId || ''}
          onSaved={fetchRateCards}
        />
      </Card>
    </>
  );
};

export default RatecardSettings;
