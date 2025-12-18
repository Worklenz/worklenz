import './categories-settings.css';
import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
  Modal,
  Input as AntdInput,
  Select as AntdSelect,
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
import { PhaseColorCodes } from '@/shared/constants';
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

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<IProjectCategoryViewModel | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editLoading, setEditLoading] = useState(false);

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
      width: 80,
      render: (record: IProjectCategoryViewModel) => (
        <div className="row-action-buttons">
          {/* Edit Button */}
          <Tooltip title={t('editCategory', 'Edit')}>
            <Button
              shape="default"
              icon={<EditOutlined />}
              size="small"
              style={{ marginRight: 8 }}
              onClick={() => {
                setEditingCategory(record);
                setEditName(record.name || '');
                setEditColor(record.color_code || PhaseColorCodes[0]);
                setEditModalOpen(true);
              }}
            />
          </Tooltip>
          {/* Delete Button */}
          <Popconfirm
            title={t('deleteConfirmationTitle')}
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            okText={t('deleteConfirmationOk')}
            cancelText={t('deleteConfirmationCancel')}
            onConfirm={() => record.id && handleDeleteCategory(record.id)}
          >
            <Tooltip title={t('deleteCategory', 'Delete')}>
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

      {/* Edit Category Modal */}
      <Modal
        open={editModalOpen}
        title={t('editCategoryTitle', 'Edit Category')}
        onCancel={() => setEditModalOpen(false)}
        onOk={async () => {
          if (!editingCategory) return;
          if (!editName.trim()) {
            message.error(t('editNameRequired', 'Category name is required'));
            return;
          }
          setEditLoading(true);
          try {
            const response = await categoriesApiService.updateCategory({
              id: editingCategory.id || '',
              color: editColor,
              name: editName.trim(),
            });
            if (response.done) {
              setCategories(prev =>
                prev.map(cat =>
                  cat.id === editingCategory.id
                    ? { ...cat, color_code: editColor, name: editName.trim() }
                    : cat
                )
              );
              message.success(t('editSuccessMessage', 'Category updated successfully'));
              setEditModalOpen(false);
            } else {
              message.error(response.message || t('editErrorMessage', 'Failed to update category'));
            }
          } catch (error) {
            message.error(t('editErrorMessage', 'Failed to update category'));
          } finally {
            setEditLoading(false);
          }
        }}
        okText={t('save', 'Save')}
        cancelText={t('cancel', 'Cancel')}
        confirmLoading={editLoading}
        destroyOnClose
      >
        <div className="category-modal-field">
          <label className="category-modal-label">{t('categoryNameLabel', 'Category Name')}</label>
          <AntdInput
            value={editName}
            onChange={e => setEditName(e.target.value)}
            maxLength={40}
            placeholder={t('categoryNamePlaceholder', 'Enter category name')}
            autoFocus
          />
        </div>
        <div className="category-modal-field">
          <label className="category-modal-label">
            {t('categoryColorLabel', 'Category Color')}
          </label>
          <AntdSelect
            value={editColor}
            onChange={setEditColor}
            className="category-modal-color-select"
            options={PhaseColorCodes.map(color => ({
              value: color,
              label: (
                <span className="category-modal-color-option">
                  <span className="category-modal-color-dot" data-color={color} />
                  {color}
                </span>
              ),
            }))}
            dropdownMatchSelectWidth={false}
          />
        </div>
      </Modal>
    </>
  );
};

export default CategoriesSettings;
