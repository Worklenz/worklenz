import React from 'react';
import { Select, Typography } from 'antd';
import { IGroupBy } from '@/features/tasks/tasks.slice';
import { IGroupByOption } from '@/types/tasks/taskList.types';

const { Text } = Typography;
const { Option } = Select;

interface GroupingSelectorProps {
  currentGrouping: IGroupBy;
  onChange: (groupBy: IGroupBy) => void;
  options: IGroupByOption[];
  disabled?: boolean;
}

const GroupingSelector: React.FC<GroupingSelectorProps> = ({
  currentGrouping,
  onChange,
  options,
  disabled = false,
}) => {
  return (
    <div className="flex items-center space-x-2">
      <Text className="text-sm text-gray-600">Group by:</Text>
      <Select
        value={currentGrouping}
        onChange={onChange}
        disabled={disabled}
        size="small"
        style={{ minWidth: 100 }}
        className="capitalize"
      >
        {options.map((option) => (
          <Option key={option.value} value={option.value} className="capitalize">
            {option.label}
          </Option>
        ))}
      </Select>
    </div>
  );
};

export default GroupingSelector; 