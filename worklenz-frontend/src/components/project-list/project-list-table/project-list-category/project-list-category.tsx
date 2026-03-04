import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { Tooltip, Tag } from '@/shared/antd-imports';
import { TFunction } from 'i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setFilteredCategories, setRequestParams } from '@/features/projects/projectsSlice';
import '../../TableColumns.css';
import { useAppSelector } from '@/hooks/useAppSelector';

// Helper function to determine readable text color based on background color luminance
const getContrastColor = (hexColor: string): string => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

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
    <Tooltip title={`${t('clickToFilter', { defaultValue: 'Click to filter' })} "${record.category_name}"`}>
      <Tag
        color={record.category_color}
        className="rounded-full table-tag"
        // ✅ Fixed: override Ant Design's default white text with contrast-aware color
        style={{ color: record.category_color ? getContrastColor(record.category_color) : undefined }}
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