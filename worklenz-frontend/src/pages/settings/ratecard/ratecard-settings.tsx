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
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { colors } from '../../../styles/colors';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../../hooks/useDoumentTItle';
import { durationDateFormat } from '../../../utils/durationDateFormat';
import { createRateCard, deleteRateCard, toggleRatecardDrawer } from '../../../features/finance/finance-slice';
import RatecardDrawer from '../../../features/finance/ratecard-drawer/ratecard-drawer';
import { rateCardApiService } from '@/api/settings/rate-cards/rate-cards.api.service';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { RatecardType } from '@/types/project/ratecard.types';
import { useAppSelector } from '../../../hooks/useAppSelector';

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
  useDocumentTitle('Manage Rate Cards');

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
      }
    } catch (error) {
      console.error('Failed to fetch rate cards:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, pagination.field, pagination.order, searchQuery]);

  useEffect(() => {
    fetchRateCards();
  }, []);

  const filteredRatecardsData = useMemo(() => {
    return ratecardsList.filter((item) =>
      item.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [ratecardsList, searchQuery]);

  const handleRatecardCreate = useCallback(async () => {

    const resultAction = await dispatch(createRateCard({
      name: 'Untitled Rate Card',
      jobRolesList: [],
      currency: 'LKR',
    }) as any);

    if (createRateCard.fulfilled.match(resultAction)) {
      const created = resultAction.payload;
      setRatecardDrawerType('update');
      setSelectedRatecardId(created.id ?? null);
      dispatch(toggleRatecardDrawer());
    }
  }, [dispatch]);

  const handleRatecardUpdate = useCallback((id: string) => {
    setRatecardDrawerType('update');
    setSelectedRatecardId(id);
    dispatch(toggleRatecardDrawer());
  }, [dispatch]);




  const handleTableChange = useCallback((newPagination: any, filters: any, sorter: any) => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
      field: sorter.field || 'name',
      order: sorter.order === 'ascend' ? 'asc' : 'desc',
    }));
  }, []);

  const columns: TableProps['columns'] = useMemo(() => [
    {
      key: 'rateName',
      title: t('nameColumn'),
      render: (record: RatecardType) => (
        <Typography.Text style={{ color: '#1890ff', cursor: 'pointer' }}
          onClick={() => setSelectedRatecardId(record.id ?? null)}>
          {record.name}
        </Typography.Text>
      ),
    },
    {
      key: 'created',
      title: t('createdColumn'),
      render: (record: RatecardType) => (
        <Typography.Text onClick={() => setSelectedRatecardId(record.id ?? null)}>
          {durationDateFormat(record.created_at)}
        </Typography.Text>
      ),
    },
    {
      key: 'actionBtns',
      width: 80,
      render: (record: RatecardType) => (
        <Flex gap={8} className="hidden group-hover:flex">
          <Tooltip title="Edit">
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
            onConfirm={() => {
              setLoading(true);
              record.id && dispatch(deleteRateCard(record.id));
              setLoading(false);
            }}
          >
            <Tooltip title="Delete">
              <Button
                shape="default"
                icon={<DeleteOutlined />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Flex>
      ),
    },
  ], [t, handleRatecardUpdate]);

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="flex-end" align="center" gap={8}>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
          onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
        }}
        onChange={handleTableChange}
        rowClassName="group"
      />
      <RatecardDrawer
        type={ratecardDrawerType}
        ratecardId={selectedRatecardId || ''}
        onSaved={fetchRateCards} // Pass the fetch function as a prop
      />
    </Card>
  );
};

export default RatecardSettings;