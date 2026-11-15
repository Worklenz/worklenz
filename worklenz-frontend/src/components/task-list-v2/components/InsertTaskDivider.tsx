import React from 'react';
import { PlusOutlined } from '@/shared/antd-imports';

export const InsertTaskDivider: React.FC<{
  onInsert: () => void;
  title: string;
  isVisible: boolean;
  isNearGroupHeader: boolean;
}> = ({ onInsert, title, isVisible, isNearGroupHeader }) => {
  if (!isVisible || isNearGroupHeader) return null;

  return (
    <div className="group absolute inset-x-0 top-0 h-3 -translate-y-1/2" style={{ zIndex: 5 }}>
      <div className="relative h-full w-full">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-blue-400 dark:border-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <button
          data-insert-btn
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={e => {
            e.stopPropagation();
            onInsert();
          }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900 text-[10px] text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center shadow-sm"
          style={{ left: 32 }}
          title={title}
          aria-label={title}
        >
          <PlusOutlined />
        </button>
      </div>
    </div>
  );
};
