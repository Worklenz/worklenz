import { fetchProjectHealth } from '@/features/projects/lookups/projectHealth/projectHealthSlice';
import {
  fetchProjectData,
  setSelectedProjectHealths,
} from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectHealth } from '@/types/project/projectHealth.types';
import { CaretDownFilled } from '@ant-design/icons';
import { Button, Card, Checkbox, Dropdown, List, Space } from 'antd';
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import debounce from 'lodash/debounce'; // Install lodash if not already present

const ProjectHealthFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedHealths, setSelectedHealths] = useState<IProjectHealth[]>([]);

  const { projectHealths, loading: projectHealthsLoading } = useAppSelector(
    state => state.projectHealthReducer
  );
  const { mode: themeMode } = useAppSelector(state => state.themeReducer);
  const { selectedProjectHealths, isLoading: projectLoading } = useAppSelector(
    state => state.projectReportsReducer
  );

  useEffect(() => {
    setSelectedHealths(selectedProjectHealths);
  }, [selectedProjectHealths]);

  useEffect(() => {
    if (!projectHealthsLoading) dispatch(fetchProjectHealth());
  }, [dispatch]);

  const debouncedUpdate = useCallback(
    debounce((healths: IProjectHealth[]) => {
      dispatch(setSelectedProjectHealths(healths));
      dispatch(fetchProjectData());
    }, 300),
    [dispatch]
  );

  const handleHealthChange = (health: IProjectHealth) => {
    const isSelected = selectedHealths.some(h => h.id === health.id);
    let updatedHealths: IProjectHealth[];

    if (isSelected) {
      updatedHealths = selectedHealths.filter(h => h.id !== health.id);
    } else {
      updatedHealths = [...selectedHealths, health];
    }

    setSelectedHealths(updatedHealths);
    debouncedUpdate(updatedHealths);
  };

  const projectHealthDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 0 } }}>
      <List style={{ padding: 0 }}>
        {projectHealths.map(item => (
          <List.Item
            className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
            key={item.id}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 8px',
              border: 'none',
            }}
          >
            <Space>
              <Checkbox
                id={item.id}
                checked={selectedHealths.some(h => h.id === item.id)}
                onChange={() => handleHealthChange(item)}
                disabled={projectLoading}
              >
                {item.name}
              </Checkbox>
            </Space>
          </List.Item>
        ))}
      </List>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => projectHealthDropdownContent}
      onOpenChange={open => setIsDropdownOpen(open)}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        loading={projectHealthsLoading}
        className={`transition-colors duration-300 ${
          isDropdownOpen
            ? 'border-[#1890ff] text-[#1890ff]'
            : 'hover:text-[#1890ff] hover:border-[#1890ff]'
        }`}
      >
        {t('healthText')}
      </Button>
    </Dropdown>
  );
};

export default ProjectHealthFilterDropdown;
