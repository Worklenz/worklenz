import { fetchProjectManagers } from '@/features/projects/projectsSlice';
import { setSelectedProjectManagers } from '@/features/reporting/projectReports/project-reports-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectManager } from '@/types/project/projectManager.types';
import { CaretDownFilled } from '@/shared/antd-imports';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  InputRef,
  List,
} from '@/shared/antd-imports';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ProjectManagersFilterDropdown = () => {
  const dispatch = useAppDispatch();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const projectManagerInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { projectManagers, projectManagersLoading } = useAppSelector(
    state => state.projectsReducer
  );
  const { mode: themeMode } = useAppSelector(state => state.themeReducer);

  const { t } = useTranslation('reporting-projects-filters');

  const filteredProjectManagerData = useMemo(() => {
    return projectManagers.filter(projectManager =>
      projectManager.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projectManagers, searchQuery]);

  const handleProjectManagerDropdownOpen = (open: boolean) => {
    setIsDropdownOpen(open);

    if (open) {
      setTimeout(() => {
        projectManagerInputRef.current?.focus();
      }, 0);
    }
  };

  const handleProjectManagerChange = (projectManager: IProjectManager) => {
    dispatch(setSelectedProjectManagers(projectManager));
  };

  useEffect(() => {
    if (!projectManagersLoading) dispatch(fetchProjectManagers());
  }, [dispatch]);

  const projectManagerDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 260 } }}>
      <Flex vertical gap={8}>
        <Input
          ref={projectManagerInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchByNamePlaceholder')}
        />

        <List style={{ padding: 0 }} loading={projectManagersLoading}>
          {filteredProjectManagerData.length ? (
            filteredProjectManagerData.map(projectManager => (
              <List.Item
                className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
                key={projectManager.id}
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  gap: 8,
                  padding: '4px 8px',
                  border: 'none',
                }}
              >
                <Checkbox
                  id={projectManager.id}
                  onChange={() => handleProjectManagerChange(projectManager)}
                >
                  {projectManager.name}
                </Checkbox>
              </List.Item>
            ))
          ) : (
            <Empty />
          )}
        </List>
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => projectManagerDropdownContent}
      onOpenChange={handleProjectManagerDropdownOpen}
    >
      <Button
        icon={<CaretDownFilled />}
        iconPosition="end"
        loading={projectManagersLoading}
        className={`transition-colors duration-300 ${
          isDropdownOpen
            ? 'border-[#1890ff] text-[#1890ff]'
            : 'hover:text-[#1890ff hover:border-[#1890ff]'
        }`}
      >
        {t('projectManagerText')}
      </Button>
    </Dropdown>
  );
};

export default ProjectManagersFilterDropdown;
