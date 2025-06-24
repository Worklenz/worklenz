import React from 'react';
import { Button, Flex } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { nanoid } from '@reduxjs/toolkit';

import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { IGroupBy, fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { createStatus, fetchStatuses } from '@/features/taskAttributes/taskStatusSlice';
import { ALPHA_CHANNEL } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';

const EnhancedKanbanCreateSection: React.FC = () => {
  const { t } = useTranslation('kanban-board');

  const themeMode = useAppSelector((state) => state.themeReducer.mode);
  const { projectId } = useAppSelector((state) => state.projectReducer);
  const groupBy = useAppSelector((state) => state.enhancedKanbanReducer.groupBy);
  const { statusCategories, status: existingStatuses } = useAppSelector((state) => state.taskStatusReducer);

  const dispatch = useAppDispatch();
  const isOwnerorAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();

  // Don't show for priority grouping or if user doesn't have permissions
  if (groupBy === IGroupBy.PRIORITY || (!isOwnerorAdmin && !isProjectManager)) {
    return null;
  }

  const getUniqueSectionName = (baseName: string): string => {
    // Check if the base name already exists
    const existingNames = existingStatuses.map(status => status.name?.toLowerCase());
    
    if (!existingNames.includes(baseName.toLowerCase())) {
      return baseName;
    }
    
    // If the base name exists, add a number suffix
    let counter = 1;
    let newName = `${baseName.trim()} (${counter})`;
    
    while (existingNames.includes(newName.toLowerCase())) {
      counter++;
      newName = `${baseName.trim()} (${counter})`;
    }
    
    return newName;
  };

  const handleAddSection = async () => {
    const sectionId = nanoid();
    const baseNameSection = 'Untitled section';
    const sectionName = getUniqueSectionName(baseNameSection);
    
    if (groupBy === IGroupBy.STATUS && projectId) {
      // Find the "To do" category
      const todoCategory = statusCategories.find(category => 
        category.name?.toLowerCase() === 'to do' || 
        category.name?.toLowerCase() === 'todo'
      );
      
      if (todoCategory && todoCategory.id) {
        // Create a new status
        const body = {
          name: sectionName,
          project_id: projectId,
          category_id: todoCategory.id,
        };
        
        try {
          // Create the status
          const response = await dispatch(createStatus({ body, currentProjectId: projectId })).unwrap();
          
          if (response.done && response.body) {
            // Refresh the board to show the new section
            dispatch(fetchEnhancedKanbanGroups(projectId));
            // Refresh statuses
            dispatch(fetchStatuses(projectId));
          }
        } catch (error) {
          logger.error('Failed to create status:', error);
        }
      }
    } 

    if (groupBy === IGroupBy.PHASE && projectId) {
      const body = {
        name: sectionName,
        project_id: projectId,
      };

      try { 
        const response = await phasesApiService.addPhaseOption(projectId);
        if (response.done && response.body) {
          dispatch(fetchEnhancedKanbanGroups(projectId));
        }
      } catch (error) {
        logger.error('Failed to create phase:', error);
      }
    }
  };

  return (
    <Flex
      vertical
      gap={16}
      style={{
        minWidth: 325,
        padding: 8,
        borderRadius: 12,
      }}
      className="h-[400px] max-h-[400px] overflow-y-scroll"
    >
      <div
        style={{
          borderRadius: 6,
          padding: 8,
          height: 300,
          background: themeWiseColor(
            'linear-gradient( 180deg, #fafafa, rgba(245, 243, 243, 0))',
            'linear-gradient( 180deg, #2a2b2d, rgba(42, 43, 45, 0))',
            themeMode
          ),
        }}
      >
        <Button
          type="text"
          style={{
            height: '38px',
            width: '100%',
            borderRadius: 6,
            boxShadow: 'none',
          }}
          icon={<PlusOutlined />}
          onClick={handleAddSection}
        >
          {t('addSectionButton')}
        </Button>
      </div>
    </Flex>
  );
};

export default React.memo(EnhancedKanbanCreateSection); 