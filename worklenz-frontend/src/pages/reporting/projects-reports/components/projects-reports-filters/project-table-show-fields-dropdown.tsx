import { memo } from 'react';
import { EyeOutlined } from '@/shared/antd-imports';
import { Button, Checkbox, Flex, Popover, Tooltip } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleColumnHidden } from '@/features/reporting/projectReports/project-reports-table-column-slice/project-reports-table-column-slice';
import { useTranslation } from 'react-i18next';

const ProjectTableShowFieldsDropdown = () => {
  const { t } = useTranslation('reporting-projects-filters');

  const columnsVisibility = useAppSelector(state => state.projectReportsTableColumnsReducer);
  const dispatch = useAppDispatch();

  const columnKeys = Object.keys(columnsVisibility).filter(
    key => key !== 'project' && key !== 'projectManager'
  );

  const label = t('showFieldsText', { defaultValue: 'Show or hide columns' });

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      title={label}
      content={
        <Flex vertical gap={4} className="min-w-[200px]">
          {columnKeys.map(key => (
            <Checkbox
              key={key}
              checked={columnsVisibility[key]}
              onChange={() => dispatch(toggleColumnHidden(key))}
            >
              {t(`${key}Text`)}
            </Checkbox>
          ))}
        </Flex>
      }
    >
      <Tooltip title={label}>
        <Button icon={<EyeOutlined />} aria-label={label} />
      </Tooltip>
    </Popover>
  );
};

export default memo(ProjectTableShowFieldsDropdown);
