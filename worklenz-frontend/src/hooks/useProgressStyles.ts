import { useMemo } from 'react';
import { ProgressProps } from '@/shared/antd-imports';

type WorkloadStatus = 'available' | 'normal' | 'fully-allocated' | 'overallocated';

interface UseProgressStylesProps {
  percent: number;
  status: WorkloadStatus;
  size?: 'small' | 'default';
  showInfo?: boolean;
}

export const useProgressStyles = ({
  percent,
  status,
  size = 'small',
  showInfo = false
}: UseProgressStylesProps): ProgressProps => {
  const getStatusColor = useMemo(() => {
    switch (status) {
      case 'available': return '#52c41a'; // Green
      case 'normal': return '#1890ff'; // Blue  
      case 'fully-allocated': return '#faad14'; // Orange
      case 'overallocated': return '#f5222d'; // Red
      default: return '#d9d9d9'; // Gray
    }
  }, [status]);

  const progressProps = useMemo((): ProgressProps => {
    const safePercent = Math.min(Math.max(percent, 0), 100);
    
    return {
      percent: safePercent,
      size,
      strokeColor: getStatusColor,
      showInfo,
      status: status === 'overallocated' ? 'exception' : undefined,
      // Use trailColor for better contrast in dark mode
      trailColor: 'rgba(0, 0, 0, 0.06)',
    };
  }, [percent, size, getStatusColor, showInfo, status]);

  return progressProps;
};

// Hook for workload-specific progress styling
export const useWorkloadProgress = (utilizationPercent: number) => {
  const status: WorkloadStatus = useMemo(() => {
    if (utilizationPercent > 100) return 'overallocated';
    if (utilizationPercent === 100) return 'fully-allocated';
    if (utilizationPercent >= 75) return 'normal';
    return 'available';
  }, [utilizationPercent]);

  return useProgressStyles({
    percent: utilizationPercent,
    status,
  });
};

// Theme-aware progress colors
export const getThemeAwareProgressColors = (isDarkMode: boolean) => {
  return {
    available: isDarkMode ? '#73d13d' : '#52c41a',
    normal: isDarkMode ? '#40a9ff' : '#1890ff',
    'fully-allocated': isDarkMode ? '#ffec3d' : '#faad14',
    overallocated: isDarkMode ? '#ff7875' : '#f5222d',
    default: isDarkMode ? '#434343' : '#d9d9d9',
  };
};