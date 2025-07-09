import React from 'react';
import { Card, Statistic, Tooltip, Badge } from 'antd';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import './PerformanceMonitor.css';

const PerformanceMonitor: React.FC = () => {
  const { performanceMetrics } = useSelector((state: RootState) => state.enhancedKanbanReducer);

  // Only show if there are tasks loaded
  if (performanceMetrics.totalTasks === 0) {
    return null;
  }

  const getPerformanceStatus = () => {
    if (performanceMetrics.totalTasks > 1000) return 'critical';
    if (performanceMetrics.totalTasks > 500) return 'warning';
    if (performanceMetrics.totalTasks > 100) return 'good';
    return 'excellent';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'red';
      case 'warning':
        return 'orange';
      case 'good':
        return 'blue';
      case 'excellent':
        return 'green';
      default:
        return 'default';
    }
  };

  const status = getPerformanceStatus();
  const statusColor = getStatusColor(status);

  return (
    <Card
      size="small"
      className="performance-monitor"
      title={
        <div className="performance-monitor-header">
          <span>Performance Monitor</span>
          <Badge
            status={statusColor as any}
            text={status.toUpperCase()}
            className="performance-status"
          />
        </div>
      }
    >
      <div className="performance-metrics">
        <Tooltip title="Total number of tasks across all groups">
          <Statistic
            title="Total Tasks"
            value={performanceMetrics.totalTasks}
            suffix="tasks"
            valueStyle={{ fontSize: '16px' }}
          />
        </Tooltip>

        <Tooltip title="Largest group by number of tasks">
          <Statistic
            title="Largest Group"
            value={performanceMetrics.largestGroupSize}
            suffix="tasks"
            valueStyle={{ fontSize: '16px' }}
          />
        </Tooltip>

        <Tooltip title="Average tasks per group">
          <Statistic
            title="Average Group"
            value={Math.round(performanceMetrics.averageGroupSize)}
            suffix="tasks"
            valueStyle={{ fontSize: '16px' }}
          />
        </Tooltip>

        <Tooltip title="Virtualization is enabled for groups with more than 50 tasks">
          <div className="virtualization-status">
            <span className="status-label">Virtualization:</span>
            <Badge
              status={performanceMetrics.virtualizationEnabled ? 'success' : 'default'}
              text={performanceMetrics.virtualizationEnabled ? 'Enabled' : 'Disabled'}
            />
          </div>
        </Tooltip>
      </div>

      {performanceMetrics.totalTasks > 500 && (
        <div className="performance-tips">
          <h4>Performance Tips:</h4>
          <ul>
            <li>Use filters to reduce the number of visible tasks</li>
            <li>Consider grouping by different criteria</li>
            <li>Virtualization is automatically enabled for large groups</li>
          </ul>
        </div>
      )}
    </Card>
  );
};

export default React.memo(PerformanceMonitor);
