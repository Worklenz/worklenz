import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
} from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { departmentsApiService } from '@/api/settings/departments/departments.api.service';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { colors } from '@/styles/colors';
import { IDepartment, IDepartmentsViewModel } from '@/types/department.types';
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
import DepartmentDrawer from './departments-drawer';
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

const DepartmentsSettings = () => {
  const { t } = useTranslation('settings/departments');
  useDocumentTitle(t('title', { defaultValue: 'Manage Departments' }));

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<IDepartmentsViewModel>({});
  const [pagination, setPagination] = useState<PaginationType>({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
    total: 0,
    pageSizeOptions: ['10', '20', '50', '100'],
    size: 'small',
  });

  const getDepartments = useMemo(() => {
    return async () => {
      const response = await departmentsApiService.getDepartments(
        pagination.current,
        pagination.pageSize,
        pagination.field,
        pagination.order,
        searchQuery
      );
      if (response.done) {
        setDepartments(response.body);
        setPagination(prev => ({ ...prev, total: response.body.total || 0 }));
      }
    };
  }, [pagination.current, pagination.pageSize, pagination.field, pagination.order, searchQuery]);

  useEffect(() => {
    getDepartments();
  }, [getDepartments]);

  const handleEditClick = (id: string) => {
    setSelectedDepartmentId(id);
    setShowDrawer(true);
  };

  const handleCreateClick = () => {
    setSelectedDepartmentId(null);
    setShowDrawer(true);
  };

  const handleDrawerClose = () => {
    setSelectedDepartmentId(null);
    setShowDrawer(false);
    getDepartments();
  };

  const deleteDepartment = async (id: string) => {
    if (!id) return;
    try {
      const res = await departmentsApiService.deleteDepartment(id);
      if (res.done) {
        getDepartments();
      }
    } catch (error) {
      logger.error('Failed to delete department:', error);
    }
  };

  const columns: TableProps['columns'] = useMemo(
    () => [
      {
        key: 'department',
        title: t('nameColumn', { defaultValue: 'Name' }),
        sorter: true,
        onCell: record => ({
          onClick: () => handleEditClick(record.id),
        }),
        render: (record: IDepartment) => <Typography.Text>{record.name}</Typography.Text>,
      },
      {
        key: 'actionBtns',
        width: 80,
        render: (record: IDepartment) => (
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
                defaultValue: 'Are you sure to delete this department?',
              })}
              icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
              okText={t('deleteConfirmationOk', { defaultValue: 'Delete' })}
              cancelText={t('deleteConfirmationCancel', { defaultValue: 'Cancel' })}
              onConfirm={() => record.id && deleteDepartment(record.id)}
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
              placeholder={t('search', { defaultValue: 'Search departments' })}
              style={{ maxWidth: 232 }}
              suffix={<SearchOutlined />}
            />
            <Button type="primary" onClick={handleCreateClick}>
              {t('createDepartmentButton', { defaultValue: 'Create Department' })}
            </Button>

            <Tooltip title={t('pinTooltip', { defaultValue: 'Pin to navbar' })} trigger={'hover'}>
              <PinRouteToNavbarButton
                name="departments"
                path="/worklenz/settings/departments"
                adminOnly
              />
            </Tooltip>
          </Flex>
        </Flex>
      }
    >
      <Table
        dataSource={departments.data}
        size="small"
        columns={columns}
        rowKey={(record: IDepartment) => record.id!}
        pagination={pagination}
        onChange={handleTableChange}
      />
      <DepartmentDrawer
        drawerOpen={showDrawer}
        departmentId={selectedDepartmentId}
        drawerClosed={handleDrawerClose}
      />
    </Card>
  );
};

export default DepartmentsSettings;
