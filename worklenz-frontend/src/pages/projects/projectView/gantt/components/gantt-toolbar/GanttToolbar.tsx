import React, { memo } from 'react';
import { Select, Button, Space } from '@/shared/antd-imports';
import { ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined } from '@ant-design/icons';
import { GanttViewMode } from '../../types/gantt-types';

const { Option } = Select;

interface GanttToolbarProps {
  viewMode: GanttViewMode;
  onViewModeChange: (mode: GanttViewMode) => void;
  dateRange?: { start: Date; end: Date };
}

const GanttToolbar: React.FC<GanttToolbarProps> = memo(
  ({ viewMode, onViewModeChange, dateRange }) => {
    // Define zoom levels in order from most detailed to least detailed
    const zoomLevels: GanttViewMode[] = ['day', 'week', 'month', 'quarter', 'year'];
    const currentZoomIndex = zoomLevels.indexOf(viewMode);

    const handleZoomIn = () => {
      // Zoom in means more detail (lower index)
      if (currentZoomIndex > 0) {
        onViewModeChange(zoomLevels[currentZoomIndex - 1]);
      }
    };

    const handleZoomOut = () => {
      // Zoom out means less detail (higher index)
      if (currentZoomIndex < zoomLevels.length - 1) {
        onViewModeChange(zoomLevels[currentZoomIndex + 1]);
      }
    };

    const handleFullscreen = () => {
      // Toggle fullscreen mode
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn('Failed to enter fullscreen:', err);
        });
      } else {
        document.exitFullscreen().catch(err => {
          console.warn('Failed to exit fullscreen:', err);
        });
      }
    };
    return (
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <Space>
          <Select value={viewMode} onChange={onViewModeChange} className="w-32">
            <Option value="day">Day</Option>
            <Option value="week">Week</Option>
            <Option value="month">Month</Option>
            <Option value="quarter">Quarter</Option>
            <Option value="year">Year</Option>
          </Select>

          <Button
            icon={<ZoomInOutlined />}
            title="Zoom In"
            onClick={handleZoomIn}
            disabled={currentZoomIndex === 0}
            className="hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Button
            icon={<ZoomOutOutlined />}
            title="Zoom Out"
            onClick={handleZoomOut}
            disabled={currentZoomIndex === zoomLevels.length - 1}
            className="hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Button
            icon={<FullscreenOutlined />}
            title="Toggle Fullscreen"
            onClick={handleFullscreen}
            className="hover:text-blue-600 dark:hover:text-blue-400"
          />
        </Space>
      </div>
    );
  }
);

GanttToolbar.displayName = 'GanttToolbar';

export default GanttToolbar;
