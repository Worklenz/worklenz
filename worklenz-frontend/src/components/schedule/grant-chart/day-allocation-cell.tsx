import React from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleScheduleDrawer } from '../../../features/schedule/scheduleSlice';

type DayAllocationCellProps = {
  totalPerDayHours: number;
  loggedHours: number;
  workingHours: number;
  isWeekend: boolean;
  capacity?: number;
  availableHours?: number;
  memberName?: string;
  date?: string;
};

const DayAllocationCell = ({
  totalPerDayHours,
  loggedHours,
  workingHours,
  isWeekend,
  capacity = 100,
  availableHours = workingHours,
  memberName,
  date,
}: DayAllocationCellProps) => {
  const dispatch = useAppDispatch();

  // If it's a weekend, override values and disable interaction
  const effectiveTotalPerDayHours = isWeekend ? 0 : totalPerDayHours;
  const effectiveLoggedHours = isWeekend ? 0 : loggedHours;
  const effectiveWorkingHours = isWeekend ? 1 : workingHours; // Avoid division by zero
  const effectiveAvailableHours = isWeekend ? 0 : availableHours;

  // Calculate utilization percentage
  const utilizationPercent =
    effectiveAvailableHours > 0
      ? ((effectiveTotalPerDayHours + effectiveLoggedHours) / effectiveAvailableHours) * 100
      : 0;

  // Determine workload status
  const getWorkloadStatus = () => {
    if (isWeekend) return 'weekend';
    if (utilizationPercent === 0) return 'available';
    if (utilizationPercent <= 75) return 'normal';
    if (utilizationPercent <= 100) return 'fully-allocated';
    return 'overallocated';
  };

  const workloadStatus = getWorkloadStatus();

  const tooltipContent = isWeekend ? (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span>Weekend</span>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {memberName && (
        <span>
          <strong>{memberName}</strong>
        </span>
      )}
      {date && <span>{date}</span>}
      <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #ddd' }} />
      <span>Available: {effectiveAvailableHours}h</span>
      <span>Allocated: {effectiveTotalPerDayHours}h</span>
      <span>Logged: {effectiveLoggedHours}h</span>
      <span>Total Used: {effectiveTotalPerDayHours + effectiveLoggedHours}h</span>
      <span>Utilization: {utilizationPercent.toFixed(1)}%</span>
      <span>
        <strong>Status: {workloadStatus.replace('-', ' ').toUpperCase()}</strong>
      </span>
    </div>
  );

  // Enhanced color coding based on workload status
  const getWorkloadColors = () => {
    switch (workloadStatus) {
      case 'weekend':
        return {
          background: 'rgba(200, 200, 200, 0.35)',
          border: 'transparent',
        };
      case 'available':
        return {
          background: 'rgba(34, 197, 94, 0.2)', // Green for available
          border: 'rgba(34, 197, 94, 0.4)',
        };
      case 'normal':
        return {
          background: 'rgba(6, 126, 252, 0.4)', // Blue for normal
          border: 'rgba(6, 126, 252, 0.6)',
        };
      case 'fully-allocated':
        return {
          background: 'rgba(251, 191, 36, 0.4)', // Yellow for fully allocated
          border: 'rgba(251, 191, 36, 0.6)',
        };
      case 'overallocated':
        return {
          background: 'rgba(239, 68, 68, 0.4)', // Red for overallocated
          border: 'rgba(239, 68, 68, 0.6)',
        };
      default:
        return {
          background: 'rgba(200, 200, 200, 0.35)',
          border: 'transparent',
        };
    }
  };

  const { background: gradientColor, border: borderColor } = getWorkloadColors();

  return (
    <div
      style={{
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '10px 7px',
        height: '92px',
        flexDirection: 'column',
        pointerEvents: isWeekend ? 'none' : 'auto',
      }}
    >
      <Tooltip title={tooltipContent}>
        <div
          style={{
            width: '63px',
            background: !isWeekend
              ? `linear-gradient(to top, ${gradientColor} ${Math.min(
                  (effectiveTotalPerDayHours * 100) / effectiveAvailableHours,
                  100
                )}%, rgba(190, 190, 190, 0.25) ${Math.min(
                  (effectiveTotalPerDayHours * 100) / effectiveAvailableHours,
                  100
                )}%)`
              : gradientColor,
            justifyContent: effectiveLoggedHours > 0 ? 'flex-end' : 'center',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            borderRadius: '5px',
            flexDirection: 'column',
            cursor: isWeekend ? 'not-allowed' : 'pointer',
            border: `2px solid ${borderColor}`,
            position: 'relative',
            overflow: 'hidden',
          }}
          onClick={!isWeekend ? () => dispatch(toggleScheduleDrawer()) : undefined}
        >
          {/* Workload indicator bar */}
          {!isWeekend && utilizationPercent > 100 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background:
                  'repeating-linear-gradient(45deg, #ef4444, #ef4444 4px, #fbbf24 4px, #fbbf24 8px)',
                zIndex: 1,
              }}
            />
          )}

          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: `${Math.min((effectiveTotalPerDayHours * 100) / effectiveAvailableHours, 85)}%`,
              fontSize: '12px',
              fontWeight: workloadStatus === 'overallocated' ? 'bold' : 'normal',
              color: workloadStatus === 'overallocated' ? '#dc2626' : 'inherit',
            }}
          >
            {effectiveTotalPerDayHours > 0 ? `${effectiveTotalPerDayHours}h` : ''}
          </span>
          {effectiveLoggedHours > 0 && (
            <span
              style={{
                height: `${Math.min((effectiveLoggedHours * 100) / effectiveAvailableHours, 100)}%`,
                backgroundColor: 'rgba(34, 197, 94, 0.9)',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderBottomLeftRadius: '3px',
                borderBottomRightRadius: '3px',
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'white',
                position: 'relative',
              }}
            >
              {effectiveLoggedHours}h
            </span>
          )}

          {/* Capacity indicator */}
          {!isWeekend && (
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor:
                  workloadStatus === 'available'
                    ? '#22c55e'
                    : workloadStatus === 'normal'
                      ? '#3b82f6'
                      : workloadStatus === 'fully-allocated'
                        ? '#f59e0b'
                        : workloadStatus === 'overallocated'
                          ? '#ef4444'
                          : '#6b7280',
                border: '1px solid white',
                fontSize: '8px',
              }}
            />
          )}
        </div>
      </Tooltip>
    </div>
  );
};

export default React.memo(DayAllocationCell);
