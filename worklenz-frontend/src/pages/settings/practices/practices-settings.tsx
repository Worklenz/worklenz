import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
} from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { practicesApiService } from '@/api/settings/practices/practices.api.service';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { colors } from '@/styles/colors';
import { IPractice, IPracticesViewModel } from '@/types/practice.types';
import PinRouteToNavbarButton from '@components/PinRouteToNavbarButton';
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
} from '@/shared/antd-imports';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PracticeDrawer from './practices-drawer';
import logger from '@/utils/errorLogger';

interface PaginationType {
  current: number;
  pageSize: number;
  field: string;
  order: string;
  total: number;
  pageSizeOptions: string[];
  size: 'small' | 'default';
}

const PracticesSettings = () => {
  const { t } = useTranslation('settings/practices');
  useDocumentTitle(t('title', { defaultValue: 'Manage Practices' }));

  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [practices, setPractices] = useState<IPracticesViewModel>({});
  const [pagination, setPagination] = useState<PaginationType>({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
    total: 0,
    pageSizeOptions: ['10', '20', '50', '100'],
    size: 'small',
  });

  const getPractices = useMemo(() => {
    return async () => {
      const response = await practicesApiService.getPractices(
        pagination.current,
        pagination.pageSize,
        pagination.field,
        pagination.order,
        searchQuery
      );
      if (response.done) {
        setPractices(response.body);
        setPagination(prev => ({ ...prev, total: response.body.total || 0 }));
      }
    };
  }, [pagination.current, pagination.pageSize, pagination.field, pagination.order, searchQuery]);

  useEffect(() => {
    getPractices();
  }, [getPractices]);

  const handleEditClick = (id: string) => {
    setSelectedPracticeId(id);
    setShowDrawer(true);
  };

  const handleCreateClick = () => {
    setSelectedPracticeId(null);
    setShowDrawer(true);
  };

  const handleDrawerClose = () => {
    setSelectedPracticeId(null);
    setShowDrawer(false);
    getPractices();
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

  const handleTableChange = (newPagination: any, _filters: any, sorter: any) => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
      field: sorter.field || 'name',
      order: sorter.order === 'ascend' ? 'asc' : 'desc',
    }));
  };

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="flex-end">
          <Flex gap={8} align="center" justify="flex-end" style={{ width: '100%', maxWidth: 460 }}>
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.currentTarget.value)}
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
        pagination={pagination}
        onChange={handleTableChange}
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
