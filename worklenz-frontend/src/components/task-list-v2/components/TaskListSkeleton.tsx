import React from 'react';
import { Skeleton } from '@/shared/antd-imports';
import ImprovedTaskFilters from '@/components/task-management/improved-task-filters';

interface TaskListSkeletonProps {
  visibleColumns?: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
}

const TaskListSkeleton: React.FC<TaskListSkeletonProps> = ({ visibleColumns }) => {
  // Default columns if none provided
  const defaultColumns = [
    { id: 'dragHandle', width: '40px' },
    { id: 'checkbox', width: '40px' },
    { id: 'taskKey', width: '100px' },
    { id: 'title', width: '300px' },
    { id: 'assignees', width: '120px' },
    { id: 'status', width: '120px' },
    { id: 'priority', width: '100px' },
    { id: 'dueDate', width: '120px' },
  ];

  const columns = visibleColumns || defaultColumns;

  // Generate multiple skeleton rows
  const skeletonRows = Array.from({ length: 8 }, (_, index) => (
    <div
      key={index}
      className="flex items-center min-w-max px-1 py-3 border-b border-gray-100 dark:border-gray-800"
    >
      {columns.map((column, colIndex) => {
        const columnStyle = {
          width: column.width,
          flexShrink: 0,
        };

        return (
          <div
            key={`${index}-${column.id}`}
            className="border-r border-gray-200 dark:border-gray-700 flex items-center px-2"
            style={columnStyle}
          >
            {column.id === 'dragHandle' || column.id === 'checkbox' ? (
              <Skeleton.Button size="small" shape="circle" active />
            ) : column.id === 'title' ? (
              <div className="w-full">
                <Skeleton.Input size="small" active style={{ width: '80%' }} />
              </div>
            ) : column.id === 'assignees' ? (
              <div className="flex items-center gap-1">
                <Skeleton.Avatar size="small" active />
                <Skeleton.Avatar size="small" active />
              </div>
            ) : (
              <Skeleton.Button size="small" active style={{ width: '70%' }} />
            )}
          </div>
        );
      })}
    </div>
  ));

  return (
    <div>
      <div className="flex flex-col bg-white dark:bg-gray-900 h-full overflow-hidden">
        {/* Table Container */}
        <div
          className="border border-gray-200 dark:border-gray-700 rounded-lg"
          style={{
            height: 'calc(100vh - 240px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Skeleton Content */}
          <div
            className="flex-1 bg-white dark:bg-gray-900 relative"
            style={{
              overflowX: 'auto',
              overflowY: 'auto',
              minHeight: 0,
            }}
          >
            {/* Skeleton Column Headers */}
            <div
              className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
              style={{ width: '100%', minWidth: 'max-content' }}
            >
              <div
                className="flex items-center px-1 py-3 w-full"
                style={{ minWidth: 'max-content', height: '44px' }}
              >
                {columns.map((column, index) => {
                  const columnStyle = {
                    width: column.width,
                    flexShrink: 0,
                  };

                  return (
                    <div
                      key={`header-${column.id}`}
                      className="border-r border-gray-200 dark:border-gray-700 flex items-center px-2"
                      style={columnStyle}
                    >
                      {column.id === 'dragHandle' || column.id === 'checkbox' ? (
                        <span></span>
                      ) : (
                        <Skeleton.Button size="small" active style={{ width: '60%' }} />
                      )}
                    </div>
                  );
                })}
                {/* Add Custom Column Button Skeleton */}
                <div
                  className="flex items-center justify-center px-2 border-r border-gray-200 dark:border-gray-700"
                  style={{ width: '50px', flexShrink: 0 }}
                >
                  <Skeleton.Button size="small" shape="circle" active />
                </div>
              </div>
            </div>

            {/* Skeleton Group Headers and Rows */}
            <div style={{ minWidth: 'max-content' }}>
              {/* First Group */}
              <div className="mt-2">
                {/* Group Header Skeleton */}
                <div className="flex items-center px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <Skeleton.Button size="small" shape="circle" active />
                  <div className="ml-3 flex-1">
                    <Skeleton.Input size="small" active style={{ width: '150px' }} />
                  </div>
                  <Skeleton.Button size="small" active style={{ width: '30px' }} />
                </div>

                {/* Group Tasks Skeleton */}
                {skeletonRows.slice(0, 3)}
              </div>

              {/* Second Group */}
              <div className="mt-2">
                {/* Group Header Skeleton */}
                <div className="flex items-center px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <Skeleton.Button size="small" shape="circle" active />
                  <div className="ml-3 flex-1">
                    <Skeleton.Input size="small" active style={{ width: '150px' }} />
                  </div>
                  <Skeleton.Button size="small" active style={{ width: '30px' }} />
                </div>

                {/* Group Tasks Skeleton */}
                {skeletonRows.slice(3, 6)}
              </div>

              {/* Third Group */}
              <div className="mt-2">
                {/* Group Header Skeleton */}
                <div className="flex items-center px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <Skeleton.Button size="small" shape="circle" active />
                  <div className="ml-3 flex-1">
                    <Skeleton.Input size="small" active style={{ width: '150px' }} />
                  </div>
                  <Skeleton.Button size="small" active style={{ width: '30px' }} />
                </div>

                {/* Group Tasks Skeleton */}
                {skeletonRows.slice(6, 8)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskListSkeleton;
