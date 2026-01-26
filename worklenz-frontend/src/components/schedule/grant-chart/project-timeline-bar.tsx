import React, { useState } from 'react';
import { Flex, Typography } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleScheduleDrawer, setSelectedMember, setSelectedProject, setSelectedDateRange } from '../../../features/schedule/scheduleSliceRTK';
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
};

const ProjectTimelineBar = ({
  project,
  indicatorOffset,
  indicatorWidth,
  defaultData,
  memberId,
}: ProjectTimelineBarProps) => {
  const [width, setWidth] = useState(indicatorWidth);
  const [currentDuration, setCurrentDuration] = useState(indicatorWidth);
  const [totalHours, setTotalHours] = useState(project?.total_hours);
  const [leftOffset, setLeftOffset] = useState(indicatorOffset);

  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();

  const handleTimelineClick = () => {
    // Set selected member, project, and date range in Redux
    if (memberId) {
      dispatch(setSelectedMember(memberId));
    }
    if (project?.id) {
      dispatch(setSelectedProject(project.id));
    }
    if (project?.date_union?.start && project?.date_union?.end) {
      dispatch(setSelectedDateRange({
        start: project.date_union.start,
        end: project.date_union.end,
      }));
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
    let newWidth = width;
    let newLeftOffset = leftOffset;

    if (direction === 'right') {
      newWidth = Math.max(CELL_WIDTH, width + delta.width);
      if (newWidth <= CELL_WIDTH * 30) {
        setWidth(newWidth);
        const newDuration = Math.round(newWidth / CELL_WIDTH);
        setCurrentDuration(newDuration);
        setTotalHours(newDuration * project?.hours_per_day);
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
        setTotalHours(newDuration * project?.hours_per_day);
      }
    }
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
          right: true,
          bottom: false,
          left: true,
          topRight: false,
          bottomRight: false,
          bottomLeft: false,
          topLeft: false,
        }}
        handleComponent={{
          right: <MoreOutlined style={{ fontSize: 24, color: 'white' }} />,
          left: <MoreOutlined style={{ fontSize: 24, color: 'white' }} />,
        }}
        handleClasses={{
          right:
            'hidden group-hover:flex -translate-x-[5px] bg-[#1890ff] px-1 justify-center rounded-tr rounded-br',
          left: 'hidden group-hover:flex translate-x-[5px] bg-[#1890ff] px-1 justify-center rounded-tl rounded-bl',
        }}
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
        }}
      >
        <Flex
          vertical
          align="center"
          justify="center"
          style={{ width: '100%' }}
        >
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
          {currentDuration > 1 && project?.hours_per_day > 0 && (
            <Typography.Text style={{ fontSize: '10px' }} ellipsis={{ expanded: false }}>
              {t('perDay', { defaultValue: 'Per Day' })} {project?.hours_per_day.toFixed(1)}h
            </Typography.Text>
          )}
          {project?.task_count > 0 && (
            <Typography.Text
              style={{
                fontSize: '10px',
                textDecoration: 'underline',
                width: 'fit-content',
              }}
              ellipsis={{ expanded: false }}
            >
              {project.task_count} {project.task_count === 1 ? t('task', { defaultValue: 'task' }) : t('tasks', { defaultValue: 'tasks' })}
            </Typography.Text>
          )}
          {!totalHours && !project?.task_count && (
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

export default React.memo(ProjectTimelineBar);
