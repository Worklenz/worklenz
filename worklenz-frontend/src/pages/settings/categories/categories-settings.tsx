import { DeleteOutlined, ExclamationCircleFilled, SearchOutlined } from '@/shared/antd-imports';
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
import { deleteCategoryAsync } from '@features/settings/categories/categoriesSlice';
import { categoriesApiService } from '@/api/settings/categories/categories.api.service';
import { IProjectCategory, IProjectCategoryViewModel } from '@/types/project/projectCategory.types';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_categories_visit } from '@/shared/worklenz-analytics-events';

const CategoriesSettings = () => {
  // localization
  const { t } = useTranslation('settings/categories');
  const { trackMixpanelEvent } = useMixpanelTracking();

  useDocumentTitle('Manage Categories');

  const dispatch = useAppDispatch();

  // Get delete loading state from Redux
  const deleteLoading = useAppSelector(state => state.categoriesReducer.loading);

  const [categories, setCategories] = useState<IProjectCategoryViewModel[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState<string>('');

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

  // Handle delete category
  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const result = await dispatch(deleteCategoryAsync(categoryId));
      if (deleteCategoryAsync.fulfilled.match(result)) {
        // Category deleted successfully, remove from local state
        setCategories(prev => prev.filter(cat => cat.id !== categoryId));
        message.success(t('deleteSuccessMessage'));
      } else if (deleteCategoryAsync.rejected.match(result)) {
        // Show error message from the API
        const errorMessage = result.payload as string;
        message.error(errorMessage || t('deleteErrorMessage'));
      }
    } catch (error) {
      // Fallback error handling
      console.error('Failed to delete category:', error);
      message.error(t('deleteErrorMessage'));
    }
  };

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'category',
      title: t('categoryColumn'),
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
      width: 60,
      render: (record: IProjectCategoryViewModel) => (
        <div className="row-action-buttons">
          <Popconfirm
            title={t('deleteConfirmationTitle')}
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            okText={t('deleteConfirmationOk')}
            cancelText={t('deleteConfirmationCancel')}
            onConfirm={() => record.id && handleDeleteCategory(record.id)}
          >
            <Tooltip title="Delete">
              <Button 
                shape="default" 
                icon={<DeleteOutlined />} 
                size="small" 
                loading={deleteLoading}
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
          <Flex justify="flex-end">
            <Flex gap={8} align="center" justify="flex-end" style={{ width: '100%', maxWidth: 400 }}>
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.currentTarget.value)}
                placeholder={t('searchPlaceholder')}
                style={{ maxWidth: 232 }}
                suffix={<SearchOutlined />}
              />
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
        onRow={() => ({
          style: {
            cursor: 'pointer',
            height: 36,
          },
        })}
      />
      </Card>
    </>
  );
};

export default CategoriesSettings;
