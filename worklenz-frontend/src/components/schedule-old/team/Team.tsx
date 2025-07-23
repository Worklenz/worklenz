import React, { useEffect, useState } from 'react';
import { AvatarNamesMap } from '@/shared/constants';
import { Member } from '@/types/schedule/schedule.types';
import { Avatar, Badge, Button, Col, Flex, Popover, Row, Tooltip } from '@/shared/antd-imports';
import { CaretDownOutlined, CaretRightFilled } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import './Team.css';
import { useDispatch } from 'react-redux';
import { toggleScheduleDrawer } from '../../../features/schedule-old/scheduleSlice';
import ProjectTimelineModal from '../../../features/schedule-old/ProjectTimelineModal';
import ScheduleDrawer from '../../../features/schedule-old/ScheduleDrawer';
import { useTranslation } from 'react-i18next';

interface GanttChartProps {
  members: Member[];
  date: Date | null;
}

interface teamProps {
  date: Date | null;
}

const getDaysBetween = (start: Date, end: Date): number => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
};

const GanttChart: React.FC<GanttChartProps> = ({ members, date }) => {
  const [weekends, setWeekends] = useState<boolean[]>([]);
  const [today, setToday] = useState(new Date());
  const [showProject, setShowProject] = useState<string | null>(null);
  const workingDays = useAppSelector(state => state.scheduleReducer.workingDays);
  const workingHours = useAppSelector(state => state.scheduleReducer.workingHours);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useDispatch();
  const { t } = useTranslation('schedule');

  const timelineStart = date ? date : new Date();
  const timelineEnd = new Date(timelineStart);
  timelineEnd.setDate(timelineStart.getDate() + 30);

  const totalDays = getDaysBetween(timelineStart, timelineEnd);

  useEffect(() => {
    const weekendsArray = Array.from({ length: totalDays }, (_, i) => {
      const date = new Date(timelineStart);
      date.setDate(timelineStart.getDate() + i);

      // Check if the day is Saturday or Sunday
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      return !workingDays.includes(dayName);
    });

    setWeekends(weekendsArray);
  }, [totalDays, timelineStart]);

  const handleShowProject = (memberId: string) => {
    setShowProject(prevMemberId => (prevMemberId === memberId ? null : memberId));
  };

  return (
    <Flex
      style={{
        border: themeMode === 'dark' ? '1px solid #303030' : '1px solid rgba(0, 0, 0, 0.2)',
        padding: '0 0 10px 0px',
        borderRadius: '4px',
        backgroundColor: themeMode === 'dark' ? '#141414' : '',
      }}
    >
      {/* table */}
      <div style={{ width: '230px', display: 'flex', flexDirection: 'column' }}>
        {/* right side of the table */}
        <div
          style={{
            height: '60px',
            borderBottom:
              themeMode === 'dark' ? '1px solid #303030' : '1px solid rgba(0, 0, 0, 0.2)',
          }}
        ></div>
        {members.map(member => (
          <div key={member.memberId} style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingLeft: '20px',
                height: '92px',
              }}
            >
              <Avatar
                style={{
                  backgroundColor: AvatarNamesMap[member.memberName.charAt(0)],
                }}
              >
                {member.memberName.charAt(0)}
              </Avatar>
              <Button type="text" size="small" onClick={() => dispatch(toggleScheduleDrawer())}>
                {member.memberName}
              </Button>
              <ScheduleDrawer />
              <Button size="small" type="text" onClick={() => handleShowProject(member.memberId)}>
                {showProject === member.memberId ? <CaretDownOutlined /> : <CaretRightFilled />}
              </Button>
            </div>

            {showProject === member.memberId &&
              member.projects.map((project, index) => {
                const projectStart = new Date(project.startDate);
                const projectEnd = new Date(project.endDate);
                let startOffset = getDaysBetween(timelineStart, projectStart);
                let projectDuration = getDaysBetween(projectStart, projectEnd) + 1;

                if (projectEnd > timelineEnd) {
                  projectDuration = getDaysBetween(projectStart, timelineEnd);
                }

                if (startOffset < 0) {
                  projectDuration += startOffset;
                  startOffset = 0;
                }

                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      paddingLeft: '20px',
                      position: 'sticky',
                      height: '65px',
                    }}
                  >
                    <Badge color="red" />
                    <Tooltip
                      title={
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>
                            {t('startDate')}: {project.startDate}
                          </span>
                          <span>
                            {t('endDate')}: {project.endDate}
                          </span>
                        </div>
                      }
                    >
                      {project.projectName}
                    </Tooltip>
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      {/* left side of the table */}
      <div style={{ overflow: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${totalDays}, 75px)`,
            gap: '2px',
            height: '60px',
            borderBottom:
              themeMode === 'dark' ? '1px solid #303030' : '1px solid rgba(0, 0, 0, 0.2)',
          }}
        >
          {Array.from({ length: totalDays }, (_, i) => {
            const date = new Date(timelineStart);
            date.setDate(timelineStart.getDate() + i);
            const formattedDate = date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={i}
                style={{
                  textAlign: 'center',
                  fontSize: '14px',
                  width: '83px',
                  padding: '8px 16px 0px 16px',
                  fontWeight: 'bold',
                  color:
                    today && date && today.toDateString() === date.toDateString()
                      ? 'white'
                      : weekends[i]
                        ? themeMode === 'dark'
                          ? 'rgba(200, 200, 200, 0.6)'
                          : 'rgba(0, 0, 0, 0.27)'
                        : '',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor:
                    today && date && today.toDateString() === date.toDateString()
                      ? 'rgba(24, 144, 255, 1)'
                      : '',
                  borderRadius: '5px',
                }}
              >
                {formattedDate}
              </div>
            );
          })}
        </div>

        <div>
          {members.map(member => (
            <div
              key={member.memberId}
              style={{
                display: 'flex',
                width: '100%',
                flexDirection: 'column',
              }}
            >
              <Row>
                <Col span={24} style={{ display: 'flex', width: '100%', paddingLeft: '3px' }}>
                  {Array.from({ length: totalDays }, (_, i) => {
                    const currentDay = new Date(timelineStart);
                    currentDay.setDate(timelineStart.getDate() + i);

                    const formattedCurrentDay = currentDay.toISOString().split('T')[0];
                    const loggedHours =
                      member.timeLogged?.find(log => log.date === formattedCurrentDay)?.hours || 0;

                    const totalPerDayHours =
                      member.projects.reduce((total, project) => {
                        const projectStart = new Date(project.startDate);
                        const projectEnd = new Date(project.endDate);
                        if (currentDay >= projectStart && currentDay <= projectEnd) {
                          return total + project.perDayHours;
                        }
                        return total;
                      }, 0) - loggedHours;

                    return (
                      <div
                        key={i}
                        style={{
                          fontSize: '14px',
                          backgroundColor: weekends[i] ? 'rgba(217, 217, 217, 0.4)' : '',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          padding: '10px 7px 10px 7px',
                          height: '92px',
                          flexDirection: 'column',
                        }}
                      >
                        <Tooltip
                          title={
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                              }}
                            >
                              <span>
                                {t('totalAllocation')} - {totalPerDayHours + loggedHours}
                              </span>
                              <span>
                                {t('timeLogged')} - {loggedHours}
                              </span>
                              <span>
                                {t('remainingTime')} - {totalPerDayHours}
                              </span>
                            </div>
                          }
                        >
                          <div
                            style={{
                              width: '63px',
                              background: `linear-gradient(to top, ${totalPerDayHours <= 0 ? 'rgba(200, 200, 200, 0.35)' : totalPerDayHours <= workingHours ? 'rgba(6, 126, 252, 0.4)' : 'rgba(255, 0, 0, 0.4)'} ${(totalPerDayHours * 100) / workingHours}%, rgba(190, 190, 190, 0.25) ${(totalPerDayHours * 100) / workingHours}%)`,
                              justifyContent: loggedHours > 0 ? 'flex-end' : 'center',
                              display: 'flex',
                              alignItems: 'center',
                              height: '100%',
                              borderRadius: '5px',
                              flexDirection: 'column',
                              cursor: 'pointer',
                            }}
                            onClick={() => dispatch(toggleScheduleDrawer())}
                          >
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: `${(totalPerDayHours * 100) / workingHours}%`,
                              }}
                            >
                              {totalPerDayHours}h
                            </span>
                            {loggedHours > 0 && (
                              <span
                                style={{
                                  height: `${(loggedHours * 100) / workingHours}%`,
                                  backgroundColor: 'rgba(98, 210, 130, 1)',
                                  width: '100%',
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  borderBottomLeftRadius: '5px',
                                  borderBottomRightRadius: '5px',
                                }}
                              >
                                {loggedHours}h
                              </span>
                            )}
                          </div>
                        </Tooltip>
                      </div>
                    );
                  })}
                </Col>
              </Row>
              {/* Row for Each Project Timeline */}
              {showProject === member.memberId &&
                member.projects.map(project => {
                  const projectStart = new Date(project.startDate);
                  const projectEnd = new Date(project.endDate);
                  let startOffset = getDaysBetween(timelineStart, projectStart);
                  let projectDuration = getDaysBetween(projectStart, projectEnd) + 1;

                  if (projectEnd > timelineEnd) {
                    projectDuration = getDaysBetween(projectStart, timelineEnd);
                  }

                  if (startOffset < 0) {
                    projectDuration += startOffset;
                    startOffset = 0;
                  }

                  return (
                    <Row key={project.projectId}>
                      <Col
                        span={24}
                        style={{
                          display: 'flex',
                          position: 'relative',
                          paddingLeft: '3px',
                        }}
                      >
                        {Array.from({ length: totalDays }, (_, i) => (
                          <Popover content={<ProjectTimelineModal />} trigger="click">
                            <div
                              className={
                                i >= startOffset && i < startOffset + projectDuration
                                  ? 'empty-cell-hide'
                                  : 'empty-cell'
                              }
                              key={i}
                              style={{
                                fontSize: '14px',
                                backgroundColor: weekends[i] ? 'rgba(217, 217, 217, 0.4)' : '',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                padding: '10px 7px',
                                height: '65px',
                                flexDirection: 'column',
                                position: 'relative',
                              }}
                            >
                              <div
                                style={{
                                  width: '63px',
                                  height: '100%',
                                  zIndex: 1,
                                }}
                              ></div>

                              {/* Project Timeline Bar */}
                              {i === startOffset && (
                                <div
                                  className="project-timeline-bar"
                                  style={{
                                    gridColumnStart: startOffset + 1,
                                    gridColumnEnd: startOffset + projectDuration + 1,
                                    backgroundColor:
                                      themeMode === 'dark'
                                        ? 'rgba(0, 142, 204, 0.5)'
                                        : 'rgba(240, 248, 255, 1)',
                                    height: '60px',
                                    width: `${77 * projectDuration}px`,
                                    borderRadius: '5px',
                                    border:
                                      themeMode === 'dark'
                                        ? '1px solid rgba(24, 144, 255, 1)'
                                        : '1px solid rgba(149, 197, 248, 1)',
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    top: '0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    padding: '0 10px',
                                    zIndex: 99,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: '12px',
                                      fontWeight: 'bold',
                                    }}
                                  >
                                    {t('total')} {project.totalHours}h
                                  </span>
                                  <span style={{ fontSize: '10px' }}>
                                    {t('perDay')} {project.perDayHours}h
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      textDecoration: 'underline',
                                    }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      dispatch(toggleScheduleDrawer());
                                    }}
                                  >
                                    20 {t('tasks')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </Popover>
                        ))}
                      </Col>
                    </Row>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </Flex>
  );
};

const Team: React.FC<teamProps> = ({ date }) => {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/TeamData.json');
        const data = await response.json();
        setMembers(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  return <GanttChart members={members} date={date} />;
};

export default Team;
