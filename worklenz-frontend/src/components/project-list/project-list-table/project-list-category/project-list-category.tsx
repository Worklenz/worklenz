import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { Tooltip, Tag } from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setFilteredCategories, setRequestParams } from '@/features/projects/projectsSlice';
import '../../TableColumns.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getContrastColor } from '@/utils/colorUtils';

export const CategoryCell: React.FC<{
  record: IProjectViewModel;
  t: TFunction;
}> = ({ record, t }) => {
  if (!record.category_name) return '-';

  const { requestParams } = useAppSelector(state => state.projectsReducer);
  const dispatch = useAppDispatch();

  const filterByCategory = (categoryId: string | undefined) => {
    if (!categoryId) return;
    const newParams: Partial<typeof requestParams> = { categories: categoryId };
    dispatch(setFilteredCategories([categoryId]));
    dispatch(setRequestParams(newParams));
  };

  const bgColor = record.category_color || '#a9a9a9';
  const textColor = getContrastColor(bgColor);

  return (
    <Tooltip
      title={`${t('clickToFilter', { defaultValue: 'Click to filter' })} "${record.category_name}"`}
    >
      <Tag
        style={{
          backgroundColor: bgColor,
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={e => {
          e.stopPropagation();
          filterByCategory(record.category_id);
        }}
      >
        <span style={{ fontSize: 12, color: textColor }}>{record.category_name}</span>
      </Tag>
    </Tooltip>
  );
};
