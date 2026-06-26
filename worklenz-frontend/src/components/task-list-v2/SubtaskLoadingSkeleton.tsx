import React from 'react';

interface SubtaskLoadingSkeletonProps {
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
}

const SubtaskLoadingSkeleton: React.FC<SubtaskLoadingSkeletonProps> = ({ visibleColumns }) => {
  const renderColumn = (columnId: string, width: string) => {
    const baseStyle = { width };

    switch (columnId) {
      case 'dragHandle':
        return <div style={baseStyle} />;
      case 'checkbox':
        return <div style={baseStyle} />;
      case 'taskKey':
        return (
          <div style={baseStyle} className="flex items-center pl-3">
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse border border-gray-300 dark:border-gray-600" />
          </div>
        );
      case 'title':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="w-4" />
            <div className="w-2" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'description':
        return (
          <div style={baseStyle} className="flex items-center px-2">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'status':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'assignees':
        return (
          <div style={baseStyle} className="flex items-center gap-1">
            <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          </div>
        );
      case 'priority':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'dueDate':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'progress':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'labels':
        return (
          <div style={baseStyle} className="flex items-center gap-1">
            <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'phase':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'timeTracking':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'estimation':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'startDate':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'completedDate':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'createdDate':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'lastUpdated':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      case 'reporter':
        return (
          <div style={baseStyle} className="flex items-center">
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        );
      default:
        return <div style={baseStyle} />;
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border-l-2 border-blue-200 dark:border-blue-700">
      <div className="flex items-center min-w-max px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        {visibleColumns.map((column, index) => (
          <div key={column.id}>{renderColumn(column.id, column.width)}</div>
        ))}
      </div>
    </div>
  );
};

export default SubtaskLoadingSkeleton;
