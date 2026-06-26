import './categories-settings.css';
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
  message,
  Popconfirm,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '@/styles/colors';
import CustomColorsCategoryTag from '@features/settings/categories/CustomColorsCategoryTag';
import CategoriesDrawer from './categories-drawer';
import { deleteProjectCategory } from '@features/projects/lookups/projectCategories/projectCategoriesSlice';
import { categoriesApiService } from '@/api/settings/categories/categories.api.service';
import { IProjectCategory, IProjectCategoryViewModel } from '@/types/project/projectCategory.types';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_categories_visit } from '@/shared/worklenz-analytics-events';
import logger from '@/utils/errorLogger';

const CategoriesSettings = () => {
  // localization
  const { t } = useTranslation('settings/categories');
  const { trackMixpanelEvent } = useMixpanelTracking();

  useDocumentTitle('Manage Categories');

  const dispatch = useAppDispatch();

  // Get delete loading state from Redux (using projectCategoriesReducer which is used by project drawer)
  const deleteLoading = useAppSelector(state => state.projectCategoriesReducer.loading);

  const [categories, setCategories] = useState<IProjectCategoryViewModel[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState<string>('');

  // Drawer state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const filteredData = useMemo(
    () =>
      categories.filter(record =>
        Object.values(record).some(value =>
          value?.toString().toLowerCase().includes(searchQuery.toLowerCase())
        )
      ),
    [categories, searchQuery]
  );

  const getCategories = useMemo(() => {
    setLoading(true);
    return async () => {
      const response = await categoriesApiService.getCategories();
      if (response.done) {
        setCategories(response.body);
      }
      setLoading(false);
    };
  }, []);

  useEffect(() => {
    trackMixpanelEvent(evt_settings_categories_visit);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    getCategories();
  }, [getCategories]);

  const handleEditClick = (id: string) => {
    setSelectedCategoryId(id);
    setShowDrawer(true);
  };

  const handleDrawerClose = () => {
    setSelectedCategoryId(null);
    setShowDrawer(false);
    getCategories();
  };

  // Handle delete category
  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const result = await dispatch(deleteProjectCategory(categoryId));
      if (deleteProjectCategory.fulfilled.match(result)) {
        getCategories();
        message.success(t('deleteSuccessMessage'));
      } else if (deleteProjectCategory.rejected.match(result)) {
        // Show error message from the API
        const errorMessage = result.payload as string;
        message.error(errorMessage || t('deleteErrorMessage'));
      }
    } catch (error) {
      // Fallback error handling
      logger.error('Failed to delete category:', error);
      message.error(t('deleteErrorMessage'));
    }
  };

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'category',
      title: t('categoryColumn'),
      onCell: record => ({
        onClick: () => handleEditClick(record.id!),
      }),
      render: (record: IProjectCategoryViewModel) => <CustomColorsCategoryTag category={record} />,
    },
    {
      key: 'associatedTask',
      title: t('associatedTaskColumn'),
      render: (record: IProjectCategoryViewModel) => (
        <Typography.Text>{record.usage}</Typography.Text>
      ),
    },
    {
      key: 'actionBtns',
      width: 80,
      render: (record: IProjectCategoryViewModel) => (
        <div className="row-action-buttons" onClick={e => e.stopPropagation()}>
          {/* Edit Button */}
          <Tooltip title={t('editCategory', 'Edit')}>
            <Button
              shape="default"
              icon={<EditOutlined />}
              size="small"
              style={{ marginRight: 8 }}
              onClick={e => {
                e.stopPropagation();
                handleEditClick(record.id!);
              }}
            />
          </Tooltip>
          {/* Delete Button */}
          <Popconfirm
            title={t('deleteConfirmationTitle')}
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            okText={t('deleteConfirmationOk')}
            cancelText={t('deleteConfirmationCancel')}
            onConfirm={e => {
              e?.stopPropagation();
              if (record.id) {
                handleDeleteCategory(record.id);
              }
            }}
            onCancel={e => e?.stopPropagation()}
          >
            <Tooltip title={t('deleteCategory', 'Delete')}>
              <Button
                shape="default"
                icon={<DeleteOutlined />}
                size="small"
                loading={deleteLoading}
                onClick={e => {
                  e.stopPropagation();
                }}
              />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <style>
        {`
          .custom-two-colors-row-table .row-action-buttons {
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
          }
          
          .custom-two-colors-row-table .ant-table-tbody > tr:hover .row-action-buttons {
            opacity: 1;
          }
        `}
      </style>
      <Card
        style={{ width: '100%' }}
        title={
          <Flex justify="space-between" align="center">
            <Typography.Text strong>{t('title', { defaultValue: 'Categories' })}</Typography.Text>
            <Flex
              gap={8}
              align="center"
              justify="flex-end"
              style={{ width: '100%', maxWidth: 400 }}
            >
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.currentTarget.value)}
                placeholder={t('search', { defaultValue: 'Search' })}
                style={{ maxWidth: 232 }}
                suffix={<SearchOutlined />}
              />
              <Button
                type="primary"
                onClick={() => {
                  setSelectedCategoryId(null);
                  setShowDrawer(true);
                }}
              >
                {t('createCategoryButton', { defaultValue: 'New Category' })}
              </Button>
            </Flex>
          </Flex>
        }
      >
        <Table
          locale={{
            emptyText: <Typography.Text>{t('emptyText')}</Typography.Text>,
          }}
          className="custom-two-colors-row-table"
          dataSource={filteredData}
          columns={columns}
          rowKey={record => record.id}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: 20,
            pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
            size: 'small',
          }}
          onRow={record => ({
            style: { cursor: 'pointer' },
            onClick: () => handleEditClick(record.id!),
          })}
        />
      </Card>

      <CategoriesDrawer
        drawerOpen={showDrawer}
        categoryId={selectedCategoryId}
        drawerClosed={handleDrawerClose}
      />
    </>
  );
};

export default CategoriesSettings;
