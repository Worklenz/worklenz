import React, { memo } from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { Task } from '@/types/task-management.types';
import LabelsSelector from '@/components/LabelsSelector';
import { CustomColordLabel, CustomNumberLabel } from '@/components';
import { useColumnWidth } from '../hooks/useColumnWidth';
import { useLabelsOverflow } from '../hooks/useLabelsOverflow';

interface LabelsColumnWithOverflowProps {
  width: string;
  task: Task;
  labelsAdapter: any;
  isDarkMode: boolean;
  columnId: string;
}

/**
 * Labels column with Asana-style overflow behavior
 * Shows visible labels + "+N" badge with tooltip for hidden labels
 */
export const LabelsColumnWithOverflow: React.FC<LabelsColumnWithOverflowProps> = memo(
  ({ width, task, labelsAdapter, isDarkMode, columnId }) => {
    // Reactively read the column width from CSS custom property
    const columnWidth = useColumnWidth(columnId);

    // Calculate which labels are visible and which overflow
    const { visibleLabels, hiddenLabels, overflowCount } = useLabelsOverflow(
      task.all_labels || task.labels,
      columnWidth
    );

    // Render a single label chip
    const renderLabelChip = (label: any, index: number) => {
      const extendedLabel = label as any;
      return extendedLabel.end && extendedLabel.names && extendedLabel.name ? (
        <CustomNumberLabel
          key={`${label.id}-${index}`}
          labelList={extendedLabel.names}
          namesString={extendedLabel.name}
          isDarkMode={isDarkMode}
          color={label.color || label.color_code}
        />
      ) : (
        <CustomColordLabel
          key={`${label.id}-${index}`}
          label={label}
          isDarkMode={isDarkMode}
        />
      );
    };

    // Render overflow badge with tooltip
    const renderOverflowBadge = () => {
      if (overflowCount === 0) return null;

      // Build tooltip content - list all hidden label names
      const tooltipContent = (
        <div className="flex flex-col gap-1">
          {hiddenLabels.map((label, index) => (
            <div key={`hidden-${label.id}-${index}`} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: label.color || label.color_code || '#d9d9d9' }}
              />
              <span className="text-xs">{label.name}</span>
            </div>
          ))}
        </div>
      );

      return (
        <Tooltip title={tooltipContent} placement="top">
          <div
            className={`
              inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-medium
              cursor-default transition-colors duration-200
              ${
                isDarkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
            `}
            style={{
              minWidth: '28px',
              height: '20px',
              flexShrink: 0,
            }}
          >
            +{overflowCount}
          </div>
        </Tooltip>
      );
    };

    // Handle edge case: zero chips fit
    if (visibleLabels.length === 0 && overflowCount > 0) {
      const tooltipContent = (
        <div className="flex flex-col gap-1">
          {hiddenLabels.map((label, index) => (
            <div key={`hidden-${label.id}-${index}`} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: label.color || label.color_code || '#d9d9d9' }}
              />
              <span className="text-xs">{label.name}</span>
            </div>
          ))}
        </div>
      );

      return (
        <div
          className="flex items-center px-1 border-r border-gray-200 dark:border-gray-700"
          style={{ width, flexShrink: 0 }}
        >
          <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
            <Tooltip title={tooltipContent} placement="top">
              <div
                className={`
                  inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-medium
                  cursor-default transition-colors duration-200
                  ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
                style={{
                  minWidth: '28px',
                  height: '20px',
                  flexShrink: 0,
                }}
              >
                {overflowCount} {overflowCount === 1 ? 'label' : 'labels'}
              </div>
            </Tooltip>
            <LabelsSelector task={labelsAdapter} isDarkMode={isDarkMode} />
          </div>
        </div>
      );
    }

    return (
      <div
        className="flex items-center px-1 border-r border-gray-200 dark:border-gray-700"
        style={{ width, flexShrink: 0, overflow: 'hidden' }}
      >
        <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
          {/* Visible label chips */}
          {visibleLabels.map((label, index) => renderLabelChip(label, index))}

          {/* Overflow badge */}
          {renderOverflowBadge()}

          {/* Labels selector button */}
          <LabelsSelector task={labelsAdapter} isDarkMode={isDarkMode} />
        </div>
      </div>
    );
  }
);

LabelsColumnWithOverflow.displayName = 'LabelsColumnWithOverflow';
