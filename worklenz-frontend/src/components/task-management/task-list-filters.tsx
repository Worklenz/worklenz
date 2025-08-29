import React from 'react';

interface TaskListFiltersProps {
  selectedPriorities: string[];
  onPriorityChange: (priorities: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const TaskListFilters: React.FC<TaskListFiltersProps> = ({
  selectedPriorities,
  onPriorityChange,
  searchQuery,
  onSearchChange,
}) => {
  const priorities = ['High', 'Medium', 'Low'];

  return (
    <div className="task-list-filters">
      <div className="filter-group">
        <label>Priority:</label>
        <div className="priority-filters">
          {priorities.map(priority => (
            <label key={priority} className="priority-filter">
              <input
                type="checkbox"
                checked={selectedPriorities.includes(priority)}
                onChange={e => {
                  const newPriorities = e.target.checked
                    ? [...selectedPriorities, priority]
                    : selectedPriorities.filter(p => p !== priority);
                  onPriorityChange(newPriorities);
                }}
              />
              <span>{priority}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <label>Search:</label>
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search tasks..."
          className="search-input"
        />
      </div>
    </div>
  );
};

export default TaskListFilters;
