import { MoreOutlined, SettingOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import Button from 'antd/es/button';
import Checkbox from 'antd/es/checkbox';
import Dropdown from 'antd/es/dropdown';
import Space from 'antd/es/space';
import React, { useState } from 'react';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateColumnVisibility, updateCustomColumnPinned } from '@/features/tasks/tasks.slice';
import { ITaskListColumn } from '@/types/tasks/taskList.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import ColumnConfigurationModal from './column-configuration-modal';

// Configuration interface for column visibility
interface ColumnConfig {
  key: string;
  label: string;
  showInDropdown: boolean;
  order: number;
  category?: string;
}

// Default column configuration - this can be customized per project or globally
const DEFAULT_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'KEY', label: 'Key', showInDropdown: true, order: 1, category: 'basic' },
  { key: 'TASK', label: 'Task', showInDropdown: false, order: 2, category: 'basic' }, // Always visible, not in dropdown
  { key: 'DESCRIPTION', label: 'Description', showInDropdown: true, order: 3, category: 'basic' },
  { key: 'PROGRESS', label: 'Progress', showInDropdown: true, order: 4, category: 'basic' },
  { key: 'STATUS', label: 'Status', showInDropdown: true, order: 5, category: 'basic' },
  { key: 'ASSIGNEES', label: 'Assignees', showInDropdown: true, order: 6, category: 'basic' },
  { key: 'LABELS', label: 'Labels', showInDropdown: true, order: 7, category: 'basic' },
  { key: 'PHASE', label: 'Phase', showInDropdown: true, order: 8, category: 'basic' },
  { key: 'PRIORITY', label: 'Priority', showInDropdown: true, order: 9, category: 'basic' },
  {
    key: 'TIME_TRACKING',
    label: 'Time Tracking',
    showInDropdown: true,
    order: 10,
    category: 'time',
  },
  { key: 'ESTIMATION', label: 'Estimation', showInDropdown: true, order: 11, category: 'time' },
  { key: 'START_DATE', label: 'Start Date', showInDropdown: true, order: 12, category: 'dates' },
  { key: 'DUE_DATE', label: 'Due Date', showInDropdown: true, order: 13, category: 'dates' },
  { key: 'DUE_TIME', label: 'Due Time', showInDropdown: true, order: 14, category: 'dates' },
  {
    key: 'COMPLETED_DATE',
    label: 'Completed Date',
    showInDropdown: true,
    order: 15,
    category: 'dates',
  },
  {
    key: 'CREATED_DATE',
    label: 'Created Date',
    showInDropdown: true,
    order: 16,
    category: 'dates',
  },
  {
    key: 'LAST_UPDATED',
    label: 'Last Updated',
    showInDropdown: true,
    order: 17,
    category: 'dates',
  },
  { key: 'REPORTER', label: 'Reporter', showInDropdown: true, order: 18, category: 'basic' },
];

// Hook to get column configuration - can be extended to fetch from API or localStorage
const useColumnConfig = (projectId?: string): ColumnConfig[] => {
  // In the future, this could fetch from:
  // 1. Project-specific settings from API
  // 2. User preferences from localStorage
  // 3. Global settings from configuration
  // 4. Team-level settings

  // For now, return default configuration
  // You can extend this to load from localStorage or API
  const storedConfig = localStorage.getItem(`worklenz.column-config.${projectId}`);

  if (storedConfig) {
    try {
      return JSON.parse(storedConfig);
    } catch (error) {
      console.warn('Failed to parse stored column config, using default');
    }
  }

  return DEFAULT_COLUMN_CONFIG;
};

// Hook to save column configuration
const useSaveColumnConfig = () => {
  return (projectId: string, config: ColumnConfig[]) => {
    localStorage.setItem(`worklenz.column-config.${projectId}`, JSON.stringify(config));
  };
};

const ShowFieldsFilterDropdown = () => {
  const { socket } = useSocket();
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const columnList = useAppSelector(state => state.taskReducer.columns);
  const { projectId, project } = useAppSelector(state => state.projectReducer);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>(
    useColumnConfig(projectId || undefined)
  );
  const saveColumnConfig = useSaveColumnConfig();

  // Update config if projectId changes
  React.useEffect(() => {
    setColumnConfig(useColumnConfig(projectId || undefined));
  }, [projectId, configModalOpen]);

  // Filter columns based on configuration
  const visibilityChangableColumnList = columnList.filter(column => {
    // Always exclude selector and TASK columns from dropdown
    if (column.key === 'selector' || column.key === 'TASK') {
      return false;
    }

    // Find configuration for this column
    const config = columnConfig.find(c => c.key === column.key);

    // If no config found, show custom columns by default
    if (!config) {
      return column.custom_column;
    }

    // Return based on configuration
    return config.showInDropdown;
  });

  // Sort columns based on configuration order
  const sortedColumns = visibilityChangableColumnList.sort((a, b) => {
    const configA = columnConfig.find(c => c.key === a.key);
    const configB = columnConfig.find(c => c.key === b.key);

    const orderA = configA?.order ?? 999;
    const orderB = configB?.order ?? 999;

    return orderA - orderB;
  });

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const handleColumnVisibilityChange = async (col: ITaskListColumn) => {
    if (!projectId) return;
    const column = { ...col, is_visible: !col.pinned, pinned: !col.pinned };

    if (col.custom_column) {
      socket?.emit(SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(), {
        column_id: col.id,
        project_id: projectId,
        is_visible: !col.pinned,
      });
      socket?.once(SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(), (data: any) => {
        if (col.id) {
          dispatch(updateCustomColumnPinned({ columnId: col.id, isVisible: !col.pinned }));
        }
      });
    } else {
      await dispatch(updateColumnVisibility({ projectId, item: column }));
    }
  };

  const handleConfigSave = (newConfig: ColumnConfig[]) => {
    setColumnConfig(newConfig);
    if (projectId) saveColumnConfig(projectId, newConfig);
  };

  const menuItems = [
    ...sortedColumns.map(col => ({
      key: col.key || '',
      type: 'item' as const,
      label: (
        <Space>
          <Checkbox checked={col.pinned} onChange={e => handleColumnVisibilityChange(col)}>
            {col.key === 'PHASE' ? project?.phase_label : ''}
            {col.key !== 'PHASE' &&
              (col.custom_column
                ? col.name
                : t(`${col.key?.replace('_', '').toLowerCase() + 'Text'}`))}
          </Checkbox>
        </Space>
      ),
    })),
    {
      type: 'divider' as const,
    },
    {
      key: 'configure',
      type: 'item' as const,
      label: (
        <Button
          type="text"
          icon={<SettingOutlined />}
          onClick={e => {
            e.stopPropagation();
            setConfigModalOpen(true);
          }}
          style={{ width: '100%', textAlign: 'left' }}
        >
          Configure Fields
        </Button>
      ),
    },
  ];

  return (
    <>
      <Dropdown
        menu={{
          items: menuItems,
          style: { maxHeight: '400px', overflowY: 'auto' },
        }}
        trigger={['click']}
      >
        <Button icon={<MoreOutlined />}>{t('showFieldsText')}</Button>
      </Dropdown>
      <ColumnConfigurationModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        projectId={projectId || undefined}
        onSave={handleConfigSave}
        currentConfig={columnConfig}
      />
    </>
  );
};

export default ShowFieldsFilterDropdown;
