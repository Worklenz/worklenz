import { Badge, Flex, Select, Tooltip, Typography } from '@/shared/antd-imports';

import './phase-dropdown.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ALPHA_CHANNEL } from '@/shared/constants';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import { useState } from 'react';

interface PhaseDropdownProps {
  task: IProjectTask;
}

const PhaseDropdown = ({ task }: PhaseDropdownProps) => {
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();
  const [currentPhase, setCurrentPhase] = useState<string | null>(task.phase_id || null);
  const { phaseList } = useAppSelector(state => state.phaseReducer);

  // Handle phase select
  const handlePhaseOptionSelect = (value: string) => {
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
  };

  const handlePhaseOptionClear = () => {
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
  };

  return (
    <Select
      className="phase-select"
      placeholder={
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t('selectText')}
        </Typography.Text>
      }
      value={currentPhase}
      onChange={handlePhaseOptionSelect}
      onClear={() => handlePhaseOptionClear()}
      variant="borderless"
      dropdownStyle={{ minWidth: 150 }}
      optionLabelProp="label"
      popupClassName="phase-select-dropdown"
      allowClear
      style={{
        backgroundColor: currentPhase ? task.phase_color + ALPHA_CHANNEL : undefined,
        borderRadius: 16,
        height: 22,
        width: 120,
        textAlign: 'left',
      }}
    >
      {phaseList?.map(phase => (
        <Select.Option
          key={phase.id}
          value={phase.id}
          label={
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
                <Tooltip title={phase.name}>
                  <Typography.Text
                    ellipsis
                    style={{
                      fontSize: 13,
                      maxWidth: 90,
                    }}
                  >
                    {phase.name}
                  </Typography.Text>
                </Tooltip>
              </Flex>
            </div>
          }
        >
          <Flex gap={4} align="center">
            <Badge color={phase.color_code} />
            <Tooltip title={phase.name}>
              <Typography.Text ellipsis style={{ maxWidth: 100 }}>
                {phase.name}
              </Typography.Text>
            </Tooltip>
          </Flex>
        </Select.Option>
      ))}
    </Select>
  );
};

export default PhaseDropdown;
