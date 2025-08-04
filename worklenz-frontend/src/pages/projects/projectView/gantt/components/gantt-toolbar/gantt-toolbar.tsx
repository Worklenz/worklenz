import React, { memo } from 'react';
import { Select, Button, Space, Divider } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, PlusOutlined, FlagOutlined } from '@ant-design/icons';
import { GanttViewMode } from '../../types/gantt-types';

const { Option } = Select;

interface GanttToolbarProps {
  viewMode: GanttViewMode;
  onViewModeChange: (mode: GanttViewMode) => void;
  dateRange?: { start: Date; end: Date };
  onCreatePhase?: () => void;
  onCreateTask?: () => void;
}

const GanttToolbar: React.FC<GanttToolbarProps> = memo(({ viewMode, onViewModeChange, dateRange, onCreatePhase, onCreateTask }) => {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
      <Space>
        <Button 
          type="primary"
          icon={<FlagOutlined />}
          onClick={onCreatePhase}
          className="bg-blue-600 hover:bg-blue-700 border-blue-600"
        >
          Manage Phases
        </Button>
        <Button 
          icon={<PlusOutlined />}
          onClick={onCreateTask}
          className="hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-600"
        >
          Add Task
        </Button>
        <Divider type="vertical" className="bg-gray-300 dark:bg-gray-600" />
        <Select
          value={viewMode}
          onChange={onViewModeChange}
          className="w-32"
        >
          <Option value="day">Day</Option>
          <Option value="week">Week</Option>
          <Option value="month">Month</Option>
          <Option value="quarter">Quarter</Option>
          <Option value="year">Year</Option>
        </Select>
        
        <Button 
          icon={<ZoomInOutlined />} 
          title="Zoom In" 
          className="hover:text-blue-600 dark:hover:text-blue-400"
        />
        <Button 
          icon={<ZoomOutOutlined />} 
          title="Zoom Out" 
          className="hover:text-blue-600 dark:hover:text-blue-400"
        />
        <Button 
          icon={<FullscreenOutlined />} 
          title="Fullscreen" 
          className="hover:text-blue-600 dark:hover:text-blue-400"
        />
      </Space>
    </div>
  );
});

GanttToolbar.displayName = 'GanttToolbar';

export default GanttToolbar;