import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Button, 
  Typography, 
  Dropdown, 
  Popconfirm, 
  Tooltip, 
  Space,
  Badge,
  Divider
} from 'antd';
import {
  DeleteOutlined,
  CloseOutlined,
  MoreOutlined,
  RetweetOutlined,
  UserAddOutlined,
  InboxOutlined,
  TagsOutlined,
  UsergroupAddOutlined,
  CheckOutlined,
  EditOutlined,
  CopyOutlined,
  ExportOutlined,
  CalendarOutlined,
  FlagOutlined,
  BulbOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';

const { Text } = Typography;

interface OptimizedBulkActionBarProps {
  selectedTaskIds: string[];
  totalSelected: number;
  projectId: string;
  onClearSelection?: () => void;
  onBulkStatusChange?: (statusId: string) => void;
  onBulkPriorityChange?: (priorityId: string) => void;
  onBulkPhaseChange?: (phaseId: string) => void;
  onBulkAssignToMe?: () => void;
  onBulkAssignMembers?: (memberIds: string[]) => void;
  onBulkAddLabels?: (labelIds: string[]) => void;
  onBulkArchive?: () => void;
  onBulkDelete?: () => void;
  onBulkDuplicate?: () => void;
  onBulkExport?: () => void;
  onBulkSetDueDate?: (date: string) => void;
}

// Performance-optimized memoized action button component
const ActionButton = React.memo<{
  icon: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  loading?: boolean;
  danger?: boolean;
  disabled?: boolean;
  isDarkMode: boolean;
  badge?: number;
}>(({ icon, tooltip, onClick, loading = false, danger = false, disabled = false, isDarkMode, badge }) => {
  const buttonStyle = useMemo(() => ({
    background: 'transparent',
    color: isDarkMode ? '#e5e7eb' : '#374151',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    height: '32px',
    width: '32px',
    fontSize: '14px',
    borderRadius: '6px',
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    ...(danger && {
      color: '#ef4444',
    }),
  }), [isDarkMode, danger, disabled]);

  const hoverStyle = useMemo(() => ({
    backgroundColor: isDarkMode 
      ? (danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.1)')
      : (danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 0, 0.05)'),
    transform: 'scale(1.05)',
  }), [isDarkMode, danger]);

  const [isHovered, setIsHovered] = useState(false);

  const combinedStyle = useMemo(() => ({
    ...buttonStyle,
    ...(isHovered && !disabled ? hoverStyle : {}),
  }), [buttonStyle, hoverStyle, isHovered, disabled]);

  const ButtonComponent = (
    <Button
      icon={icon}
      style={combinedStyle}
      size="small"
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      type="text"
    />
  );

  return (
    <Tooltip title={tooltip} placement="top">
      {badge && badge > 0 ? (
        <Badge count={badge} size="small" offset={[-2, 2]}>
          {ButtonComponent}
        </Badge>
      ) : (
        ButtonComponent
      )}
    </Tooltip>
  );
});

ActionButton.displayName = 'ActionButton';

// Performance-optimized main component
const OptimizedBulkActionBarContent: React.FC<OptimizedBulkActionBarProps> = React.memo(({
  selectedTaskIds,
  totalSelected,
  projectId,
  onClearSelection,
  onBulkStatusChange,
  onBulkPriorityChange,
  onBulkPhaseChange,
  onBulkAssignToMe,
  onBulkAssignMembers,
  onBulkAddLabels,
  onBulkArchive,
  onBulkDelete,
  onBulkDuplicate,
  onBulkExport,
  onBulkSetDueDate,
}) => {
  const { t } = useTranslation('task-management');
  const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');
  
  // Performance state management
  const [isVisible, setIsVisible] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    status: false,
    priority: false,
    phase: false,
    assignToMe: false,
    assignMembers: false,
    labels: false,
    archive: false,
    delete: false,
    duplicate: false,
    export: false,
    dueDate: false,
  });

  // Smooth entrance animation
  useEffect(() => {
    if (totalSelected > 0) {
      // Micro-delay for smoother animation
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [totalSelected]);

  // Optimized loading state updater
  const updateLoadingState = useCallback((action: keyof typeof loadingStates, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [action]: loading }));
  }, []);

  // Memoized handlers with loading states
  const handleStatusChange = useCallback(async () => {
    updateLoadingState('status', true);
    try {
      await onBulkStatusChange?.('new-status-id');
    } finally {
      updateLoadingState('status', false);
    }
  }, [onBulkStatusChange, updateLoadingState]);

  const handlePriorityChange = useCallback(async () => {
    updateLoadingState('priority', true);
    try {
      await onBulkPriorityChange?.('new-priority-id');
    } finally {
      updateLoadingState('priority', false);
    }
  }, [onBulkPriorityChange, updateLoadingState]);

  const handlePhaseChange = useCallback(async () => {
    updateLoadingState('phase', true);
    try {
      await onBulkPhaseChange?.('new-phase-id');
    } finally {
      updateLoadingState('phase', false);
    }
  }, [onBulkPhaseChange, updateLoadingState]);

  const handleAssignToMe = useCallback(async () => {
    updateLoadingState('assignToMe', true);
    try {
      await onBulkAssignToMe?.();
    } finally {
      updateLoadingState('assignToMe', false);
    }
  }, [onBulkAssignToMe, updateLoadingState]);

  const handleArchive = useCallback(async () => {
    updateLoadingState('archive', true);
    try {
      await onBulkArchive?.();
    } finally {
      updateLoadingState('archive', false);
    }
  }, [onBulkArchive, updateLoadingState]);

  const handleDelete = useCallback(async () => {
    updateLoadingState('delete', true);
    try {
      await onBulkDelete?.();
    } finally {
      updateLoadingState('delete', false);
    }
  }, [onBulkDelete, updateLoadingState]);

  const handleDuplicate = useCallback(async () => {
    updateLoadingState('duplicate', true);
    try {
      await onBulkDuplicate?.();
    } finally {
      updateLoadingState('duplicate', false);
    }
  }, [onBulkDuplicate, updateLoadingState]);

  const handleExport = useCallback(async () => {
    updateLoadingState('export', true);
    try {
      await onBulkExport?.();
    } finally {
      updateLoadingState('export', false);
    }
  }, [onBulkExport, updateLoadingState]);

  // Memoized styles for better performance
  const containerStyle = useMemo((): React.CSSProperties => ({
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: `translateX(-50%) translateY(${isVisible ? '0' : '20px'})`,
    zIndex: 1000,
    background: isDarkMode 
      ? 'rgba(31, 41, 55, 0.95)' 
      : 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: '16px',
    padding: '12px 20px',
    boxShadow: isDarkMode
      ? '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(55, 65, 81, 0.3)'
      : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    minWidth: 'fit-content',
    maxWidth: '90vw',
    opacity: isVisible ? 1 : 0,
    visibility: isVisible ? 'visible' : 'hidden',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    border: isDarkMode 
      ? '1px solid rgba(55, 65, 81, 0.3)' 
      : '1px solid rgba(229, 231, 235, 0.8)',
  }), [isDarkMode, isVisible]);

  const textStyle = useMemo(() => ({
    color: isDarkMode ? '#f3f4f6' : '#374151',
    fontSize: '14px',
    fontWeight: 500,
    marginRight: '12px',
    whiteSpace: 'nowrap' as const,
  }), [isDarkMode]);

  // Quick actions dropdown menu
  const quickActionsMenu = useMemo(() => ({
    items: [
      {
        key: 'change-status',
        label: 'Change Status',
        icon: <RetweetOutlined />,
        onClick: handleStatusChange,
      },
      {
        key: 'change-priority',
        label: 'Change Priority', 
        icon: <FlagOutlined />,
        onClick: handlePriorityChange,
      },
      {
        key: 'change-phase',
        label: 'Change Phase',
        icon: <RetweetOutlined />,
        onClick: handlePhaseChange,
      },
      {
        key: 'set-due-date',
        label: 'Set Due Date',
        icon: <CalendarOutlined />,
        onClick: () => onBulkSetDueDate?.(new Date().toISOString()),
      },
      { 
        type: 'divider' as const,
        key: 'divider-1',
      },
      {
        key: 'duplicate',
        label: 'Duplicate Tasks',
        icon: <CopyOutlined />,
        onClick: handleDuplicate,
      },
      {
        key: 'export',
        label: 'Export Tasks',
        icon: <ExportOutlined />,
        onClick: handleExport,
      },
    ],
  }), [handleStatusChange, handlePriorityChange, handlePhaseChange, handleDuplicate, handleExport, onBulkSetDueDate]);

  // Don't render if no tasks selected
  if (totalSelected === 0) {
    return null;
  }

  return (
    <div style={containerStyle}>
      {/* Selection Count */}
      <Text style={textStyle}>
        <Badge 
          count={totalSelected} 
          style={{ 
            backgroundColor: isDarkMode ? '#3b82f6' : '#2563eb',
            color: 'white',
            fontSize: '11px',
            height: '18px',
            lineHeight: '18px',
            minWidth: '18px',
            marginRight: '6px'
          }}
        />
        {totalSelected} {totalSelected === 1 ? 'task' : 'tasks'} selected
      </Text>

      <Divider 
        type="vertical" 
        style={{ 
          height: '20px', 
          margin: '0 8px',
          borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)'
        }} 
      />

      {/* Actions in same order as original component */}
      <Space size={2}>
        {/* Change Status/Priority/Phase */}
        <Tooltip title="Change Status/Priority/Phase" placement="top">
          <Dropdown 
            menu={quickActionsMenu} 
            trigger={['click']}
            placement="top"
            arrow
          >
            <Button
              icon={<RetweetOutlined />}
              style={{
                background: 'transparent',
                color: isDarkMode ? '#e5e7eb' : '#374151',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                height: '32px',
                width: '32px',
                fontSize: '14px',
                borderRadius: '6px',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              size="small"
              type="text"
              loading={loadingStates.status || loadingStates.priority || loadingStates.phase}
            />
          </Dropdown>
        </Tooltip>

        {/* Change Labels */}
        <ActionButton
          icon={<TagsOutlined />}
          tooltip="Add Labels"
          onClick={() => onBulkAddLabels?.([])}
          loading={loadingStates.labels}
          isDarkMode={isDarkMode}
        />

        {/* Assign to Me */}
        <ActionButton
          icon={<UserAddOutlined />}
          tooltip="Assign to Me"
          onClick={handleAssignToMe}
          loading={loadingStates.assignToMe}
          isDarkMode={isDarkMode}
        />

        {/* Change Assignees */}
        <ActionButton
          icon={<UsergroupAddOutlined />}
          tooltip="Assign Members"
          onClick={() => onBulkAssignMembers?.([])}
          loading={loadingStates.assignMembers}
          isDarkMode={isDarkMode}
        />

        {/* Archive */}
        <ActionButton
          icon={<InboxOutlined />}
          tooltip="Archive"
          onClick={handleArchive}
          loading={loadingStates.archive}
          isDarkMode={isDarkMode}
        />

        {/* Delete */}
        <Popconfirm
          title={`Delete ${totalSelected} ${totalSelected === 1 ? 'task' : 'tasks'}?`}
          description="This action cannot be undone."
          onConfirm={handleDelete}
          okText="Delete"
          cancelText="Cancel"
          okType="danger"
          placement="top"
        >
          <ActionButton
            icon={<DeleteOutlined />}
            tooltip="Delete"
            loading={loadingStates.delete}
            danger
            isDarkMode={isDarkMode}
          />
        </Popconfirm>

        <Divider 
          type="vertical" 
          style={{ 
            height: '20px', 
            margin: '0 4px',
            borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)'
          }} 
        />

        {/* Clear Selection */}
        <ActionButton
          icon={<CloseOutlined />}
          tooltip="Clear Selection"
          onClick={onClearSelection}
          isDarkMode={isDarkMode}
        />
      </Space>
    </div>
  );
});

OptimizedBulkActionBarContent.displayName = 'OptimizedBulkActionBarContent';

// Portal wrapper for performance isolation
const OptimizedBulkActionBar: React.FC<OptimizedBulkActionBarProps> = React.memo((props) => {
  // Only render portal if tasks are selected for better performance
  if (props.totalSelected === 0) {
    return null;
  }

  return createPortal(
    <OptimizedBulkActionBarContent {...props} />,
    document.body,
    'optimized-bulk-action-bar'
  );
});

OptimizedBulkActionBar.displayName = 'OptimizedBulkActionBar';

export default OptimizedBulkActionBar; 