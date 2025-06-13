import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';

interface TimeLogsCellProps {
  billableTime: number;
  nonBillableTime: number;
}

const TimeLogsCell = ({ billableTime, nonBillableTime }: TimeLogsCellProps) => {
  const { t } = useTranslation('reporting-members');
  const totalTime = billableTime + nonBillableTime;
  
  if (totalTime === 0) return '-';

  const billablePercentage = Math.round((billableTime / totalTime) * 100);
  const nonBillablePercentage = 100 - billablePercentage;

  // Ensure minimum visibility for very small percentages
  const minWidth = 2; // minimum 2% width for visibility
  const billableWidth = Math.max(billablePercentage, billablePercentage > 0 ? minWidth : 0);
  const nonBillableWidth = Math.max(nonBillablePercentage, nonBillablePercentage > 0 ? minWidth : 0);

  // Format time in hours and minutes
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const tooltipContent = (
    <div className="text-sm">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
        <span>{t('billable')}: {formatTime(billableTime)} ({billablePercentage}%)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-gray-400 rounded-sm"></div>
        <span>{t('nonBillable')}: {formatTime(nonBillableTime)} ({nonBillablePercentage}%)</span>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-200">
        <span className="font-medium">Total: {formatTime(totalTime)}</span>
      </div>
    </div>
  );

  return (
    <Tooltip title={tooltipContent} placement="top">
      <div className="flex items-center cursor-pointer">
        <div className="relative w-24 h-4 rounded-full overflow-hidden flex border border-gray-300">
          {/* Billable time section (green) */}
          {billableTime > 0 && (
            <div 
              className="bg-green-500 transition-all duration-300 h-full"
              style={{ width: `${billableWidth}%` }}
            />
          )}
          {/* Non-billable time section (gray) */}
          {nonBillableTime > 0 && (
            <div 
              className="bg-gray-400 transition-all duration-300 h-full"
              style={{ width: `${nonBillableWidth}%` }}
            />
          )}
          {/* Percentage text overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-white drop-shadow-sm z-10">
              {billablePercentage}%
            </span>
          </div>
        </div>
      </div>
    </Tooltip>
  );
};

export default TimeLogsCell; 