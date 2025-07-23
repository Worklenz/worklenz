import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button, Flex } from '@/shared/antd-imports';
import { PlusOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { nanoid } from '@reduxjs/toolkit';
import { DownOutlined } from '@/shared/antd-imports';

import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  IGroupBy,
  fetchEnhancedKanbanGroups,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { createStatus, fetchStatuses } from '@/features/taskAttributes/taskStatusSlice';
import { ALPHA_CHANNEL } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';

const EnhancedKanbanCreateSection: React.FC = () => {
  const { t } = useTranslation('kanban-board');

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const groupBy = useAppSelector(state => state.enhancedKanbanReducer.groupBy);
  const { statusCategories, status: existingStatuses } = useAppSelector(
    state => state.taskStatusReducer
  );

  const dispatch = useAppDispatch();
  const isOwnerorAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();

  const [isAdding, setIsAdding] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Find selected category object
  const selectedCategory = statusCategories?.find(cat => cat.id === selectedCategoryId);

  // Compute header background color
  const headerBackgroundColor = React.useMemo(() => {
    if (!selectedCategory) return themeWiseColor('#f5f5f5', '#1e1e1e', themeMode);
    return selectedCategory.color_code || (themeMode === 'dark' ? '#1e1e1e' : '#f5f5f5');
  }, [themeMode, selectedCategory]);

  // Focus input when adding
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isAdding]);

  // Close on outside click (for both input and category dropdown)
  useEffect(() => {
    if (!isAdding && !showCategoryDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        (!categoryDropdownRef.current || !categoryDropdownRef.current.contains(event.target as Node))
      ) {
        setIsAdding(false);
        setSectionName('');
        setSelectedCategoryId('');
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAdding, showCategoryDropdown]);

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
    setIsAdding(true);
    setSectionName('');
    // Default to first category if available
    if (statusCategories && statusCategories.length > 0 && typeof statusCategories[0].id === 'string') {
      setSelectedCategoryId(statusCategories[0].id);
    } else {
      setSelectedCategoryId('');
    }
  };

  const handleCreateSection = async () => {
    if (!sectionName.trim() || !projectId) return;
    const name = getUniqueSectionName(sectionName.trim());
    if (groupBy === IGroupBy.STATUS && selectedCategoryId) {
      const body = {
        name,
        project_id: projectId,
        category_id: selectedCategoryId,
      };
      try {
        const response = await dispatch(
          createStatus({ body, currentProjectId: projectId })
        ).unwrap();
        if (response.done && response.body) {
          dispatch(fetchEnhancedKanbanGroups(projectId));
          dispatch(fetchStatuses(projectId));
        }
      } catch (error) {
        logger.error('Failed to create status:', error);
      }
    }
    if (groupBy === IGroupBy.PHASE) {
      try {
        const response = await phasesApiService.addPhaseOption(projectId, name);
        if (response.done && response.body) {
          dispatch(fetchEnhancedKanbanGroups(projectId));
        }
      } catch (error) {
        logger.error('Failed to create phase:', error);
      }
    }
    setIsAdding(false);
    setSectionName('');
    setSelectedCategoryId('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCreateSection();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setSectionName('');
      setSelectedCategoryId('');
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
        {isAdding ? (
          <div ref={dropdownRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Header-like area */}
            <div
              className="enhanced-kanban-group-header flex items-center gap-2"
              style={{
                backgroundColor: headerBackgroundColor,
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 8,
                minHeight: 36,
              }}
            >
              {/* Borderless input */}
              <input
                ref={inputRef}
                value={sectionName}
                onChange={e => setSectionName(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className={`bg-transparent border-none outline-none text-sm font-semibold capitalize min-w-[120px] flex-1 ${themeMode === 'dark' ? 'text-gray-800 placeholder-gray-800' : 'text-gray-800 placeholder-gray-600'}`}
                placeholder={t('untitledSection')}
                style={{ marginBottom: 0 }}
              />
              {/* Category selector dropdown */}
              {groupBy === IGroupBy.STATUS && statusCategories && statusCategories.length > 0 && (
                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    type="button"
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    style={{ minWidth: 80 }}
                    onClick={() => setShowCategoryDropdown(v => !v)}
                  >
                    <span className={themeMode === 'dark' ? 'text-gray-800' : 'text-gray-900'} style={{ fontSize: 13 }}>
                      {selectedCategory?.name || t('changeCategory')}
                    </span>
                    <DownOutlined style={{ fontSize: 12, color: themeMode === 'dark' ? '#555' : '#555' }} />
                  </button>
                  {showCategoryDropdown && (
                    <div
                      className="absolute right-0 mt-1 w-30 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50"
                      style={{ zIndex: 1000 }}
                    >
                      <div className="py-1">
                        {statusCategories.filter(cat => typeof cat.id === 'string').map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            onClick={() => {
                              if (typeof cat.id === 'string') setSelectedCategoryId(cat.id);
                              setShowCategoryDropdown(false);
                            }}
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color_code }}
                            ></div>
                            <span className={selectedCategoryId === cat.id ? 'font-bold' : ''}>{cat.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                size="small"
                onClick={handleCreateSection}
                disabled={!sectionName.trim()}
              >
                {t('addSectionButton')}
              </Button>
              <Button
                type="default"
                size="small"
                onClick={() => { setIsAdding(false); setSectionName(''); setSelectedCategoryId(''); setShowCategoryDropdown(false); }}
              >
                {t('deleteConfirmationCancel')}
              </Button>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </Flex>
  );
};

export default React.memo(EnhancedKanbanCreateSection);
