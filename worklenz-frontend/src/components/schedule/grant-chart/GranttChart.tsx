import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  useFetchScheduleMembersQuery,
  useFetchScheduleDatesQuery,
  useLazyFetchMemberProjectsQuery,
  useFetchDailyCapacityQuery,
} from '@/api/schedule/scheduleApi';
import { themeWiseColor } from '../../../utils/themeWiseColor';
import GranttMembersTable from './grantt-members-table';
import { CELL_WIDTH } from '../../../shared/constants';
import { Flex, Popover, Skeleton, Spin } from '@/shared/antd-imports';
import DayAllocationCell from './day-allocation-cell';
import ProjectTimelineBar from './project-timeline-bar';
import ProjectTimelineModal from '@/features/schedule/ProjectTimelineModal';
import CapacityConflictsAlert from './CapacityConflictsAlert';

const GranttChart = React.forwardRef(({ type, date }: { type: string; date: Date }, ref) => {
  const { t } = useTranslation();
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [memberProjects, setMemberProjects] = useState<Record<string, any[]>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);

  // Format date as YYYY-MM-DD in local timezone to avoid timezone conversion issues
  const formattedDate = React.useMemo(() => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [date]);

  // Calculate end date based on view type
  const calculateEndDate = React.useMemo(() => {
    const start = new Date(date);
    if (type === 'week') {
      start.setDate(start.getDate() + 14); // 2 weeks
    } else {
      start.setMonth(start.getMonth() + 1); // 1 month
    }
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, '0');
    const day = String(start.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [date, type]);

  // RTK Query hooks with proper error handling
  const {
    data: teamDataResponse,
    isLoading: teamLoading,
    isFetching: teamFetching,
    refetch: refetchTeam,
    error: teamError,
  } = useFetchScheduleMembersQuery();
  const {
    data: dateListResponse,
    isLoading: dateLoading,
    isFetching: dateFetching,
    refetch: refetchDates,
    error: dateError,
  } = useFetchScheduleDatesQuery({
    date: formattedDate,
    type,
  });

  // Fetch capacity data
  const {
    data: capacityResponse,
    isLoading: capacityLoading,
    isFetching: capacityFetching,
    refetch: refetchCapacity,
  } = useFetchDailyCapacityQuery({
    startDate: formattedDate,
    endDate: calculateEndDate,
  });

  // Debug capacity response
  React.useEffect(() => {
    if (capacityResponse) {
      console.log('📊 Capacity Response:', {
        success: capacityResponse.done,
        memberCount: capacityResponse.body?.length,
        firstMember: capacityResponse.body?.[0],
        sampleCapacity: capacityResponse.body?.[0]?.daily_capacity?.slice(0, 2)
      });
    }
  }, [capacityResponse]);

  // Lazy query for fetching member projects
  const [fetchMemberProjects, { isLoading: isProjectsLoading }] = useLazyFetchMemberProjectsQuery();

  const teamData = teamDataResponse?.body || [];
  const dateList = dateListResponse?.body;
  const loading = teamLoading || dateLoading;
  const isRefetching = teamFetching || dateFetching || capacityFetching;
  const dayCount = dateList?.date_data?.[0]?.days?.length || 0;

  // Helper function to get capacity for specific date/member
  const capacityData = capacityResponse?.body || [];
  
  const getCapacityForDate = (memberId: string, dateStr: string) => {
    // Debug logging
    console.log('🔍 Looking for capacity:', { 
      memberId, 
      dateStr, 
      totalMembers: capacityData.length,
      availableMemberIds: capacityData.map((m: any) => m.team_member_id)
    });
    
    const memberCapacity = capacityData.find((m: any) => m.team_member_id === memberId);
    if (!memberCapacity) {
      console.warn('⚠️ No capacity found for member:', memberId);
      return null;
    }
    
    console.log('✅ Found member capacity:', {
      memberId,
      dailyCapacityCount: memberCapacity.daily_capacity?.length,
      sampleDates: memberCapacity.daily_capacity?.slice(0, 3).map((d: any) => d.date)
    });
    
    const dayCapacity = memberCapacity.daily_capacity.find((d: any) => d.date === dateStr);
    
    if (!dayCapacity) {
      console.warn('⚠️ No capacity found for date:', { memberId, dateStr });
    } else {
      console.log('✅ Found day capacity:', { dateStr, status: dayCapacity.status, allocated: dayCapacity.allocated_hours });
    }
    
    return dayCapacity || null;
  };

  // Handle expanding/collapsing member projects
  const handleToggleProject = async (memberId: string) => {
    if (expandedMemberId === memberId) {
      // Collapse
      setExpandedMemberId(null);
    } else {
      // Expand and fetch projects if not already fetched
      setExpandedMemberId(memberId);
      if (!memberProjects[memberId]) {
        try {
          const result = await fetchMemberProjects({ id: memberId }).unwrap();
          if (result?.body?.projects) {
            setMemberProjects(prev => ({
              ...prev,
              [memberId]: result.body.projects || [],
            }));
          }
        } catch (error) {
          console.error('Failed to fetch member projects:', error);
        }
      }
    }
  };

  // Get projects for a member (from local state)
  const getMemberProjects = (memberId: string) => {
    return memberProjects[memberId] || [];
  };

  // get theme details from theme reducer
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Auto-refresh data when date or type changes
  useEffect(() => {
    refetchTeam();
    refetchDates();
    refetchCapacity();
  }, [date, type, refetchTeam, refetchDates, refetchCapacity, formattedDate]);

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

  // Loading skeleton for initial load
  if (loading) {
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
          padding: '16px',
        }}
      >
        <div>
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
        <div>
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Capacity Conflicts Alert */}
      <CapacityConflictsAlert
        startDate={formattedDate}
        endDate={calculateEndDate}
      />
      
      {/* Refetching overlay */}
      {isRefetching && !loading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <Spin size="large" tip={t('refreshingData', { defaultValue: 'Refreshing data...' })} />
        </div>
      )}
      
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '375px 1fr',
          overflow: 'hidden',
          height: 'calc(100vh - 206px)',
          border: themeMode === 'dark' ? '1px solid #303030' : '1px solid #e5e7eb',
          borderRadius: '4px',
          backgroundColor: themeMode === 'dark' ? '#141414' : '',
          opacity: isRefetching ? 0.6 : 1,
          transition: 'opacity 0.3s ease',
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
          expandedMemberId={expandedMemberId}
          onToggleProject={handleToggleProject}
          getMemberProjects={getMemberProjects}
          isProjectsLoading={isProjectsLoading}
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
            teamData.map((member: any) => {
              // Standardize on team_member_id since that's what backend returns
              const memberId = member.team_member_id;
              
              // Debug member ID
              console.log('👤 Processing member:', {
                name: member.name,
                team_member_id: member.team_member_id,
                id: member.id,
                usingId: memberId
              });
              
              const isExpanded = expandedMemberId === memberId;
              const projects = getMemberProjects(memberId);
              
              return (
                <div key={memberId}>
                  {/* Member row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${dayCount}, ${CELL_WIDTH}px)`,
                    }}
                  >
                    {dateList?.date_data?.map((dateObj: any, dateIndex: number) =>
                      dateObj.days.map((day: any, dayIndex: number) => {
                        // Extract year and month from chart_start or calculate from month string
                        // Month format is "Mon YYYY" (e.g., "Jan 2025")
                        const monthParts = dateObj.month.split(' ');
                        const monthName = monthParts[0]; // "Jan"
                        const year = monthParts[1]; // "2025"
                        
                        // Convert month name to number
                        const monthMap: Record<string, string> = {
                          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                          'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                          'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                        };
                        const monthNumber = monthMap[monthName] || '01';
                        
                        // Format date as YYYY-MM-DD to match capacity data
                        const formattedDateStr = `${year}-${monthNumber}-${String(day.day).padStart(2, '0')}`;
                        
                        // Debug date formatting
                        if (dayIndex === 0 && dateIndex === 0) {
                          console.log('📅 Date formatting sample:', {
                            monthName,
                            year,
                            monthNumber,
                            dayNumber: day.day,
                            formattedDateStr,
                            rawMonth: dateObj.month
                          });
                        }
                        
                        const dayCapacity = getCapacityForDate(memberId, formattedDateStr);
                        
                        return (
                          <div
                            key={`${dateObj.month}-${day.day}-${dayIndex}`}
                            style={{
                              background: day.isWeekend ? 'rgba(217, 217, 217, 0.4)' : '',
                              color: day.isToday ? '#fff' : '',
                              height: 90,
                            }}
                          >
                            <DayAllocationCell
                              capacityData={dayCapacity}
                              memberName={member.name}
                              memberId={memberId}
                              date={formattedDateStr}
                              isWeekend={day.isWeekend}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Expanded projects */}
                  {isExpanded && projects.length > 0 && (
                    <div>
                      <Popover
                        content={
                          <ProjectTimelineModal
                            memberId={memberId}
                            projectId={selectedProjectId}
                            setIsModalOpen={setIsModalOpen}
                          />
                        }
                        trigger={'click'}
                        open={isModalOpen}
                      ></Popover>
                      {projects.map((project: any) => (
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
                            gridTemplateColumns: `repeat(${dayCount}, ${CELL_WIDTH}px)`,
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
              );
            })
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
    </>
  );
});

export default GranttChart;
