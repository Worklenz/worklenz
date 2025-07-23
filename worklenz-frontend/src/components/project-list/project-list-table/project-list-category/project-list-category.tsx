import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { Tooltip, Tag } from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setFilteredCategories, setRequestParams } from '@/features/projects/projectsSlice';
import '../../TableColumns.css';
import { useAppSelector } from '@/hooks/useAppSelector';

export const CategoryCell: React.FC<{
  record: IProjectViewModel;
  t: TFunction;
}> = ({ record, t }) => {
  if (!record.category_name) return '-';

  const { requestParams } = useAppSelector(state => state.projectsReducer);
  const dispatch = useAppDispatch();
  const newParams: Partial<typeof requestParams> = {};
  const filterByCategory = (categoryId: string | undefined) => {
    if (!categoryId) return;
    newParams.categories = categoryId;
    dispatch(setFilteredCategories([categoryId]));
    dispatch(setRequestParams(newParams));
  };

  return (
    <Tooltip title={`${t('clickToFilter')} "${record.category_name}"`}>
      <Tag
        color={record.category_color}
        className="rounded-full table-tag"
        onClick={e => {
          e.stopPropagation();
          filterByCategory(record.category_id);
        }}
      >
        {record.category_name}
      </Tag>
    </Tooltip>
  );
};
