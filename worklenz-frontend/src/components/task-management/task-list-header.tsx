import React from 'react';

interface TaskListHeaderProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const TaskListHeader: React.FC<TaskListHeaderProps> = ({ onExpandAll, onCollapseAll }) => {
  return (
    <div className="task-list-header">
      <div className="header-actions">
        <button className="btn btn-secondary btn-sm" onClick={onExpandAll}>
          Expand All
        </button>
        <button className="btn btn-secondary btn-sm ml-2" onClick={onCollapseAll}>
          Collapse All
        </button>
      </div>
    </div>
  );
};

export default TaskListHeader;
