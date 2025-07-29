import React, { useState, useCallback, Suspense } from 'react';
import { PlusOutlined } from '@/shared/antd-imports';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

// Lazy load the existing AssigneeSelector component only when needed (Asana-style)
const LazyAssigneeSelector = React.lazy(() =>
  import('@/components/AssigneeSelector').then(module => ({ default: module.default }))
);

interface LazyAssigneeSelectorProps {
  task: IProjectTask;
  groupId?: string | null;
  isDarkMode?: boolean;
  kanbanMode?: boolean; // <-- Add this prop
}

// Lightweight loading placeholder
const LoadingPlaceholder: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => (
  <div
    className={`
      w-5 h-5 rounded-full border border-dashed flex items-center justify-center
      transition-colors duration-200 animate-pulse
      ${
        isDarkMode
          ? 'border-gray-600 bg-gray-800 text-gray-400'
          : 'border-gray-300 bg-gray-100 text-gray-600'
      }
    `}
  >
    <PlusOutlined className="text-xs" />
  </div>
);

const LazyAssigneeSelectorWrapper: React.FC<LazyAssigneeSelectorProps> = ({
  task,
  groupId = null,
  isDarkMode = false,
  kanbanMode = false, // <-- Default to false
}) => {
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [showComponent, setShowComponent] = useState(false);

  const handleInteraction = useCallback(
    (e: React.MouseEvent) => {
      // Don't prevent the event from bubbling, just mark as loaded
      if (!hasLoadedOnce) {
        setHasLoadedOnce(true);
        setShowComponent(true);
      }
    },
    [hasLoadedOnce]
  );

  // If not loaded yet, show a simple placeholder button
  if (!hasLoadedOnce) {
    return (
      <button
        onClick={handleInteraction}
        onMouseEnter={handleInteraction} // Preload on hover for better UX
        className={`
          w-5 h-5 rounded-full border border-dashed flex items-center justify-center
          transition-colors duration-200
          ${
            isDarkMode
              ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800 text-gray-400'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-600'
          }
        `}
        title="Add assignee"
      >
        <PlusOutlined className="text-xs" />
      </button>
    );
  }

  // Once loaded, show the full component
  return (
    <Suspense fallback={<LoadingPlaceholder isDarkMode={isDarkMode} />}>
      <LazyAssigneeSelector task={task} groupId={groupId} isDarkMode={isDarkMode} kanbanMode={kanbanMode} />
    </Suspense>
  );
};

export default LazyAssigneeSelectorWrapper;
