import { SettingOutlined, CheckOutlined, CloseOutlined } from '@/shared/antd-imports';
import { Button, Flex, Tooltip, Input, message } from '@/shared/antd-imports';
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setCustomColumnModalAttributes, toggleCustomColumnModalOpen } from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import { tasksCustomColumnsService } from '@/api/tasks/tasks-custom-columns.service';
import { fetchTaskListColumns, fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { useParams } from 'react-router-dom';
import logger from '@/utils/errorLogger';

type CustomColumnHeaderProps = {
  columnKey: string;
  columnName: string;
  columnId?: string;
  isEditingHeader?: boolean;
};

const CustomColumnHeader = ({ columnKey, columnName, columnId, isEditingHeader = false }: CustomColumnHeaderProps) => {
  const [isEditing, setIsEditing] = useState(isEditingHeader);
  const [editValue, setEditValue] = useState(columnName);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<any>(null);
  const dispatch = useAppDispatch();
  const columnList = useAppSelector(state => state.projectViewTaskListColumnsReducer.columnList);
  const { projectId } = useParams();
  const { t } = useTranslation('task-list-table');

  // Auto-focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Auto-trigger edit mode for newly created columns
  useEffect(() => {
    if (isEditingHeader) {
      setIsEditing(true);
    }
  }, [isEditingHeader]);

  const handleSave = async () => {
    if (!editValue.trim()) {
      message.error(t('customColumns.columnNameRequired', { defaultValue: 'Column name is required' }));
      return;
    }

    if (editValue.trim() === columnName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      // Find the column data - must use the UUID, not the key
      const column = columnList.find(col => col.key === columnKey);
      
      if (!column) {
        message.error(t('customColumns.columnNotFound', { defaultValue: 'Column not found' }));
        setIsSaving(false);
        return;
      }

      // CRITICAL: Use UUID from id field, never use the key (which is a nanoid)
      const updateColumnUUID = column.id;
      
      if (!updateColumnUUID) {
        message.error(t('customColumns.columnIdNotFound', { defaultValue: 'Column ID not found - please refresh and try again' }));
        setIsSaving(false);
        return;
      }

      // Build complete configuration with existing values (convert camelCase to snake_case)
      const existingConfig = column.custom_column_obj || {};
      const configuration = {
        field_title: editValue.trim(),
        field_type: existingConfig.fieldType || 'text',
        number_type: existingConfig.numberType || null,
        decimals: existingConfig.decimals || null,
        label: existingConfig.label || null,
        label_position: existingConfig.labelPosition || null,
        preview_value: existingConfig.previewValue || null,
        expression: existingConfig.expression || null,
        first_numeric_column_key: existingConfig.firstNumericColumnKey || null,
        second_numeric_column_key: existingConfig.secondNumericColumnKey || null,
        selections_list: existingConfig.selectionsList || [],
        labels_list: existingConfig.labelsList || [],
      };

      // Update backend
      await tasksCustomColumnsService.updateCustomColumn(updateColumnUUID, {
        name: editValue.trim(),
        field_type: existingConfig.fieldType || 'text',
        width: column.width || 120,
        is_visible: true,
        configuration,
      });

      // Refresh data
      if (projectId) {
        dispatch(fetchTaskListColumns(projectId));
        dispatch(fetchTasksV3(projectId));
      }

      message.success(t('customColumns.columnUpdated', { defaultValue: 'Column name updated' }));
      setIsEditing(false);
    } catch (error) {
      logger.error('Error updating column name:', error);
      message.error(t('customColumns.updateFailed', { defaultValue: 'Failed to update column name' }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(columnName);
    setIsEditing(false);
  };

  const handleOpenSettings = () => {
    const column = columnList.find(col => col.key === columnKey);
    dispatch(setCustomColumnModalAttributes({ 
      modalType: 'edit', 
      columnId: column?.id || columnId || columnKey,
      columnData: column,
      canChangeColumnType: false,
    }));
    dispatch(toggleCustomColumnModalOpen(true));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <Flex gap={4} align="center" style={{ width: '100%' }}>
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('customColumns.enterColumnName', { defaultValue: 'Enter column name' })}
          size="small"
          style={{ flex: 1, minWidth: 0 }}
          disabled={isSaving}
        />
        <Button
          icon={<CheckOutlined />}
          size="small"
          type="text"
          onClick={handleSave}
          loading={isSaving}
          style={{ padding: '0 4px' }}
        />
        <Button
          icon={<CloseOutlined />}
          size="small"
          type="text"
          onClick={handleCancel}
          disabled={isSaving}
          style={{ padding: '0 4px' }}
        />
      </Flex>
    );
  }

  return (
    <Flex gap={8} align="center" justify="space-between">
      <div 
        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        onClick={() => setIsEditing(true)}
      >
        <Tooltip title={t('customColumns.clickToEdit', { defaultValue: 'Click to edit column name' })}>
          <span style={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block'
          }}>
            {columnName}
          </span>
        </Tooltip>
      </div>

      <Tooltip title={t('customColumns.columnSettings', { defaultValue: 'Column settings' })}>
        <Button
          icon={<SettingOutlined />}
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            fontSize: 12,
          }}
          onClick={handleOpenSettings}
        />
      </Tooltip>
    </Flex>
  );
};

export default CustomColumnHeader;
