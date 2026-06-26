import React, { useState, useEffect } from 'react';
import { Flex, Typography } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  toggleScheduleDrawer,
  setSelectedMember,
  setSelectedProject,
  setSelectedSegmentData,
  setSelectedDateRange,
  SegmentData,
} from '../../../features/schedule/scheduleSliceRTK';
import { Resizable } from 're-resizable';
import { themeWiseColor } from '../../../utils/themeWiseColor';
import { MoreOutlined } from '@/shared/antd-imports';
import { CELL_WIDTH } from '../../../shared/constants';
import { ScheduleData } from '@/types/schedule/schedule-v2.types';

type ProjectTimelineBarProps = {
  project: any;
  indicatorOffset: number;
  indicatorWidth: number;
  defaultData?: ScheduleData;
  memberId?: string;
  allProjectSegments?: any[]; // Add this to pass all segments for the project
};

const ProjectTimelineBar = ({
  project,
  indicatorOffset,
  indicatorWidth,
  defaultData,
  memberId,
  allProjectSegments = [],
}: ProjectTimelineBarProps) => {
  const [width, setWidth] = useState(indicatorWidth);
  const [currentDuration, setCurrentDuration] = useState(indicatorWidth);
  const [totalHours, setTotalHours] = useState(project?.total_hours);
  const [leftOffset, setLeftOffset] = useState(indicatorOffset);

  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();

  // 🔄 Real-time updates: Sync local state with props when they change
  useEffect(() => {
    setWidth(indicatorWidth);
    setLeftOffset(indicatorOffset);
    setTotalHours(project?.total_hours || 0);
    setCurrentDuration(indicatorWidth);
  }, [
    indicatorWidth,
    indicatorOffset,
    project?.total_hours,
    project?.task_count,
    project?.hours_per_day,
  ]);

  // 🔄 Additional effect to handle project data changes
  useEffect(() => {
    if (project) {
      // Update total hours when project data changes
      setTotalHours(project.total_hours || 0);
    }
  }, [project]);

  /**
   * Handle click on timeline bar segment
   * Sets the selected member, project, and segment-specific data in Redux
   * Opens the schedule drawer with the segment's date range and details
   */
  const handleTimelineClick = (e: React.MouseEvent) => {
    // Stop event propagation to prevent parent click handlers from firing
    e.stopPropagation();

    // Set selected member and project in Redux
    if (memberId) {
      dispatch(setSelectedMember(memberId));
    }
    if (project?.id) {
      dispatch(setSelectedProject(project.id));
    }

    // Store the complete segment data including date range
    const segmentData: SegmentData = {
      ...project,
      memberId: memberId,
      segmentId: project?.segment_id || `${project?.id}_${project?.segment_number || 0}`,
    };

    dispatch(setSelectedSegmentData(segmentData));

    // Set the date range for this specific segment
    if (project?.date_union?.start && project?.date_union?.end) {
      dispatch(
        setSelectedDateRange({
          start: project.date_union.start,
          end: project.date_union.end,
        })
      );
    }

    // Open the drawer
    dispatch(toggleScheduleDrawer());
  };

  const handleResize = (
    event: MouseEvent | TouchEvent,
    direction: string,
    ref: HTMLElement,
    delta: { width: number; height: number }
  ) => {
    // Temporarily disabled resize functionality
    return;

    /* Original resize logic - commented out temporarily
    let newWidth = width;
    let newLeftOffset = leftOffset;

    if (direction === 'right') {
      newWidth = Math.max(CELL_WIDTH, width + delta.width);
      if (newWidth <= CELL_WIDTH * 30) {
        setWidth(newWidth);
        const newDuration = Math.round(newWidth / CELL_WIDTH);
        setCurrentDuration(newDuration);
        // Use current project hours_per_day (which updates via useEffect)
        const currentHoursPerDay = project?.hours_per_day || 0;
        setTotalHours(newDuration * currentHoursPerDay);
      }
    } else if (direction === 'left') {
      const deltaWidth = Math.min(leftOffset, delta.width);
      newLeftOffset = leftOffset - deltaWidth;
      newWidth = width + deltaWidth;

      if (newLeftOffset >= 0 && newWidth >= CELL_WIDTH && newWidth <= CELL_WIDTH * 30) {
        setLeftOffset(newLeftOffset);
        setWidth(newWidth);
        const newDuration = Math.round(newWidth / CELL_WIDTH);
        setCurrentDuration(newDuration);
        // Use current project hours_per_day (which updates via useEffect)
        const currentHoursPerDay = project?.hours_per_day || 0;
        setTotalHours(newDuration * currentHoursPerDay);
      }
    }
    */
  };

  return (
    <div onClick={handleTimelineClick}>
      <Resizable
        size={{ width, height: 56 }}
        onResizeStop={(e, direction, ref, delta) =>
          handleResize(e, direction as 'left' | 'right', ref, delta)
        }
        minWidth={CELL_WIDTH}
        maxWidth={CELL_WIDTH * 30}
        grid={[CELL_WIDTH, 1]}
        enable={{
          top: false,
          right: false, // Temporarily disabled
          bottom: false,
          left: false, // Temporarily disabled
          topRight: false,
          bottomRight: false,
          bottomLeft: false,
          topLeft: false,
        }}
        // Temporarily disabled resize handles
        // handleComponent={{
        //   right: <MoreOutlined style={{ fontSize: 24, color: 'white' }} />,
        //   left: <MoreOutlined style={{ fontSize: 24, color: 'white' }} />,
        // }}
        // handleClasses={{
        //   right:
        //     'hidden group-hover:flex -translate-x-[5px] bg-[#1890ff] px-1 justify-center rounded-tr rounded-br',
        //   left: 'hidden group-hover:flex translate-x-[5px] bg-[#1890ff] px-1 justify-center rounded-tl rounded-bl',
        // }}
        className="group hover:shadow-md"
        style={{
          marginInlineStart: leftOffset,
          backgroundColor: themeWiseColor(
            'rgba(240, 248, 255, 1)',
            'rgba(0, 142, 204, 0.5)',
            themeMode
          ),
          borderRadius: 6,
          border: `1px solid ${themeWiseColor(
            'rgba(149, 197, 248, 1)',
            'rgba(24, 144, 255, 1)',
            themeMode
          )}`,
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '4px 10px',
          zIndex: 99,
          cursor: 'pointer',
          width: '100%', // Take full width of the container
        }}
      >
        <Flex vertical align="center" justify="center" style={{ width: '100%' }}>
          {totalHours > 0 && (
            <Typography.Text
              style={{
                fontSize: '12px',
                fontWeight: 'bold',
              }}
              ellipsis={{ expanded: false }}
            >
              {t('total', { defaultValue: 'Total' })} {totalHours.toFixed(1)}h
            </Typography.Text>
          )}
          {currentDuration > 1 && (project?.hours_per_day || 0) > 0 && (
            <Typography.Text style={{ fontSize: '10px' }} ellipsis={{ expanded: false }}>
              {t('perDay', { defaultValue: 'Per Day' })} {(project?.hours_per_day || 0).toFixed(1)}h
            </Typography.Text>
          )}
          {(project?.task_count || 0) > 0 && (
            <Typography.Text
              style={{
                fontSize: '10px',
                textDecoration: 'underline',
                width: 'fit-content',
              }}
              ellipsis={{ expanded: false }}
            >
              {project?.task_count || 0}{' '}
              {(project?.task_count || 0) === 1
                ? t('task', { defaultValue: 'task' })
                : t('tasks', { defaultValue: 'tasks' })}
            </Typography.Text>
          )}
          {!totalHours && !(project?.task_count || 0) && (
            <Typography.Text
              style={{
                fontSize: '11px',
                color: themeWiseColor('#666', '#999', themeMode),
              }}
              ellipsis={{ expanded: false }}
            >
              {t('noTasksScheduled', { defaultValue: 'No tasks scheduled' })}
            </Typography.Text>
          )}
        </Flex>
      </Resizable>
    </div>
  );
};

export default React.memo(ProjectTimelineBar, (prevProps, nextProps) => {
  // Custom comparison function for React.memo to ensure re-render when project data changes
  return (
    prevProps.indicatorOffset === nextProps.indicatorOffset &&
    prevProps.indicatorWidth === nextProps.indicatorWidth &&
    prevProps.project?.id === nextProps.project?.id &&
    prevProps.project?.segment_number === nextProps.project?.segment_number &&
    prevProps.project?.total_hours === nextProps.project?.total_hours &&
    prevProps.project?.task_count === nextProps.project?.task_count &&
    prevProps.project?.hours_per_day === nextProps.project?.hours_per_day &&
    prevProps.memberId === nextProps.memberId &&
    JSON.stringify(prevProps.project?.date_union) ===
      JSON.stringify(nextProps.project?.date_union) &&
    prevProps.allProjectSegments?.length === nextProps.allProjectSegments?.length
  );
});
