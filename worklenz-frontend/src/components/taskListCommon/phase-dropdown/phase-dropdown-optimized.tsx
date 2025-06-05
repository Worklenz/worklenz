import React, { useMemo, useCallback, useState } from 'react';
import { Badge, Flex, Select, Tooltip, Typography } from 'antd';
import './phase-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ALPHA_CHANNEL } from '@/shared/constants';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';

interface PhaseDropdownProps {
  task: IProjectTask;
}

// Memoized option component
const PhaseOption = React.memo(({ phase }: { phase: any }) => {
  if (!phase) return null;
  
  return (
    <Flex gap={4} align="center">
      <Badge color={phase.color_code} />
      <Tooltip title={phase.name || ''}>
        <Typography.Text ellipsis style={{ maxWidth: 100 }}>
          {phase.name || ''}
        </Typography.Text>
      </Tooltip>
    </Flex>
  );
});

// Memoized label component
const PhaseLabel = React.memo(({ phase }: { phase: any }) => {
  if (!phase) return null;
  
  return (
    <div
      style={{
        width: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      <Flex
        gap={6}
        align="center"
        style={{
          width: 'fit-content',
          borderRadius: 24,
          paddingInline: 8,
          height: 22,
          fontSize: 13,
          color: colors.darkGray,
        }}
      >
        <Tooltip title={phase.name || ''}>
          <Typography.Text
            ellipsis
            style={{
              fontSize: 13,
              maxWidth: 90,
            }}
          >
            {phase.name || ''}
          </Typography.Text>
        </Tooltip>
      </Flex>
    </div>
  );
});

const PhaseDropdownOptimized = React.memo<PhaseDropdownProps>(({ task }) => {
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();
  const [currentPhase, setCurrentPhase] = useState<string | null>(task.phase_id || null);
  const { phaseList } = useAppSelector(state => state.phaseReducer);

  // Memoize phase options
  const phaseOptions = useMemo(() => {
    if (!phaseList || !Array.isArray(phaseList)) return [];
    
    return phaseList
      .filter(phase => phase && phase.id && phase.name) // Filter out invalid phases
      .map(phase => ({
        value: phase.id,
        label: phase.name,
        phase: phase // Store the phase data for rendering
      }));
  }, [phaseList]);

  // Memoize handlers
  const handlePhaseOptionSelect = useCallback((value: string) => {
    if (!connected || !task.id || !value) return;
    try {
      socket?.emit(
        SocketEvents.TASK_PHASE_CHANGE.toString(),
        {
          task_id: task.id,
          phase_id: value,
          parent_task: task.parent_task_id,
        },
        (error: Error | null) => {
          if (error) {
            logger.error('Phase change failed:', error);
          }
        }
      );
      setCurrentPhase(value);
    } catch (error) {
      logger.error('Error in handlePhaseOptionSelect:', error);
    }
  }, [connected, task.id, task.parent_task_id, socket]);

  const handlePhaseOptionClear = useCallback(() => {
    if (!connected || !task.id) return;
    try {
      socket?.emit(
        SocketEvents.TASK_PHASE_CHANGE.toString(),
        {
          task_id: task.id,
          phase_id: null,
          parent_task: task.parent_task_id,
        },
        (error: Error | null) => {
          if (error) {
            logger.error('Phase clear failed:', error);
          }
        }
      );
      setCurrentPhase(null);
    } catch (error) {
      logger.error('Error in handlePhaseOptionClear:', error);
    }
  }, [connected, task.id, task.parent_task_id, socket]);

  // Memoize placeholder
  const placeholder = useMemo(() => (
    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
      {t('selectText')}
    </Typography.Text>
  ), [t]);

  // Memoize style
  const selectStyle = useMemo(() => ({
    backgroundColor: currentPhase ? task.phase_color + ALPHA_CHANNEL : undefined,
    borderRadius: 16,
    height: 22,
    width: 120,
    textAlign: 'left' as const,
  }), [currentPhase, task.phase_color]);

  // Memoize dropdown style
  const dropdownStyle = useMemo(() => ({ minWidth: 150 }), []);

  // Memoize option renderer
  const optionRenderer = useCallback((option: any) => {
    if (!option || !option.phase) return null;
    return <PhaseOption phase={option.phase} />;
  }, []);

  // Memoize label renderer  
  const labelRenderer = useCallback((option: any) => {
    if (!option || !option.phase) return null;
    return <PhaseLabel phase={option.phase} />;
  }, []);

  return (
    <Select
      className="phase-select"
      placeholder={placeholder}
      value={currentPhase}
      onChange={handlePhaseOptionSelect}
      onClear={handlePhaseOptionClear}
      variant="borderless"
      dropdownStyle={dropdownStyle}
      popupClassName="phase-select-dropdown"
      allowClear
      style={selectStyle}
      options={phaseOptions}
      optionRender={optionRenderer}
      labelRender={labelRenderer}
      // Performance optimizations
      virtual={false}
      showSearch={false}
      notFoundContent={null}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.phase_id === nextProps.task.phase_id &&
    prevProps.task.phase_color === nextProps.task.phase_color
  );
});

PhaseDropdownOptimized.displayName = 'PhaseDropdownOptimized';

export default PhaseDropdownOptimized; 