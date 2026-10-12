import React from 'react';

// Shared by PlannerAddTaskModal and PlannerWorkloadView's unassigned-task lists so a
// subtask's "↳ ParentName / TaskName" breadcrumb stays identical in both places.
const SubtaskBreadcrumbLabel: React.FC<{
  isSubTask?: boolean;
  parentTaskName?: string;
  name: string;
}> = ({ isSubTask, parentTaskName, name }) => (
  <>
    {isSubTask && parentTaskName && (
      <span style={{ opacity: 0.5, fontWeight: 400 }}>↳ {parentTaskName} / </span>
    )}
    {name}
  </>
);

export default SubtaskBreadcrumbLabel;
