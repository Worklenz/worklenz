import React from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleScheduleDrawer } from '../../../features/schedule/scheduleSlice';

type DayAllocationCellProps = {
  totalPerDayHours: number;
  loggedHours: number;
  workingHours: number;
  isWeekend: boolean;
};

const DayAllocationCell = ({
  totalPerDayHours,
  loggedHours,
  workingHours,
  isWeekend,
}: DayAllocationCellProps) => {
  const dispatch = useAppDispatch();

  // If it's a weekend, override values and disable interaction
  const effectiveTotalPerDayHours = isWeekend ? 0 : totalPerDayHours;
  const effectiveLoggedHours = isWeekend ? 0 : loggedHours;
  const effectiveWorkingHours = isWeekend ? 1 : workingHours; // Avoid division by zero

  const tooltipContent = isWeekend ? (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span>Weekend</span>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span>Total Allocation: {effectiveTotalPerDayHours + effectiveLoggedHours}h</span>
      <span>Time Logged: {effectiveLoggedHours}h</span>
      <span>Remaining Time: {effectiveTotalPerDayHours}h</span>
    </div>
  );

  const gradientColor = isWeekend
    ? 'rgba(200, 200, 200, 0.35)' // Inactive color for weekends
    : effectiveTotalPerDayHours <= 0
      ? 'rgba(200, 200, 200, 0.35)'
      : effectiveTotalPerDayHours <= effectiveWorkingHours
        ? 'rgba(6, 126, 252, 0.4)'
        : 'rgba(255, 0, 0, 0.4)';

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
            background: `linear-gradient(to top, ${gradientColor} ${
              (effectiveTotalPerDayHours * 100) / effectiveWorkingHours
            }%, rgba(190, 190, 190, 0.25) ${
              (effectiveTotalPerDayHours * 100) / effectiveWorkingHours
            }%)`,
            justifyContent: effectiveLoggedHours > 0 ? 'flex-end' : 'center',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            borderRadius: '5px',
            flexDirection: 'column',
            cursor: isWeekend ? 'not-allowed' : 'pointer', // Change cursor for weekends
          }}
          onClick={!isWeekend ? () => dispatch(toggleScheduleDrawer()) : undefined}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: `${(effectiveTotalPerDayHours * 100) / effectiveWorkingHours}%`,
            }}
          >
            {effectiveTotalPerDayHours}h
          </span>
          {effectiveLoggedHours > 0 && (
            <span
              style={{
                height: `${(effectiveLoggedHours * 100) / effectiveWorkingHours}%`,
                backgroundColor: 'rgba(98, 210, 130, 1)',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderBottomLeftRadius: '5px',
                borderBottomRightRadius: '5px',
              }}
            >
              {effectiveLoggedHours}h
            </span>
          )}
        </div>
      </Tooltip>
    </div>
  );
};

export default React.memo(DayAllocationCell);
