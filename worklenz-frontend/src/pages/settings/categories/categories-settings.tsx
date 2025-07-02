import { DeleteOutlined, ExclamationCircleFilled, SearchOutlined } from '@ant-design/icons';
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
import { useTranslation } from 'react-i18next';
import { colors } from '@/styles/colors';
import { CategoryType } from '@/types/categories.types';
import CustomColorsCategoryTag from '@features/settings/categories/CustomColorsCategoryTag';
import { deleteCategory } from '@features/settings/categories/categoriesSlice';
import { categoriesApiService } from '@/api/settings/categories/categories.api.service';
import { IProjectCategory, IProjectCategoryViewModel } from '@/types/project/projectCategory.types';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAppDispatch } from '@/hooks/useAppDispatch';

const CategoriesSettings = () => {
  // localization
  const { t } = useTranslation('settings/categories');

  useDocumentTitle('Manage Categories');

  const dispatch = useAppDispatch();
  // get currently hover row
  const [hoverRow, setHoverRow] = useState<string | null>(null);
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
    getCategories();
  }, [getCategories]);

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
      render: (record: IProjectCategoryViewModel) =>
        hoverRow === record.id && (
          <Popconfirm
            title={t('deleteConfirmationTitle')}
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            okText={t('deleteConfirmationOk')}
            cancelText={t('deleteConfirmationCancel')}
            onConfirm={() => record.id && dispatch(deleteCategory(record.id))}
          >
            <Tooltip title="Delete">
              <Button shape="default" icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
        ),
    },
  ];

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
        rowKey={record => record.categoryId}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: 20,
          pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
          size: 'small',
        }}
        onRow={record => {
          return {
            onMouseEnter: () => setHoverRow(record.categoryId),
            style: {
              cursor: 'pointer',
              height: 36,
            },
          };
        }}
      />
    </Card>
  );
};

export default CategoriesSettings;
