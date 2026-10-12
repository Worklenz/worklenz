import {
  Button,
  Card,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  Flex,
  Input,
  Popconfirm,
  SearchOutlined,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { practicesApiService } from '@/api/settings/practices/practices.api.service';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { colors } from '@/styles/colors';
import { IPractice, IPracticesViewModel } from '@/types/practice.types';
import PinRouteToNavbarButton from '@components/PinRouteToNavbarButton';
import TablePagination from '@/components/TablePagination';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PracticeDrawer from './practices-drawer';
import logger from '@/utils/errorLogger';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface PaginationState {
  current: number;
  pageSize: number;
  field: string;
  order: string;
  total: number;
}

const PracticesSettings = () => {
  const { t } = useTranslation('settings/practices');
  useDocumentTitle(t('title', { defaultValue: 'Manage Practices' }));

  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [practices, setPractices] = useState<IPracticesViewModel>({});
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
    total: 0,
  });

  const getPractices = useMemo(() => {
    return async () => {
      setLoading(true);
      try {
        const response = await practicesApiService.getPractices(
          pagination.current,
          pagination.pageSize,
          pagination.field,
          pagination.order,
          searchQuery
        );
        if (response.done) {
          setPractices(response.body);
          const total = Number(response.body.total) || 0;
          setPagination(prev => {
            const maxPage = Math.max(1, Math.ceil(total / prev.pageSize));
            if (prev.current > maxPage) {
              return { ...prev, total, current: maxPage };
            }
            return { ...prev, total };
          });
        }
      } catch (error) {
        logger.error('Failed to get practices:', error);
      } finally {
        setLoading(false);
      }
    };
  }, [pagination.current, pagination.pageSize, pagination.field, pagination.order, searchQuery]);

  useEffect(() => {
    getPractices();
  }, [getPractices]);

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize,
    }));
  };

  const handleEditClick = (id: string) => {
    setSelectedPracticeId(id);
    setShowDrawer(true);
  };

  const handleCreateClick = () => {
    setSelectedPracticeId(null);
    setShowDrawer(true);
  };

  const handleDrawerClose = () => {
    const isCreate = selectedPracticeId === null;
    setSelectedPracticeId(null);
    setShowDrawer(false);
    if (isCreate && pagination.current !== 1) {
      setPagination(prev => ({ ...prev, current: 1 }));
    } else {
      getPractices();
    }
  };

  const deletePractice = async (id: string) => {
    if (!id) return;
    try {
      const res = await practicesApiService.deletePractice(id);
      if (res.done) {
        getPractices();
      }
    } catch (error) {
      logger.error('Failed to delete practice:', error);
    }
  };

  const columns: TableProps['columns'] = useMemo(
    () => [
      {
        key: 'practice',
        title: t('nameColumn', { defaultValue: 'Name' }),
        sorter: true,
        onCell: record => ({
          onClick: () => handleEditClick(record.id),
        }),
        render: (record: IPractice) => <Typography.Text>{record.name}</Typography.Text>,
      },
      {
        key: 'actionBtns',
        width: 80,
        render: (record: IPractice) => (
          <Flex gap={8} style={{ padding: 0 }}>
            <Tooltip title={t('editTooltip', { defaultValue: 'Edit' })}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => record.id && handleEditClick(record.id)}
              />
            </Tooltip>

            <Popconfirm
              title={t('deleteConfirmationTitle', {
                defaultValue: 'Are you sure to delete this practice?',
              })}
              icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
              okText={t('deleteConfirmationOk', { defaultValue: 'Delete' })}
              cancelText={t('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
              onConfirm={() => record.id && deletePractice(record.id)}
            >
              <Tooltip title={t('deleteTooltip', { defaultValue: 'Delete' })}>
                <Button shape="default" icon={<DeleteOutlined />} size="small" />
              </Tooltip>
            </Popconfirm>
          </Flex>
        ),
      },
    ],
    [t]
  );

  const handleTableChange = (_newPagination: any, _filters: any, sorter: any) => {
    const sort = Array.isArray(sorter) ? sorter[0] : sorter;
    setPagination(prev => ({
      ...prev,
      current: 1,
      field: (sort?.field as string) || 'name',
      order: sort?.order === 'ascend' ? 'asc' : 'desc',
    }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.currentTarget.value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="flex-end">
          <Flex gap={8} align="center" justify="flex-end" style={{ width: '100%', maxWidth: 460 }}>
            <Input
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={t('search', { defaultValue: 'Search practices' })}
              style={{ maxWidth: 232 }}
              suffix={<SearchOutlined />}
            />
            <Button type="primary" onClick={handleCreateClick}>
              {t('createPracticeButton', { defaultValue: 'Create Practice' })}
            </Button>

            <Tooltip title={t('pinTooltip', { defaultValue: 'Pin to navbar' })} trigger={'hover'}>
              <PinRouteToNavbarButton
                name="practices"
                path="/worklenz/settings/practices"
                adminOnly
              />
            </Tooltip>
          </Flex>
        </Flex>
      }
    >
      <Table
        dataSource={practices.data}
        size="small"
        columns={columns}
        rowKey={(record: IPractice) => record.id!}
        pagination={false}
        loading={loading}
        onChange={handleTableChange}
      />
      <TablePagination
        page={pagination.current}
        pageSize={pagination.pageSize}
        total={pagination.total}
        onPageChange={handlePageChange}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        rowsPerPageLabel={t('rowsPerPage', { defaultValue: 'Rows per page:' })}
        renderSummary={(range, total) =>
          t('paginationSummary', {
            range,
            total,
            defaultValue: `${range} of ${total}`,
          })
        }
        insetStart={8}
        insetEnd={8}
      />
      <PracticeDrawer
        drawerOpen={showDrawer}
        practiceId={selectedPracticeId}
        drawerClosed={handleDrawerClose}
      />
    </Card>
  );
};

export default PracticesSettings;
