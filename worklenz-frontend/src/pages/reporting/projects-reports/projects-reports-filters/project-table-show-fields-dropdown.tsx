import React, { useState } from 'react';
import { MoreOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Dropdown, List, Space } from 'antd';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleColumnHidden } from '@/features/reporting/projectReports/project-reports-table-column-slice/project-reports-table-column-slice';
import { useTranslation } from 'react-i18next';

const ProjectTableShowFieldsDropdown = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { t } = useTranslation('reporting-projects-filters');

  const columnsVisibility = useAppSelector(state => state.projectReportsTableColumnsReducer);
  const dispatch = useAppDispatch();

  const columnKeys = Object.keys(columnsVisibility).filter(
    key => key !== 'project' && key !== 'projectManager'
  );

  // Replace the showFieldsDropdownContent with a menu items structure
  const menuItems = {
    items: columnKeys.map(key => ({
      key,
      label: (
        <Space>
          <Checkbox
            checked={columnsVisibility[key]}
            onClick={() => dispatch(toggleColumnHidden(key))}
          >
            {t(`${key}Text`)}
          </Checkbox>
        </Space>
      ),
    })),
  };

  return (
    <Dropdown menu={menuItems} trigger={['click']} onOpenChange={open => setIsDropdownOpen(open)}>
      <Button
        icon={<MoreOutlined />}
        className={`transition-colors duration-300 ${
          isDropdownOpen
            ? 'border-[#1890ff] text-[#1890ff]'
            : 'hover:text-[#1890ff hover:border-[#1890ff]'
        }`}
      >
        {t('showFieldsText')}
      </Button>
    </Dropdown>
  );
};

export default ProjectTableShowFieldsDropdown;
