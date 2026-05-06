import React from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  toggleScheduleDrawer,
  setSelectedMember,
  setSelectedDate,
  setSelectedProject,
  setSelectedDateRange,
} from '../../../features/schedule/scheduleSliceRTK';
import { themeWiseColor } from '@/utils/themeWiseColor';

interface DailyCapacityData {
  date: string;
  working_hours: number;
  allocated_hours: number;
  available_hours: number;
  utilization_percent: number;
  is_time_off: boolean;
  is_weekend: boolean;
  status: 'available' | 'normal' | 'fully-allocated' | 'overallocated' | 'unavailable';
  projects: Array<{
    project_id: string;
    project_name: string;
    allocated_hours: number;
    color_code: string;
  }>;
}

type DayAllocationCellProps = {
  capacityData?: DailyCapacityData | null;
  memberName?: string;
  memberId?: string;
  date?: string;
  isWeekend?: boolean;
};

const DayAllocationCell = ({
  capacityData,
  memberName,
  memberId,
  date,
  isWeekend = false,
}: DayAllocationCellProps) => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const handleClick = () => {
    if (isInteractive && memberId) {
      // Set selected member and date before opening drawer
      dispatch(setSelectedMember(memberId));
      dispatch(setSelectedDate(date || null));
      // Clear project and date range (cell click is for member view, not project-specific)
      dispatch(setSelectedProject(null));
      dispatch(setSelectedDateRange(null));
      dispatch(toggleScheduleDrawer());
    }
  };

  // Use capacity data if available, otherwise show empty/unavailable state
  const effectiveData = capacityData || {
    working_hours: 0,
    allocated_hours: 0,
    available_hours: 0,
    utilization_percent: 0,
    is_time_off: false,
    is_weekend: isWeekend,
    status: 'unavailable' as const,
    projects: [],
  };

  const getStatusColors = () => {
    const isDark = themeMode === 'dark';

    switch (effectiveData.status) {
      case 'available':
        return {
          bg: isDark ? 'rgba(82, 196, 26, 0.2)' : 'rgba(34, 197, 94, 0.2)',
          border: isDark ? 'rgba(82, 196, 26, 0.4)' : 'rgba(34, 197, 94, 0.4)',
          text: isDark ? '#95de64' : '#22c55e',
          indicator: '#22c55e',
        };
      case 'normal':
        return {
          bg: isDark ? 'rgba(24, 144, 255, 0.2)' : 'rgba(6, 126, 252, 0.4)',
          border: isDark ? 'rgba(24, 144, 255, 0.4)' : 'rgba(6, 126, 252, 0.6)',
          text: isDark ? '#69c0ff' : '#3b82f6',
          indicator: '#3b82f6',
        };
      case 'fully-allocated':
        return {
          bg: isDark ? 'rgba(250, 173, 20, 0.2)' : 'rgba(251, 191, 36, 0.4)',
          border: isDark ? 'rgba(250, 173, 20, 0.4)' : 'rgba(251, 191, 36, 0.6)',
          text: isDark ? '#ffc53d' : '#f59e0b',
          indicator: '#f59e0b',
        };
      case 'overallocated':
        return {
          bg: isDark ? 'rgba(245, 34, 45, 0.2)' : 'rgba(239, 68, 68, 0.4)',
          border: isDark ? 'rgba(245, 34, 45, 0.4)' : 'rgba(239, 68, 68, 0.6)',
          text: isDark ? '#ff7875' : '#dc2626',
          indicator: '#ef4444',
        };
      case 'unavailable':
      default:
        return {
          bg: isDark ? 'rgba(140, 140, 140, 0.2)' : 'rgba(200, 200, 200, 0.35)',
          border: 'transparent',
          text: isDark ? '#8c8c8c' : '#6b7280',
          indicator: '#6b7280',
        };
    }
  };

  const colors = getStatusColors();

  const tooltipContent = effectiveData.is_time_off ? (
    <div style={{ minWidth: 200 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
        {memberName} - {date}
      </div>
      <div style={{ color: '#faad14', fontSize: '14px' }}>🔵 Time Off</div>
    </div>
  ) : effectiveData.is_weekend ? (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span>Weekend</span>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 200 }}>
      {memberName && (
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
          {memberName} - {date}
        </div>
      )}
      <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #ddd' }} />
      <span>Working Hours: {effectiveData.working_hours}h</span>
      <span>Allocated: {effectiveData.allocated_hours.toFixed(1)}h</span>
      <span>Available: {effectiveData.available_hours.toFixed(1)}h</span>
      <span>Utilization: {effectiveData.utilization_percent.toFixed(0)}%</span>
      {/* <span>
        <strong>Status: {effectiveData.status.replace('-', ' ').toUpperCase()}</strong>
      </span> */}

      {/* {effectiveData.projects && effectiveData.projects.length > 0 && (
        <>
          <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #ddd' }} />
          <div style={{ fontWeight: 'bold', marginTop: 4, marginBottom: 4 }}>
            Projects:
          </div>
          {effectiveData.projects.map(project => (
            <div key={project.project_id} style={{ marginLeft: 8, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: project.color_code,
              }} />
              <span style={{ fontSize: '12px' }}>
                {project.project_name}: {project.allocated_hours.toFixed(1)}h
              </span>
            </div>
          ))}
        </>
      )} */}
    </div>
  );

  const isInteractive = !effectiveData.is_weekend && !effectiveData.is_time_off;

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
        pointerEvents: isInteractive ? 'auto' : 'none',
      }}
    >
      <Tooltip title={tooltipContent}>
        <div
          style={{
            width: '63px',
            background: isInteractive
              ? `linear-gradient(to top, ${colors.bg} ${Math.min(
                  effectiveData.utilization_percent,
                  100
                )}%, rgba(190, 190, 190, 0.25) ${Math.min(
                  effectiveData.utilization_percent,
                  100
                )}%)`
              : colors.bg,
            justifyContent: 'center',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            borderRadius: '5px',
            flexDirection: 'column',
            cursor: isInteractive ? 'pointer' : 'not-allowed',
            border: `2px solid ${colors.border}`,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s',
          }}
          // onClick={handleClick}
          className={isInteractive ? 'hover:opacity-80' : ''}
        >
          {/* Over-allocation warning stripe */}
          {effectiveData.status === 'overallocated' && (
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

          {/* Time-off indicator */}
          {effectiveData.is_time_off && <div style={{ fontSize: '24px' }}>🔵</div>}

          {/* Weekend indicator */}
          {effectiveData.is_weekend && !effectiveData.is_time_off && (
            <div style={{ fontSize: '16px', color: colors.text }}>-</div>
          )}

          {/* Capacity display */}
          {isInteractive && (
            <>
              {/* <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: effectiveData.status === 'overallocated' ? 'bold' : 'normal',
                  color: colors.text,
                }}
              >
                {effectiveData.utilization_percent.toFixed(0)}%
              </span> */}
              <span
                style={{
                  fontSize: '12px',
                  opacity: 0.7,
                  color: colors.text,
                }}
              >
                {effectiveData.allocated_hours.toFixed(1)}/{effectiveData.working_hours}h
              </span>
            </>
          )}

          {/* Status indicator dot */}
          {isInteractive && (
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: colors.indicator,
                border: `1px solid ${themeWiseColor('#fff', '#141414', themeMode)}`,
              }}
            />
          )}
        </div>
      </Tooltip>
    </div>
  );
};

export default React.memo(DayAllocationCell);
