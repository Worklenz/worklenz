import React, { useState } from 'react';
import { Flex, Popover, Typography } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getWorking, toggleScheduleDrawer } from '../../../features/schedule/scheduleSlice';
import ProjectTimelineModal from '../../../features/schedule/ProjectTimelineModal';
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
};

const ProjectTimelineBar = ({
  project,
  indicatorOffset,
  indicatorWidth,
  defaultData,
}: ProjectTimelineBarProps) => {
  const [width, setWidth] = useState(indicatorWidth);
  const [currentDuration, setCurrentDuration] = useState(indicatorWidth);
  const [totalHours, setTotalHours] = useState(project?.total_hours);
  const [leftOffset, setLeftOffset] = useState(indicatorOffset);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();

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
    <Popover
      content={
        <ProjectTimelineModal
          defaultData={defaultData}
          projectId={project?.id}
          setIsModalOpen={setIsModalOpen}
        />
      }
      trigger={'click'}
      open={isModalOpen}
    >
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
          onClick={() => {
            setIsModalOpen(true);
            dispatch(getWorking());
          }}
        >
          <Typography.Text
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
            }}
            ellipsis={{ expanded: false }}
          >
            {t('total')} {totalHours}h
          </Typography.Text>
          {currentDuration > 1 && (
            <Typography.Text style={{ fontSize: '10px' }} ellipsis={{ expanded: false }}>
              {t('perDay')} {project?.hours_per_day}h
            </Typography.Text>
          )}
          <Typography.Text
            style={{
              fontSize: '10px',
              textDecoration: 'underline',
              width: 'fit-content',
            }}
            ellipsis={{ expanded: false }}
            onClick={e => {
              e.stopPropagation();
              dispatch(toggleScheduleDrawer());
            }}
          >
            20 {t('tasks')}
          </Typography.Text>
        </Flex>
      </Resizable>
    </Popover>
  );
};

export default React.memo(ProjectTimelineBar);
