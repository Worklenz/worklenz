// import React, { useEffect, useState } from 'react';
// import { Member } from '../../../types/schedule/schedule.types';
// import {
//   Avatar,
//   Badge,
//   Button,
//   Col,
//   Flex,
//   Popover,
//   Row,
//   Tooltip,
//   Typography,
// } from '@/shared/antd-imports';
// import { avatarNamesMap } from '../../../shared/constants';
// import { CaretDownOutlined, CaretRightFilled } from '@ant-design/icons';
// import { useAppSelector } from '@/hooks/useAppSelector';
// import './Team.css';
// import { useDispatch } from 'react-redux';
// import { toggleScheduleDrawer } from '../../../features/schedule/scheduleSlice';
// import ProjectTimelineModal from '../../../features/schedule/ProjectTimelineModal';
// import ScheduleDrawer from '../../../features/schedule/ScheduleDrawer';
// import { useTranslation } from 'react-i18next';
// import CustomAvatar from '../../CustomAvatar';
// import { themeWiseColor } from '../../../utils/themeWiseColor';

// interface GanttChartProps {
//   members: Member[];
//   date: Date | null;
// }

// interface teamProps {
//   date: Date | null;
// }

// const getDaysBetween = (start: Date, end: Date): number => {
//   const msPerDay = 1000 * 60 * 60 * 24;
//   return Math.round((end.getTime() - start.getTime()) / msPerDay);
// };

// const GanttChart: React.FC<GanttChartProps> = ({ members, date }) => {
//   const [weekends, setWeekends] = useState<boolean[]>([]);
//   const [today, setToday] = useState(new Date());
//   const [showProject, setShowProject] = useState<string | null>(null);
//   const workingDays = useAppSelector(
//     (state) => state.scheduleReducer.workingDays
//   );
//   const workingHours = useAppSelector(
//     (state) => state.scheduleReducer.workingHours
//   );
//   const themeMode = useAppSelector((state) => state.themeReducer.mode);
//   const dispatch = useDispatch();
//   const { t } = useTranslation('schedule');

//   const timelineStart = date ? date : new Date();
//   const timelineEnd = new Date(timelineStart);
//   timelineEnd.setDate(timelineStart.getDate() + 30);

//   const totalDays = getDaysBetween(timelineStart, timelineEnd);

//   useEffect(() => {
//     const weekendsArray = Array.from({ length: totalDays }, (_, i) => {
//       const date = new Date(timelineStart);
//       date.setDate(timelineStart.getDate() + i);

//       // Check if the day is Saturday or Sunday
//       const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
//       return !workingDays.includes(dayName);
//     });

//     setWeekends(weekendsArray);
//   }, [totalDays, timelineStart]);

//   const handleShowProject = (memberId: string) => {
//     setShowProject((prevMemberId) =>
//       prevMemberId === memberId ? null : memberId
//     );
//   };

//   return (
//     <Flex
//       style={{
//         border:
//           themeMode === 'dark'
//             ? '1px solid #303030'
//             : '1px solid rgba(0, 0, 0, 0.2)',
//         padding: '0 0 10px 0px',
//         borderRadius: '4px',
//         backgroundColor: themeMode === 'dark' ? '#141414' : '',
//       }}
//     >
//       {/* table */}
//       <Flex vertical style={{ width: '230px' }}>
//         {/* right side of the table */}
//         <div
//           style={{
//             height: '60px',
//             borderBottom:
//               themeMode === 'dark'
//                 ? '1px solid #303030'
//                 : '1px solid rgba(0, 0, 0, 0.2)',
//           }}
//         ></div>
//         {members.map((member) => (
//           <Flex vertical key={member.memberId}>
//             <Flex
//               gap={8}
//               align="center"
//               style={{
//                 paddingLeft: '20px',
//                 height: '92px',
//               }}
//             >
//               <CustomAvatar avatarName={member.memberName} size={32} />

//               <Button
//                 type="text"
//                 size="small"
//                 style={{ padding: 0 }}
//                 onClick={() => dispatch(toggleScheduleDrawer())}
//               >
//                 {member.memberName}
//               </Button>
//               <Button
//                 size="small"
//                 type="text"
//                 onClick={() => handleShowProject(member.memberId)}
//               >
//                 {showProject === member.memberId ? (
//                   <CaretDownOutlined />
//                 ) : (
//                   <CaretRightFilled />
//                 )}
//               </Button>
//               <ScheduleDrawer />
//             </Flex>

//             {showProject === member.memberId &&
//               member.projects.map((project, index) => {
//                 const projectStart = new Date(project.startDate);
//                 const projectEnd = new Date(project.endDate);
//                 let startOffset = getDaysBetween(timelineStart, projectStart);
//                 let projectDuration =
//                   getDaysBetween(projectStart, projectEnd) + 1;

//                 if (projectEnd > timelineEnd) {
//                   projectDuration = getDaysBetween(projectStart, timelineEnd);
//                 }

//                 if (startOffset < 0) {
//                   projectDuration += startOffset;
//                   startOffset = 0;
//                 }

//                 return (
//                   <div
//                     key={index}
//                     style={{
//                       display: 'flex',
//                       alignItems: 'center',
//                       gap: '10px',
//                       paddingLeft: '20px',
//                       position: 'sticky',
//                       height: '65px',
//                     }}
//                   >
//                     <Badge color="red" />
//                     <Tooltip
//                       title={
//                         <div
//                           style={{ display: 'flex', flexDirection: 'column' }}
//                         >
//                           <span>
//                             {t('startDate')}: {project.startDate}
//                           </span>
//                           <span>
//                             {t('endDate')}: {project.endDate}
//                           </span>
//                         </div>
//                       }
//                     >
//                       {project.projectName}
//                     </Tooltip>
//                   </div>
//                 );
//               })}
//           </Flex>
//         ))}
//       </Flex>

//       {/* left side of the table */}
//       <div style={{ overflow: 'auto' }}>
//         <div
//           style={{
//             display: 'grid',
//             gridTemplateColumns: `repeat(${totalDays}, 75px)`,
//             gap: '2px',
//             height: '60px',
//             borderBottom:
//               themeMode === 'dark'
//                 ? '1px solid #303030'
//                 : '1px solid rgba(0, 0, 0, 0.2)',
//           }}
//         >
//           {Array.from({ length: totalDays }, (_, i) => {
//             const date = new Date(timelineStart);
//             date.setDate(timelineStart.getDate() + i);
//             const formattedDate = date.toLocaleDateString('en-US', {
//               weekday: 'short',
//               month: 'short',
//               day: 'numeric',
//             });

//             return (
//               <div
//                 key={i}
//                 style={{
//                   textAlign: 'center',
//                   fontSize: '14px',
//                   width: '83px',
//                   padding: '8px 16px 0px 16px',
//                   color:
//                     today &&
//                     date &&
//                     today.toDateString() === date.toDateString()
//                       ? 'white'
//                       : weekends[i]
//                         ? themeMode === 'dark'
//                           ? 'rgba(200, 200, 200, 0.6)'
//                           : 'rgba(0, 0, 0, 0.27)'
//                         : '',
//                   display: 'flex',
//                   justifyContent: 'center',
//                   alignItems: 'center',
//                   backgroundColor:
//                     today &&
//                     date &&
//                     today.toDateString() === date.toDateString()
//                       ? 'rgba(24, 144, 255, 1)'
//                       : '',
//                   borderRadius: '5px',
//                 }}
//               >
//                 {formattedDate}
//               </div>
//             );
//           })}
//         </div>

//         <div>
//           {members.map((member) => (
//             <div
//               key={member.memberId}
//               style={{
//                 display: 'flex',
//                 width: '100%',
//                 flexDirection: 'column',
//               }}
//             >
//               <Row>
//                 <Col
//                   span={24}
//                   style={{ display: 'flex', width: '100%', paddingLeft: '3px' }}
//                 >
//                   {Array.from({ length: totalDays }, (_, i) => {
//                     const currentDay = new Date(timelineStart);
//                     currentDay.setDate(timelineStart.getDate() + i);

//                     const formattedCurrentDay = currentDay
//                       .toISOString()
//                       .split('T')[0];
//                     const loggedHours =
//                       member.timeLogged?.find(
//                         (log) => log.date === formattedCurrentDay
//                       )?.hours || 0;

//                     const totalPerDayHours =
//                       member.projects.reduce((total, project) => {
//                         const projectStart = new Date(project.startDate);
//                         const projectEnd = new Date(project.endDate);
//                         if (
//                           currentDay >= projectStart &&
//                           currentDay <= projectEnd
//                         ) {
//                           return total + project.perDayHours;
//                         }
//                         return total;
//                       }, 0) - loggedHours;

//                     return (
//                       <div
//                         key={i}
//                         style={{
//                           fontSize: '14px',
//                           backgroundColor: weekends[i]
//                             ? 'rgba(217, 217, 217, 0.4)'
//                             : '',
//                           display: 'flex',
//                           justifyContent: 'center',
//                           alignItems: 'center',
//                           padding: '10px 7px 10px 7px',
//                           height: '92px',
//                           flexDirection: 'column',
//                         }}
//                       >
//                         <Tooltip
//                           title={
//                             <div
//                               style={{
//                                 display: 'flex',
//                                 flexDirection: 'column',
//                               }}
//                             >
//                               <span>
//                                 {t('totalAllocation')} -{' '}
//                                 {totalPerDayHours + loggedHours}
//                               </span>
//                               <span>
//                                 {t('timeLogged')} - {loggedHours}
//                               </span>
//                               <span>
//                                 {t('remainingTime')} - {totalPerDayHours}
//                               </span>
//                             </div>
//                           }
//                         >
//                           <div
//                             style={{
//                               width: '63px',
//                               background: `linear-gradient(to top, ${totalPerDayHours <= 0 ? 'rgba(200, 200, 200, 0.35)' : totalPerDayHours <= workingHours ? 'rgba(6, 126, 252, 0.4)' : 'rgba(255, 0, 0, 0.4)'} ${(totalPerDayHours * 100) / workingHours}%, rgba(190, 190, 190, 0.25) ${(totalPerDayHours * 100) / workingHours}%)`,
//                               justifyContent:
//                                 loggedHours > 0 ? 'flex-end' : 'center',
//                               display: 'flex',
//                               alignItems: 'center',
//                               height: '100%',
//                               borderRadius: '5px',
//                               flexDirection: 'column',
//                               cursor: 'pointer',
//                             }}
//                             onClick={() => dispatch(toggleScheduleDrawer())}
//                           >
//                             <span
//                               style={{
//                                 display: 'flex',
//                                 alignItems: 'center',
//                                 justifyContent: 'center',
//                                 height: `${(totalPerDayHours * 100) / workingHours}%`,
//                               }}
//                             >
//                               {totalPerDayHours}h
//                             </span>
//                             {loggedHours > 0 && (
//                               <span
//                                 style={{
//                                   height: `${(loggedHours * 100) / workingHours}%`,
//                                   backgroundColor: 'rgba(98, 210, 130, 1)',
//                                   width: '100%',
//                                   display: 'flex',
//                                   justifyContent: 'center',
//                                   alignItems: 'center',
//                                   borderBottomLeftRadius: '5px',
//                                   borderBottomRightRadius: '5px',
//                                 }}
//                               >
//                                 {loggedHours}h
//                               </span>
//                             )}
//                           </div>
//                         </Tooltip>
//                       </div>
//                     );
//                   })}
//                 </Col>
//               </Row>
//               {/* Row for Each Project Timeline */}
//               {showProject === member.memberId &&
//                 member.projects.map((project) => {
//                   const projectStart = new Date(project.startDate);
//                   const projectEnd = new Date(project.endDate);
//                   let startOffset = getDaysBetween(timelineStart, projectStart);
//                   let projectDuration =
//                     getDaysBetween(projectStart, projectEnd) + 1;

//                   if (projectEnd > timelineEnd) {
//                     projectDuration = getDaysBetween(projectStart, timelineEnd);
//                   }

//                   if (startOffset < 0) {
//                     projectDuration += startOffset;
//                     startOffset = 0;
//                   }

//                   return (
//                     <Row key={project.projectId}>
//                       <Col
//                         span={24}
//                         style={{
//                           display: 'flex',
//                           position: 'relative',
//                           paddingLeft: '3px',
//                         }}
//                       >
//                         {Array.from({ length: totalDays }, (_, i) => (
//                           <Popover
//                             content={<ProjectTimelineModal />}
//                             trigger="click"
//                           >
//                             <div
//                               className={
//                                 i >= startOffset &&
//                                 i < startOffset + projectDuration
//                                   ? 'empty-cell-hide'
//                                   : `empty-cell rounded-xs outline-1 hover:outline-solid ${themeMode === 'dark' ? 'outline-white/25' : 'outline-black/25'}`
//                               }
//                               key={i}
//                               style={{
//                                 fontSize: '14px',
//                                 backgroundColor: weekends[i]
//                                   ? 'rgba(217, 217, 217, 0.4)'
//                                   : '',
//                                 display: 'flex',
//                                 justifyContent: 'center',
//                                 alignItems: 'center',
//                                 padding: '10px 7px',
//                                 height: '65px',
//                                 flexDirection: 'column',
//                                 position: 'relative',
//                                 cursor: 'pointer',
//                               }}
//                             >
//                               <div
//                                 style={{
//                                   width: '63px',
//                                   height: '100%',
//                                   zIndex: 1,
//                                 }}
//                               ></div>

//                               {/* Project Timeline Bar */}
//                               {i === startOffset && (
//                                 <Tooltip
//                                   title={
//                                     <Flex vertical gap={4}>
//                                       <div>
//                                         {t('total')} {project.totalHours}h
//                                       </div>
//                                       <div>
//                                         {t('perDay')} {project.perDayHours}h
//                                       </div>
//                                       <div>20 {t('tasks')}</div>
//                                     </Flex>
//                                   }
//                                 >
//                                   <div
//                                     className="project-timeline-bar"
//                                     style={{
//                                       gridColumnStart: startOffset + 1,
//                                       gridColumnEnd:
//                                         startOffset + projectDuration + 1,
//                                       backgroundColor:
//                                         themeMode === 'dark'
//                                           ? 'rgba(0, 142, 204, 0.5)'
//                                           : 'rgba(240, 248, 255, 1)',
//                                       height: '60px',
//                                       width: `${77 * projectDuration}px`,
//                                       borderRadius: '5px',
//                                       border:
//                                         themeMode === 'dark'
//                                           ? '1px solid rgba(24, 144, 255, 1)'
//                                           : '1px solid rgba(149, 197, 248, 1)',
//                                       position: 'absolute',
//                                       left: 0,
//                                       right: 0,
//                                       top: '0',
//                                       display: 'flex',
//                                       flexDirection: 'column',
//                                       justifyContent: 'center',
//                                       padding: '4px 10px',
//                                       zIndex: 99,
//                                       cursor: 'pointer',
//                                     }}
//                                   >
//                                     <Typography.Text
//                                       style={{
//                                         fontSize: '12px',
//                                         fontWeight: 'bold',
//                                       }}
//                                       ellipsis={{ expanded: false }}
//                                     >
//                                       {t('total')} {project.totalHours}h
//                                     </Typography.Text>

//                                     <Typography.Text
//                                       style={{ fontSize: '10px' }}
//                                       ellipsis={{ expanded: false }}
//                                     >
//                                       {t('perDay')} {project.perDayHours}h
//                                     </Typography.Text>

//                                     <Typography.Text
//                                       style={{
//                                         fontSize: '10px',
//                                         textDecoration: 'underline',
//                                       }}
//                                       ellipsis={{ expanded: false }}
//                                       onClick={(e) => {
//                                         e.stopPropagation();
//                                         dispatch(toggleScheduleDrawer());
//                                       }}
//                                     >
//                                       20 {t('tasks')}
//                                     </Typography.Text>
//                                   </div>
//                                 </Tooltip>
//                               )}
//                             </div>
//                           </Popover>
//                         ))}
//                       </Col>
//                     </Row>
//                   );
//                 })}
//             </div>
//           ))}
//         </div>
//       </div>
//     </Flex>
//   );
// };

// const Team: React.FC<teamProps> = ({ date }) => {
//   const [members, setMembers] = useState<Member[]>([]);

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const response = await fetch('/TeamData.json');
//         const data = await response.json();
//         setMembers(data);
//       } catch (error) {
//         console.error('Error fetching data:', error);
//       }
//     };
//     fetchData();
//   }, []);

//   return <GanttChart members={members} date={date} />;
// };

// export default Team;

import React from 'react';

const Grant = () => {
  return <div>Grant</div>;
};

export default Grant;
// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from 'react';
// import { Member } from '../../../../types/schedule/schedule.types';
// import { Col, Flex, Row, Typography } from '@/shared/antd-imports';
// import { useAppSelector } from '../../../../hooks/useAppSelector';
// import { useDispatch } from 'react-redux';
// import { toggleScheduleDrawer } from '../../../../features/schedule/scheduleSlice';
// import { useTranslation } from 'react-i18next';
// import DayAllocationCell from './day-allocation-cell';
// import ProjectTimelineBar from './project-timeline-bar';
// import dayjs from 'dayjs';
// import ScheduleDrawer from '../../../../features/schedule/ScheduleDrawer';
// import GranttMembersTable from './grantt-members-table';
// import { themeWiseColor } from '../../../../utils/themeWiseColor';

// type GanttChartProps = {
//   members: Member[];
//   date: Date | null;
// };

// const getDaysBetween = (start: Date, end: Date): number => {
//   const msPerDay = 1000 * 60 * 60 * 24;
//   return Math.round((end.getTime() - start.getTime()) / msPerDay);
// };

// const GanttChart: React.FC<GanttChartProps> = ({ members, date }) => {
//   const [weekends, setWeekends] = useState<boolean[]>([]);
//   const [today, setToday] = useState(new Date());
//   const [showProject, setShowProject] = useState<string | null>(null);
//   const { workingDays } = useAppSelector((state) => state.scheduleReducer);
//   const workingHours = useAppSelector(
//     (state) => state.scheduleReducer.workingHours
//   );

//   const timelineScrollRef = useRef<HTMLDivElement>(null);
//   const timelineHeaderScrollRef = useRef<HTMLDivElement>(null);
//   const membersScrollRef = useRef<HTMLDivElement>(null);

//   // localization
//   const { t } = useTranslation('schedule');

//   // get theme data
//   const themeMode = useAppSelector((state) => state.themeReducer.mode);
//   const dispatch = useDispatch();

//   const timelineStart = useMemo(() => {
//     const baseDate = date ? new Date(date) : new Date();
//     const startDate = new Date(baseDate);
//     startDate.setDate(baseDate.getDate() - 90);
//     return startDate;
//   }, [date]);

//   const timelineEnd = useMemo(() => {
//     const endDate = new Date(timelineStart);
//     endDate.setDate(timelineStart.getDate() + 180);
//     return endDate;
//   }, [timelineStart]);

//   const totalDays = getDaysBetween(timelineStart, timelineEnd);

//   useEffect(() => {
//     const weekendsArray = Array.from({ length: totalDays }, (_, i) => {
//       const date = new Date(timelineStart);
//       date.setDate(timelineStart.getDate() + i);

//       const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
//       return !workingDays.includes(dayName);
//     });

//     setWeekends(weekendsArray);
//   }, [timelineStart, totalDays, workingDays]);

//   const handleShowProject = useCallback((memberId: string | null) => {
//     setShowProject((prevMemberId: string | null) =>
//       prevMemberId === memberId ? null : memberId
//     );
//   }, []);

//   // function to sync scroll
//   const syncVerticalScroll = (source: 'timeline' | 'members') => {
//     if (source === 'timeline') {
//       if (membersScrollRef.current && timelineScrollRef.current) {
//         membersScrollRef.current.scrollTop =
//           timelineScrollRef.current.scrollTop;
//       }
//     } else {
//       if (timelineScrollRef.current && membersScrollRef.current) {
//         timelineScrollRef.current.scrollTop =
//           membersScrollRef.current.scrollTop;
//       }
//     }
//   };

//   // function to sync scroll
//   const syncHorizontalScroll = (source: 'timeline' | 'header') => {
//     if (source === 'timeline') {
//       if (timelineHeaderScrollRef.current && timelineScrollRef.current) {
//         timelineHeaderScrollRef.current.scrollLeft =
//           timelineScrollRef.current.scrollLeft;
//       }
//     } else {
//       if (timelineScrollRef.current && timelineHeaderScrollRef.current) {
//         timelineScrollRef.current.scrollLeft =
//           timelineHeaderScrollRef.current.scrollLeft;
//       }
//     }
//   };

//   return (
//     <div
//       style={{
//         display: 'grid',
//         gridTemplateColumns: '375px 1fr',
//         overflow: 'hidden',
//         height: 'calc(100vh - 206px)',
//         border:
//           themeMode === 'dark' ? '1px solid #303030' : '1px solid #e5e7eb',
//         borderRadius: '4px',
//         backgroundColor: themeMode === 'dark' ? '#141414' : '',
//       }}
//     >
//       {/* ============================================================================================================================== */}
//       {/* table */}
//       <div
//         style={{
//           background: themeWiseColor('#fff', '#141414', themeMode),
//         }}
//         className={`after:content relative z-10 after:absolute after:-right-1 after:top-0 after:-z-10 after:h-full after:w-1.5 after:bg-transparent after:bg-linear-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent`}
//       >
//         <GranttMembersTable
//           members={members}
//           showProjects={showProject}
//           handleShowProject={handleShowProject}
//           timelineStart={timelineStart}
//           timelineEnd={timelineEnd}
//           memberScrollRef={membersScrollRef}
//           syncVerticalScroll={syncVerticalScroll}
//         />
//       </div>

//       {/* ============================================================================================================================== */}
//       {/* left side of the table */}
//       <div style={{ overflow: 'auto' }}>
//         <div
//           ref={timelineHeaderScrollRef}
//           style={{
//             position: 'sticky',
//             overflow: 'auto',
//             top: 0,
//             left: 0,
//             right: 0,
//             zIndex: 100,
//             backgroundColor: themeWiseColor('#fff', '#141414', themeMode),
//             scrollbarWidth: 'none',
//             borderBottom:
//               themeMode === 'dark' ? '1px solid #303030' : '1px solid #e5e7eb',
//           }}
//           onScroll={() => syncHorizontalScroll('header')}
//         >
//           <div
//             style={{
//               display: 'grid',
//               gridTemplateColumns: `repeat(${totalDays}, 75px)`,
//               gap: 2,
//               height: 60,
//             }}
//           >
//             {Array.from({ length: totalDays }, (_, i) => {
//               const date = new Date(timelineStart);
//               date.setDate(timelineStart.getDate() + i);
//               const formattedDateDay = dayjs(date).format(`ddd,`);
//               const formattedDateMonth = dayjs(date).format(`MMM DD`);
//               return (
//                 <Flex
//                   vertical
//                   align="center"
//                   justify="center"
//                   key={i}
//                   style={{
//                     textAlign: 'center',
//                     fontSize: '12px',
//                     width: '77px',
//                     padding: '8px',
//                     borderBottom:
//                       themeMode === 'dark'
//                         ? '1px solid #303030'
//                         : '1px solid #e5e7eb',
//                     color:
//                       today &&
//                       date &&
//                       today.toDateString() === date.toDateString()
//                         ? 'white'
//                         : weekends[i]
//                           ? themeMode === 'dark'
//                             ? 'rgba(200, 200, 200, 0.6)'
//                             : 'rgba(0, 0, 0, 0.27)'
//                           : '',
//                     backgroundColor:
//                       today &&
//                       date &&
//                       today.toDateString() === date.toDateString()
//                         ? 'rgba(24, 144, 255, 1)'
//                         : weekends[i]
//                           ? themeMode === 'dark'
//                             ? 'rgba(200, 200, 200, 0.6)'
//                             : 'rgba(217, 217, 217, 0.4)'
//                           : '',
//                     borderRadius:
//                       today &&
//                       date &&
//                       today.toDateString() === date.toDateString()
//                         ? 0
//                         : 0,
//                   }}
//                 >
//                   <Typography.Text>{formattedDateDay}</Typography.Text>
//                   <Typography.Text>{formattedDateMonth}</Typography.Text>
//                 </Flex>
//               );
//             })}
//           </div>
//         </div>

//         <Flex
//           vertical
//           ref={timelineScrollRef}
//           onScroll={() => {
//             syncVerticalScroll('timeline');
//             syncHorizontalScroll('timeline');
//           }}
//           style={{
//             height: 'calc(100vh - 270px)',
//             overflow: 'auto',
//           }}
//         >
//           {members.map((member) => (
//             <Flex
//               vertical
//               key={member.memberId}
//               style={{
//                 width: '100%',
//               }}
//             >
//               <Row>
//                 <Col span={24} style={{ display: 'flex', width: '100%' }}>
//                   {Array.from({ length: totalDays }, (_, i) => {
//                     const currentDay = new Date(timelineStart);
//                     currentDay.setDate(timelineStart.getDate() + i);
//                     const formattedCurrentDay = currentDay
//                       .toISOString()
//                       .split('T')[0];
//                     const loggedHours =
//                       member.timeLogged?.find(
//                         (log) => log.date === formattedCurrentDay
//                       )?.hours || 0;
//                     const totalPerDayHours =
//                       member.projects.reduce((total, project) => {
//                         const projectStart = new Date(project.startDate);
//                         const projectEnd = new Date(project.endDate);
//                         if (
//                           currentDay >= projectStart &&
//                           currentDay <= projectEnd
//                         ) {
//                           return total + project.perDayHours;
//                         }
//                         return total;
//                       }, 0) - loggedHours;
//                     return (
//                       <DayAllocationCell
//                         key={i}
//                         currentDay={currentDay}
//                         weekends={weekends}
//                         totalPerDayHours={totalPerDayHours}
//                         loggedHours={loggedHours}
//                         workingHours={workingHours}
//                         onClick={() => dispatch(toggleScheduleDrawer())}
//                         isWeekend={weekends[i]}
//                       />
//                     );
//                   })}
//                 </Col>
//               </Row>
//               {/* Row for Each Project Timeline */}
//               {showProject === member.memberId &&
//                 member.projects.map((project) => {
//                   const projectStart = new Date(project.startDate);
//                   const projectEnd = new Date(project.endDate);
//                   let startOffset = getDaysBetween(timelineStart, projectStart);
//                   let projectDuration =
//                     getDaysBetween(projectStart, projectEnd) + 1;
//                   if (projectEnd > timelineEnd) {
//                     projectDuration = getDaysBetween(projectStart, timelineEnd);
//                   }
//                   if (startOffset < 0) {
//                     projectDuration += startOffset;
//                     startOffset = 0;
//                   }
//                   return (
//                     <Row key={project.projectId}>
//                       <Col
//                         span={24}
//                         style={{
//                           display: 'flex',
//                           position: 'relative',
//                         }}
//                       >
//                         {Array.from({ length: totalDays }, (_, i) => (
//                           <Flex
//                             align="center"
//                             justify="center"
//                             className={
//                               i >= startOffset &&
//                               i < startOffset + projectDuration
//                                 ? 'empty-cell-hide'
//                                 : `empty-cell rounded-xs outline-1 hover:outline-solid ${themeMode === 'dark' ? 'outline-white/10' : 'outline-black/10'}`
//                             }
//                             key={i}
//                             style={{
//                               fontSize: '14px',
//                               backgroundColor: weekends[i]
//                                 ? 'rgba(217, 217, 217, 0.4)'
//                                 : '',
//                               padding: '10px 7px',
//                               height: '65px',
//                               flexDirection: 'column',
//                               position: 'relative',
//                               cursor: 'pointer',
//                             }}
//                           >
//                             <div
//                               style={{
//                                 width: '63px',
//                                 height: '100%',
//                                 zIndex: 1,
//                               }}
//                             ></div>
//                             {/* Project Timeline Bar */}
//                             {i === startOffset && (
//                               <ProjectTimelineBar
//                                 project={project}
//                                 startOffset={startOffset}
//                                 projectDuration={3}
//                               />
//                             )}
//                           </Flex>
//                         ))}
//                       </Col>
//                     </Row>
//                   );
//                 })}
//             </Flex>
//           ))}
//         </Flex>
//       </div>

//       <ScheduleDrawer />
//     </div>
//   );
// };

// export default React.memo(GanttChart);
