import { MoreOutlined, SettingOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import Button from 'antd/es/button';
import Checkbox from 'antd/es/checkbox';
import Dropdown from 'antd/es/dropdown';
import Space from 'antd/es/space';
import React, { useState } from 'react';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  updateColumnVisibility,
  updateCustomColumnPinned,
  toggleColumnVisibility,
} from '@/features/tasks/tasks.slice';
import { ITaskListColumn } from '@/types/tasks/taskList.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useCustomColumnVisibility } from '@/hooks/useCustomColumnVisibility';
import ColumnConfigurationModal from './column-configuration-modal';

// Configuration interface for column visibility
interface ColumnConfig {
  key: string;
  label: string;
  showInDropdown: boolean;
  order: number;
  category?: string;
}

const STANDARD_COLUMN_KEYS = new Set([
  'KEY',
  'TASK',
  'DESCRIPTION',
  'PROGRESS',
  'STATUS',
  'ASSIGNEES',
  'LABELS',
  'PHASE',
  'PRIORITY',
  'TIME_TRACKING',
  'ESTIMATION',
  'START_DATE',
  'DUE_DATE',
  'DUE_TIME',
  'COMPLETED_DATE',
  'CREATED_DATE',
  'LAST_UPDATED',
  'REPORTER',
]);

// Default column configuration - this can be customized per project or globally
const DEFAULT_COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'KEY', label: 'Key', showInDropdown: true, order: 1, category: 'basic' },
  { key: 'TASK', label: 'Task', showInDropdown: false, order: 2, category: 'basic' },
  { key: 'DESCRIPTION', label: 'Description', showInDropdown: true, order: 3, category: 'basic' },
  { key: 'PROGRESS', label: 'Progress', showInDropdown: true, order: 4, category: 'basic' },
  { key: 'STATUS', label: 'Status', showInDropdown: true, order: 5, category: 'basic' },
  { key: 'ASSIGNEES', label: 'Assignees', showInDropdown: true, order: 6, category: 'basic' },
  { key: 'LABELS', label: 'Labels', showInDropdown: true, order: 7, category: 'basic' },
  { key: 'PHASE', label: 'Phase', showInDropdown: true, order: 8, category: 'basic' },
  { key: 'PRIORITY', label: 'Priority', showInDropdown: true, order: 9, category: 'basic' },
  {
    key: 'TIME_TRACKING',
    label: 'Time',
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

// Hook to get column configuration
const useColumnConfig = (projectId?: string): ColumnConfig[] => {
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
  const { isHidden, toggleVisibility } = useCustomColumnVisibility(); // ← ADDED

  // Update config if projectId changes
  React.useEffect(() => {
    setColumnConfig(useColumnConfig(projectId || undefined));
  }, [projectId, configModalOpen]);

  // Filter columns based on configuration
  const visibilityChangableColumnList = columnList.filter(column => {
    if (column.key === 'selector' || column.key === 'TASK') {
      return false;
    }

    const config = columnConfig.find(c => c.key === column.key);

    if (!config) {
      return column.custom_column;
    }

    return config.showInDropdown;
  });

  // Dedupe columns by id/key
  const uniqueVisibilityColumns = Array.from(
    visibilityChangableColumnList
      .reduce((map, column) => {
        const identity = column.id || column.key || '';
        if (!identity) return map;
        map.set(identity, column);
        return map;
      }, new Map<string, ITaskListColumn>())
      .values()
  );

  // Sort columns based on configuration order
  const sortedColumns = uniqueVisibilityColumns.sort((a, b) => {
    const configA = columnConfig.find(c => c.key === a.key);
    const configB = columnConfig.find(c => c.key === b.key);

    const orderA = configA?.order ?? 999;
    const orderB = configB?.order ?? 999;

    return orderA - orderB;
  });

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const isCustomColumn = (column: ITaskListColumn): boolean => {
    const key = column.key || '';
    const keyLooksStandard = STANDARD_COLUMN_KEYS.has(key);
    return !!column.custom_column || !!column.custom_column_obj || !keyLooksStandard;
  };

  const handleColumnVisibilityChange = async (col: ITaskListColumn) => {
    if (!projectId) return;
    const column = { ...col, is_visible: !col.pinned, pinned: !col.pinned };

    if (isCustomColumn(col)) {
      // Toggle per-user visibility via our hook (persisted to localStorage per user)
      const id = col.id || col.key || '';
      toggleVisibility(id); // ← ADDED

      if (col.key) {
        dispatch(toggleColumnVisibility(col.key));
      }

      if (col.id) {
        dispatch(
          updateCustomColumnPinned({ columnId: col.id, columnKey: col.key, isVisible: !col.pinned })
        );
        socket?.emit(SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(), {
          column_id: col.id,
          project_id: projectId,
          is_visible: !col.pinned,
        });
      } else {
        dispatch(updateCustomColumnPinned({ columnKey: col.key, isVisible: !col.pinned }));
      }
    } else {
      if (col.key) {
        dispatch(toggleColumnVisibility(col.key));
      }

      try {
        await dispatch(updateColumnVisibility({ projectId, item: column })).unwrap();
      } catch (_error) {
        if (col.key) {
          dispatch(toggleColumnVisibility(col.key));
        }
      }
    }
  };

  const handleConfigSave = (newConfig: ColumnConfig[]) => {
    setColumnConfig(newConfig);
    if (projectId) saveColumnConfig(projectId, newConfig);
  };

  const standardColumns = sortedColumns.filter(col => !isCustomColumn(col));
  const customColumns = sortedColumns.filter(col => isCustomColumn(col));

  const toColumnMenuItem = (col: ITaskListColumn, index: number) => ({
    key: `${col.id || col.key || 'col'}-${index}`,
    type: 'item' as const,
    label: (
      <Space>
        <Checkbox
          checked={isCustomColumn(col) ? !isHidden(col.id || col.key || '') : col.pinned} // ← MODIFIED
          onChange={e => handleColumnVisibilityChange(col)}
        >
          {col.key === 'PHASE' ? project?.phase_label : ''}
          {col.key !== 'PHASE' &&
            (isCustomColumn(col)
              ? col.name
              : t(`${col.key?.replace('_', '').toLowerCase() + 'Text'}`, {
                  defaultValue: col.name || col.key || '',
                }))}
        </Checkbox>
      </Space>
    ),
  });

  const menuItems = [
    {
      key: 'standard-fields-header',
      type: 'item' as const,
      disabled: true,
      label: t('standardFieldsSection', { defaultValue: 'Standard fields' }),
    },
    ...standardColumns.map(toColumnMenuItem),
    ...(customColumns.length
      ? [
          {
            type: 'divider' as const,
          },
          {
            key: 'custom-fields-header',
            type: 'item' as const,
            disabled: true,
            label: t('customFieldsSection', { defaultValue: 'Custom fields' }),
          },
          ...customColumns.map(toColumnMenuItem),
        ]
      : []),
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
          {t('configureFieldsButton', { defaultValue: 'Configure Fields' })}
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
        <Button icon={<MoreOutlined />}>
          {t('showFieldsText', { defaultValue: 'Fields' })}
        </Button>
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