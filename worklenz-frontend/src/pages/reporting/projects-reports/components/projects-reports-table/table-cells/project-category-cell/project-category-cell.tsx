/* eslint-disable react-hooks/exhaustive-deps */
import { DownOutlined } from '@/shared/antd-imports';
import {
  Badge,
  Card,
  Dropdown,
  Flex,
  Input,
  InputRef,
  Menu,
  MenuProps,
  Typography,
} from '@/shared/antd-imports';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import './project-category-cell.css';
import { nanoid } from '@reduxjs/toolkit';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { addCategory } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { themeWiseColor } from '@utils/themeWiseColor';
import { IProjectCategory, IProjectCategoryViewModel } from '@/types/project/projectCategory.types';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { setSelectedProjectCategory } from '@/features/reporting/projectReports/project-reports-slice';
import { categoriesApiService } from '@/api/settings/categories/categories.api.service';
import logger from '@/utils/errorLogger';

// Update the props interface to include projectId
interface ProjectCategoryCellProps {
  id: string;
  name: string;
  color_code: string;
  projectId: string;
}

const ProjectCategoryCell = ({ id, name, color_code, projectId }: ProjectCategoryCellProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects');
  const categoryInputRef = useRef<InputRef>(null);
  const { socket, connected } = useSocket();
  const [selectedCategory, setSelectedCategory] = useState<IProjectCategory>({
    id,
    name,
    color_code,
  });

  // get categories list from the categories reducer
  const { projectCategories, loading: projectCategoriesLoading } = useAppSelector(
    state => state.projectCategoriesReducer
  );
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  // filter categories based on search query
  const filteredCategoriesData = useMemo(() => {
    return projectCategories.filter(category =>
      category.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projectCategories, searchQuery]);

  // category selection options
  const categoryOptions = filteredCategoriesData.map(category => ({
    key: category.id as string,
    label: (
      <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Badge color={category.color_code} /> {category.name}
      </Typography.Text>
    ),
  }));

  // handle category select
  const onClick: MenuProps['onClick'] = e => {
    const newCategory = filteredCategoriesData.find(category => category.id === e.key);
    if (newCategory && connected && socket) {
      // Update local state immediately
      setSelectedCategory(newCategory);

      // Emit socket event
      socket.emit(
        SocketEvents.PROJECT_CATEGORY_CHANGE.toString(),
        JSON.stringify({
          project_id: projectId,
          category_id: newCategory.id,
        })
      );
    }
    setDropdownOpen(false);

  };


  //   function to handle add a new category
  const handleCreateCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const exists = projectCategories.some(
      c => c.name?.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return;

    try {
      const res = await categoriesApiService.createCategory({
        name: trimmed,
        color_code: '#1E90FF',
      });
      if (res.done) {
        // Add to dropdown list
        dispatch(addCategory(res.body));

        // Update the cell label immediately
        setSelectedCategory(res.body);

        // Assign the new category to this project
        if (connected && socket) {
          socket.emit(
            SocketEvents.PROJECT_CATEGORY_CHANGE.toString(),
            JSON.stringify({
              project_id: projectId,
              category_id: res.body.id,
            })
          );
        }

        // Close the dropdown
        setDropdownOpen(false);
      }
    } catch (error) {
      logger.error('handleCreateCategory', error);
    } finally {
      setSearchQuery('');
    }

  };

  // dropdown items
  const projectCategoryCellItems: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card className="project-category-dropdown-card" variant="borderless">
          <Flex vertical gap={4}>
            <div
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.stopPropagation(); // ← prevents Dropdown/Menu from intercepting Enter
                }
              }}
            >
              <Input
                ref={categoryInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.currentTarget.value)}
                placeholder={t('searchByNameInputPlaceholder')}
                onKeyDown={e => {
                  const isCategory = filteredCategoriesData.findIndex(
                    category => category.name?.toLowerCase() === searchQuery.toLowerCase()
                  );
                  if (isCategory === -1 && e.key === 'Enter') {
                    // handle category creation logic
                    handleCreateCategory(searchQuery);
                  }
                }}
              />
            </div>
            {filteredCategoriesData.length === 0 && (
              <Typography.Text style={{ color: colors.lightGray }}>
                Hit enter to create!
              </Typography.Text>
            )}
          </Flex>

          <Menu className="project-category-menu" items={categoryOptions} onClick={onClick} />
        </Card>
      ),
    },
  ];

  // Update the socket response handler
  const handleCategoryChangeResponse = (data: any) => {
    try {
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsedData && parsedData.project_id === projectId) {
        // Update local state
        const socketCategory = parsedData.category;
        const fullCategory =
          projectCategories.find(c => c.id === socketCategory?.id) || socketCategory;

        setSelectedCategory(fullCategory);

        dispatch(
          updateProjectCategory({
            projectId: parsedData.project_id,
            category: fullCategory,
          })
        );
      }
    } catch (error) {
      console.error('Error handling category change response:', error);
    }
  };

  const handleCategoryDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => {
        categoryInputRef.current?.focus();
      }, 0);
    }
  };

  useEffect(() => {
    if (connected && socket) {
      socket.on(SocketEvents.PROJECT_CATEGORY_CHANGE.toString(), handleCategoryChangeResponse);

      return () => {
        socket.off(SocketEvents.PROJECT_CATEGORY_CHANGE.toString(), handleCategoryChangeResponse);
      };
    }
  }, [connected, socket, projectCategories]);

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      menu={{ items: projectCategoryCellItems }}
      placement="bottomRight"
      trigger={['click']}
      open={dropdownOpen}
      onOpenChange={(open) => {
        setDropdownOpen(open);
        handleCategoryDropdownOpen(open);
      }}
    >
      <Flex
        gap={6}
        align="center"
        style={{
          width: 'fit-content',
          borderRadius: 24,
          paddingInline: 8,
          textTransform: 'capitalize',
          fontSize: 13,
          height: 22,
          backgroundColor: selectedCategory.id
            ? themeWiseColor(
              `${selectedCategory.color_code}33`,   // light: 20% opacity (existing)
              `${selectedCategory.color_code}55`,   // dark: 33% opacity (more visible)
              themeMode
            )
            : colors.transparent,
          color: selectedCategory.id
            ? themeWiseColor(colors.darkGray, colors.white, themeMode)
            : themeWiseColor(colors.darkGray, colors.white, themeMode),
          border: selectedCategory.id ? 'none' : `1px solid ${colors.deepLightGray}`,
          cursor: 'pointer',
        }}
      >
        {selectedCategory.id ? selectedCategory.name : t('setCategoryText')}

        <DownOutlined />
      </Flex>
    </Dropdown >
  );
};

// Action creator for updating project category
const updateProjectCategory = (payload: { projectId: string; category: IProjectCategory }) => ({
  type: 'projects/updateCategory',
  payload,
});

export default ProjectCategoryCell;
