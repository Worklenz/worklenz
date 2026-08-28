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
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { addCategory } from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { themeWiseColor } from '@utils/themeWiseColor';
import { IProjectCategory } from '@/types/project/projectCategory.types';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { categoriesApiService } from '@/api/settings/categories/categories.api.service';
import logger from '@/utils/errorLogger';

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

  const { projectCategories } = useAppSelector(state => state.projectCategoriesReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  const filteredCategoriesData = useMemo(() => {
    return projectCategories.filter(category =>
      category.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projectCategories, searchQuery]);

  const categoryOptions = filteredCategoriesData.map(category => ({
    key: category.id as string,
    label: (
      <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Badge color={category.color_code} /> {category.name}
      </Typography.Text>
    ),
  }));

  const onClick: MenuProps['onClick'] = e => {
    const newCategory = filteredCategoriesData.find(category => category.id === e.key);
    if (newCategory && connected && socket) {
      setSelectedCategory(newCategory);
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
        dispatch(addCategory(res.body));
        setSelectedCategory(res.body);
        if (connected && socket) {
          socket.emit(
            SocketEvents.PROJECT_CATEGORY_CHANGE.toString(),
            JSON.stringify({
              project_id: projectId,
              category_id: res.body.id,
            })
          );
        }
        setDropdownOpen(false);
      }
    } catch (error) {
      logger.error('handleCreateCategory', error);
    } finally {
      setSearchQuery('');
    }
  };

  const projectCategoryCellItems: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <Card className="project-category-dropdown-card" variant="borderless">
          <Flex vertical gap={4}>
            <div
              onKeyDown={e => {
                if (e.key === 'Enter') e.stopPropagation();
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

  const handleCategoryChangeResponse = (data: any) => {
    try {
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsedData && parsedData.project_id === projectId) {
        const socketCategory = parsedData.category;
        const fullCategory =
          projectCategories.find(c => c.id === socketCategory?.id) || socketCategory;
        setSelectedCategory(fullCategory);
        dispatch(updateProjectCategory({ projectId: parsedData.project_id, category: fullCategory }));
      }
    } catch (error) {
      console.error('Error handling category change response:', error);
    }
  };

  const handleCategoryDropdownOpen = (open: boolean) => {
    if (open) {
      setTimeout(() => categoryInputRef.current?.focus(), 0);
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

  // Compute pill colors
  const bgColor = selectedCategory.id
    ? themeWiseColor(`${selectedCategory.color_code}33`, `${selectedCategory.color_code}55`, themeMode)
    : colors.transparent;
  const textColor = themeWiseColor(colors.darkGray, colors.white, themeMode);
  const borderStyle = selectedCategory.id ? 'none' : `1px solid ${colors.deepLightGray}`;

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      menu={{ items: projectCategoryCellItems }}
      placement="bottomRight"
      trigger={['click']}
      open={dropdownOpen}
      onOpenChange={open => {
        setDropdownOpen(open);
        handleCategoryDropdownOpen(open);
      }}
    >
      {/* CSS classes do the truncation — inline styles only handle dynamic colors */}
      <div
        className="category-pill-wrapper"
        style={{
          backgroundColor: bgColor,
          color: textColor,
          border: borderStyle,
        }}
      >
        <span className="category-pill-text">
          {selectedCategory.id ? selectedCategory.name : t('setCategoryText')}
        </span>
        <DownOutlined className="category-pill-icon" />
      </div>
    </Dropdown>
  );
};

const updateProjectCategory = (payload: { projectId: string; category: IProjectCategory }) => ({
  type: 'projects/updateCategory',
  payload,
});

export default ProjectCategoryCell;