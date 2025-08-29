import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  useFetchScheduleMembersQuery,
  useFetchScheduleDatesQuery,
} from '@/api/schedule/scheduleApi';
import { themeWiseColor } from '../../../utils/themeWiseColor';
import GranttMembersTable from './grantt-members-table';
import { CELL_WIDTH } from '../../../shared/constants';
import { Flex, Popover } from '@/shared/antd-imports';
import DayAllocationCell from './day-allocation-cell';
import ProjectTimelineBar from './project-timeline-bar';
import ProjectTimelineModal from '@/features/schedule/ProjectTimelineModal';

const GranttChart = React.forwardRef(({ type, date }: { type: string; date: Date }, ref) => {
  const { t } = useTranslation();
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);

  // RTK Query hooks with proper error handling
  const {
    data: teamDataResponse,
    isLoading: teamLoading,
    refetch: refetchTeam,
    error: teamError,
  } = useFetchScheduleMembersQuery();
  const {
    data: dateListResponse,
    isLoading: dateLoading,
    refetch: refetchDates,
    error: dateError,
  } = useFetchScheduleDatesQuery({
    date: date.toISOString(),
    type,
  });

  const teamData = teamDataResponse?.body || [];
  const dateList = dateListResponse?.body;
  const loading = teamLoading || dateLoading;
  const dayCount = dateList?.date_data?.[0]?.days?.length || 0;

  // Log data for debugging
  console.log('Team Data:', teamData);
  console.log('Date List:', dateList);
  console.log('Errors:', { teamError, dateError });

  // get theme details from theme reducer
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const dispatch = useAppDispatch();

  // Auto-refresh data when date or type changes
  useEffect(() => {
    console.log('Refetching data for:', { date: date.toISOString(), type });
    refetchTeam();
    refetchDates();
  }, [date, type, refetchTeam, refetchDates]);

  // function to scroll the timeline header and body together

  // refs
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const timelineHeaderScrollRef = useRef<HTMLDivElement>(null);
  const membersScrollRef = useRef<HTMLDivElement>(null);

  // Syncing scroll vertically between timeline and members
  const syncVerticalScroll = (source: 'timeline' | 'members') => {
    if (source === 'timeline') {
      if (membersScrollRef.current && timelineScrollRef.current) {
        membersScrollRef.current.scrollTop = timelineScrollRef.current.scrollTop;
      }
    } else {
      if (timelineScrollRef.current && membersScrollRef.current) {
        timelineScrollRef.current.scrollTop = membersScrollRef.current.scrollTop;
      }
    }
  };

  // syncing scroll horizontally between timeline and header
  const syncHorizontalScroll = (source: 'timeline' | 'header') => {
    if (source === 'timeline') {
      if (timelineHeaderScrollRef.current && timelineScrollRef.current) {
        timelineHeaderScrollRef.current.scrollLeft = timelineScrollRef.current.scrollLeft;
      }
    } else {
      if (timelineScrollRef.current && timelineHeaderScrollRef.current) {
        timelineScrollRef.current.scrollLeft = timelineHeaderScrollRef.current.scrollLeft;
      }
    }
  };

  const scrollToToday = () => {
    if (!timelineScrollRef.current || !dateList?.date_data) return;

    // Find the index of the "Today" date
    let todayIndex = 0;
    dateList.date_data.some((date: any) => {
      const dayIndex = date.days.findIndex((day: any) => day.isToday);
      if (dayIndex !== -1) {
        todayIndex += dayIndex; // Add the index of today within the current month's days
        return true;
      }
      todayIndex += date.days.length; // Increment by the number of days in the current month
      return false;
    });

    // Calculate the scroll position
    const scrollPosition = todayIndex * CELL_WIDTH;

    // Scroll the timeline
    timelineScrollRef.current.scrollTo({
      left: scrollPosition,
    });
  };

  React.useImperativeHandle(ref, () => ({
    scrollToToday,
  }));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '375px 1fr',
        overflow: 'hidden',
        height: 'calc(100vh - 206px)',
        border: themeMode === 'dark' ? '1px solid #303030' : '1px solid #e5e7eb',
        borderRadius: '4px',
        backgroundColor: themeMode === 'dark' ? '#141414' : '',
      }}
    >
      {/* teams table */}
      <div
        style={{
          background: themeWiseColor('#fff', '#141414', themeMode),
        }}
        className={`after:content relative z-10 after:absolute after:-right-1 after:top-0 after:-z-10 after:h-full after:w-1.5 after:bg-transparent after:bg-linear-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent`}
      >
        <GranttMembersTable
          members={teamData}
          expandedProject={expandedProject}
          setExpandedProject={setExpandedProject}
          membersScrollRef={membersScrollRef}
          syncVerticalScroll={syncVerticalScroll}
        />
      </div>

      {/* timeline */}
      <div style={{ overflow: 'auto', position: 'relative' }}>
        <div
          ref={timelineHeaderScrollRef}
          style={{
            position: 'sticky',
            overflow: 'auto',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: themeWiseColor('#fff', '#141414', themeMode),
            scrollbarWidth: 'none',
            borderBottom: themeMode === 'dark' ? '1px solid #303030' : '1px solid #e5e7eb',
          }}
          onScroll={() => syncHorizontalScroll('header')}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${dayCount}, ${CELL_WIDTH}px)`,
            }}
          >
            {dateList?.date_data?.map((date: any, index: number) =>
              date.days.map((day: any) => (
                <div
                  key={index + day.day}
                  style={{
                    background: day.isWeekend
                      ? 'rgba(217, 217, 217, 0.4)'
                      : day.isToday
                        ? '#69b6fb'
                        : '',
                    color: day.isToday ? '#fff' : '',
                    padding: '8px 0',
                    textAlign: 'center',
                    height: 60,
                  }}
                >
                  <div>{day.name},</div>
                  <div>
                    {date?.month.substring(0, 4)} {day.day}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <Flex
          vertical
          ref={timelineScrollRef}
          onScroll={() => {
            syncVerticalScroll('timeline');
            syncHorizontalScroll('timeline');
          }}
          style={{
            height: 'calc(100vh - 270px)',
            overflow: 'auto',
          }}
        >
          {teamData && teamData.length > 0 ? (
            teamData.map((member: any) => (
              <div
                key={member.id || member.team_member_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${dayCount}, ${CELL_WIDTH}px)`,
                }}
              >
                {dateList?.date_data?.map((date: any) =>
                  date.days.map((day: any) => (
                    <div
                      key={`${date.month}-${day.day}`}
                      style={{
                        background: day.isWeekend ? 'rgba(217, 217, 217, 0.4)' : '',
                        color: day.isToday ? '#fff' : '',
                        height: 90,
                      }}
                    >
                      <DayAllocationCell
                        workingHours={8}
                        loggedHours={0}
                        totalPerDayHours={0}
                        isWeekend={day.isWeekend}
                        capacity={100}
                        availableHours={8}
                        memberName={member.name}
                        date={`${date.month.substring(0, 3)} ${day.day}`}
                      />
                    </div>
                  ))
                )}

                {expandedProject === (member.id || member.team_member_id) && (
                  <div>
                    <Popover
                      content={
                        <ProjectTimelineModal
                          memberId={member?.team_member_id}
                          projectId={selectedProjectId}
                          setIsModalOpen={setIsModalOpen}
                        />
                      }
                      trigger={'click'}
                      open={isModalOpen}
                    ></Popover>
                    {(member.projects || []).map((project: any) => (
                      <div
                        key={project.id}
                        onClick={() => {
                          if (!(project?.date_union?.start && project?.date_union?.end)) {
                            setSelectedProjectId(project?.id);
                            setIsModalOpen(true);
                          }
                        }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${filteredDayCount}, ${cellWidth}px)`,
                          position: 'relative',
                        }}
                      >
                        <Flex
                          align="center"
                          style={{
                            position: 'absolute',
                            left: 0,
                            zIndex: 50,
                            height: 65,
                          }}
                        >
                          {project?.date_union?.start && project?.date_union?.end && (
                            <ProjectTimelineBar
                              defaultData={project?.default_values}
                              project={project}
                              indicatorWidth={project?.indicator_width}
                              indicatorOffset={project?.indicator_offset}
                            />
                          )}
                        </Flex>

                        {dateList?.date_data?.map((date: any) =>
                          date.days.map((day: any) => (
                            <div
                              key={`${date.month}-${day.day}`}
                              style={{
                                background: day.isWeekend ? 'rgba(217, 217, 217, 0.4)' : '',
                                height: 65,
                              }}
                            >
                              <div
                                style={{ width: '100%', height: '100%' }}
                                className={`rounded-xs outline-1 hover:outline-solid ${themeMode === 'dark' ? 'outline-white/10' : 'outline-black/10'}`}
                              ></div>
                            </div>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div
              style={{
                gridColumn: `1 / -1`,
                textAlign: 'center',
                padding: '40px',
                color: themeWiseColor('#666', '#999', themeMode),
              }}
            >
              {loading
                ? t('loadingData') || 'Loading data...'
                : t('noDataAvailable') || 'No team members found'}
            </div>
          )}
        </Flex>
      </div>
    </div>
  );
});

export default GranttChart;
