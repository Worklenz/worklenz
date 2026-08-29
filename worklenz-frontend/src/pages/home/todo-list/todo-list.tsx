import { CheckCircleOutlined, CheckOutlined, DownOutlined, RightOutlined, theme } from '@/shared/antd-imports';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Form from 'antd/es/form';
import Input, { InputRef } from 'antd/es/input';
import Flex from 'antd/es/flex';
import Collapse from 'antd/es/collapse';
import ConfigProvider from 'antd/es/config-provider';
import Table, { TableProps } from 'antd/es/table';
import Tooltip from 'antd/es/tooltip';
import Typography from 'antd/es/typography';
import Button from 'antd/es/button';
import Alert from 'antd/es/alert';

import EmptyListPlaceholder from '@components/EmptyListPlaceholder';
import { IMyTask } from '@/types/home/my-tasks.types';
import { useTranslation } from 'react-i18next';
import { colors } from '@/styles/colors';
import dayjs from 'dayjs';
import {
  useGetPersonalTasksQuery,
  useMarkPersonalTaskAsDoneMutation,
  useCreatePersonalTaskMutation,
} from '@/api/home-page/home-page.api.service';
import { useResponsive } from '@/hooks/useResponsive';

// Mirrors the left "Views" filter rail on the My Tasks page (HomeMyTasksView)
// so Todo List's period switcher lives in the same place visually.
const TODO_VIEW_FILTERS: Array<'today' | 'week' | 'month' | 'year'> = ['today', 'week', 'month', 'year'];

const TodoList = () => {
  const { token } = theme.useToken();
  const [isAlertShowing, setIsAlertShowing] = useState(false);
  const [viewFilter, setViewFilter] = useState<'today' | 'week' | 'month' | 'year'>('week');
  const [form] = Form.useForm();
  const { t } = useTranslation('home');
  const { isDesktop } = useResponsive();

  const currentYear = dayjs().year();

  const [createPersonalTask, { isLoading: isCreatingPersonalTask }] =
    useCreatePersonalTaskMutation();
  const [markPersonalTaskAsDone, { isLoading: isMarkingPersonalTaskAsDone }] =
    useMarkPersonalTaskAsDoneMutation();

  const queryParams = useMemo(() => ({
    filter: viewFilter,
    year: viewFilter === 'year' ? currentYear.toString() : undefined
  }), [viewFilter, currentYear]);

  const { data, isFetching, refetch } = useGetPersonalTasksQuery(queryParams);

  // The date range for "today"/"week"/"month" is computed once when the query fires
  // (see home-page.api.service.ts) and won't update on its own as time passes, so
  // periodically re-issue the same query to catch day/week/month rollovers while the
  // page stays open. A plain refetch() (rather than juggling queryParams identity,
  // which RTK Query's serialized cache key wouldn't treat as a new query anyway).
  useEffect(() => {
    const timer = setInterval(() => refetch(), 60_000);
    return () => clearInterval(timer);
  }, [refetch]);

  const todoInputRef = useRef<InputRef | null>(null);

  const handleTodoSubmit = async (values: any) => {
    if (!values.name || values.name.trim() === '') return;
    if (isCreatingPersonalTask) return;

    const newTodo: IMyTask = {
      name: values.name,
      done: false,
      is_task: false,
      color_code: '#000',
      manual_progress: 0,
    };

    const res = await createPersonalTask(newTodo);
    if (res.data?.done) {
      refetch();
    }

    setIsAlertShowing(false);
    form.resetFields();
    // Deferred a tick: the refetch() above re-renders the list right around
    // now, which can steal focus back before the browser applies it.
    setTimeout(() => todoInputRef.current?.focus(), 0);
  };

  const handleCompleteTodo = async (id: string | undefined) => {
    if (!id) return;
    const res = await markPersonalTaskAsDone(id);
    if (res.data?.done) {
      refetch();
    }
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    return dayjs(dateString).format('MMM D, YYYY');
  };

  // Single-line item content shared by every view (today/week/month/year):
  // bold title, italic dates sitting right next to it (not pushed to the
  // far right of the row).
  const renderTodoLine = (task: IMyTask) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8, fontSize: 12, minWidth: 0, width: '100%' }}>
      <span
        style={{
          fontWeight: 700,
          textDecoration: task.done ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: '0 1 auto',
          minWidth: 0,
        }}
      >
        {task.name}
      </span>
      <span style={{ fontStyle: 'italic', color: colors.lightGray, whiteSpace: 'nowrap', textDecoration: task.done ? 'line-through' : 'none', flexShrink: 0 }}>
        {t('home:todoList.created')}: {formatDate(task.created_at)}
        {task.done &&
          ` | ${t('home:todoList.finished')}: ${formatDate(task.updated_at || task.created_at)}`}
      </span>
    </div>
  );

  const groupTasksByMonth = useMemo(() => {
    if (!data?.body || viewFilter !== 'year') return [];

    const groups: Record<string, IMyTask[]> = {};

    data.body.forEach(task => {
      // Use updated_at for completed tasks, created_at for pending tasks
      const date = task.done ? dayjs(task.updated_at) : dayjs(task.created_at);
      const monthKey = date.format('YYYY-MM');

      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(task);
    });

    return Object.entries(groups)
      .map(([monthKey, tasks]) => ({
        monthKey,
        monthName: dayjs(monthKey).format('MMMM YYYY'),
        tasks
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [data?.body, viewFilter]);

  const columns: TableProps<IMyTask>['columns'] = [
    {
      key: 'completeBtn',
      width: 32,
      render: (record: IMyTask) => (
        <ConfigProvider wave={{ disabled: true }}>
          <Tooltip title={t('home:todoList.markAsDone')}>
            <Button
              type="text"
              className="borderless-icon-btn"
              style={{ backgroundColor: colors.transparent }}
              shape="circle"
              icon={
                record.done ? (
                  <CheckOutlined style={{ color: colors.skyBlue, fontSize: 20 }} />
                ) : (
                  <CheckCircleOutlined style={{ color: colors.lightGray, fontSize: 20 }} />
                )
              }
              onClick={() => handleCompleteTodo(record.id)}
            />
          </Tooltip>
        </ConfigProvider>
      ),
    },
    {
      key: 'name',
      render: (record: IMyTask) => renderTodoLine(record),
    },
  ];

  const renderYearView = () => {
    if (viewFilter !== 'year') return null;

    if (groupTasksByMonth.length === 0) {
      return (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <EmptyListPlaceholder
            imageSrc="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
            text={t('home:todoList.noTasks')}
          />
        </div>
      );
    }

    const currentMonthKey = dayjs().format('YYYY-MM');

    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Collapse
          defaultActiveKey={[currentMonthKey]}
          accordion
          ghost
          size="small"
          expandIcon={({ isActive }) => (isActive ? <DownOutlined /> : <RightOutlined />)}
          items={groupTasksByMonth.map(({ monthKey, monthName, tasks }) => ({
            key: monthKey,
            label: (
              <Flex style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Typography.Text strong>{monthName}</Typography.Text>
                <Typography.Text type="secondary">{tasks.length} {t('home:todoList.tasks')}</Typography.Text>
              </Flex>
            ),
            children: (
              <div style={{ padding: '0 0 8px 0' }}>
                {renderTasksWithWeekGrouping(tasks)}
              </div>
            ),
          }))}
        />
      </div>
    );
};
  
  const renderWeekView = () => {
    if (viewFilter !== 'week' || !data?.body) return null;

    const groups: Record<string, IMyTask[]> = {};

    data.body.forEach(task => {
      // Use updated_at for completed tasks, created_at for pending tasks
      const date = task.done ? dayjs(task.updated_at) : dayjs(task.created_at);
      const dayKey = date.format('YYYY-MM-DD');
      if (!groups[dayKey]) {
        groups[dayKey] = [];
      }
      groups[dayKey].push(task);
    });

    const todayStr = dayjs().format('YYYY-MM-DD');
    const days = Object.keys(groups);
    
    // Custom sort: today first, then future days ascending, then past days ascending (oldest first)
    const sortedDays = days.sort((a, b) => {
      const aToday = a === todayStr;
      const bToday = b === todayStr;
      
      if (aToday && !bToday) return -1;  // a is today, comes first
      if (!aToday && bToday) return 1;   // b is today, comes first
      
      const aDate = dayjs(a);
      const bDate = dayjs(b);
      const today = dayjs(todayStr);
      
      const aOffset = aDate.diff(today, 'day');
      const bOffset = bDate.diff(today, 'day');
      
      // Future days (positive offset)
      if (aOffset > 0 && bOffset > 0) return aOffset - bOffset;  // ascending: sooner future first
      
      // Past days (negative offset)
      if (aOffset < 0 && bOffset < 0) {
        // For past days, we want oldest first (more negative offset first)
        // So -3 (3 days ago) comes before -1 (1 day ago)
        return aOffset - bOffset;  // -3 - (-1) = -2 < 0, so a comes before b if a is older
      }
      
      // One is future, one is past: future comes before past
      if (aOffset > 0 && bOffset < 0) return -1;  // a is future, b is past -> a first
      if (aOffset < 0 && bOffset > 0) return 1;   // a is past, b is future -> b first
      
      // One is today (handled above) or both zero (shouldn't happen)
      return 0;
    });

    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sortedDays.length === 0 ? (
          <EmptyListPlaceholder
            imageSrc="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
            text={t('home:todoList.noTasks')}
          />
        ) : (
          sortedDays.map(dayKey => {
            const dayTasks = groups[dayKey];

            return (
              <div key={dayKey}>
                {dayTasks.map(task => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 0',
                    }}
                  >
                    <ConfigProvider wave={{ disabled: true }}>
                      <Tooltip title={t('home:todoList.markAsDone')}>
                        <Button
                          type="text"
                          className="borderless-icon-btn"
                          style={{ backgroundColor: colors.transparent, flexShrink: 0 }}
                          shape="circle"
                          icon={
                            task.done ? (
                              <CheckOutlined style={{ color: colors.skyBlue, fontSize: 20 }} />
                            ) : (
                              <CheckCircleOutlined style={{ color: colors.lightGray, fontSize: 20 }} />
                            )
                          }
                          onClick={() => handleCompleteTodo(task.id)}
                        />
                      </Tooltip>
                    </ConfigProvider>
                    <div style={{ flex: 1, minWidth: 0 }}>{renderTodoLine(task)}</div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    );
};
  
  const renderTasksWithWeekGrouping = (tasks: IMyTask[]) => {
    if (!tasks || tasks.length === 0) return null;

    // Group by ISO week
    const weekGroups: Record<string, IMyTask[]> = {};

    tasks.forEach(task => {
      // Use updated_at for completed tasks, created_at for pending tasks
      const date = task.done ? dayjs(task.updated_at) : dayjs(task.created_at);
      const isoYear = date.isoWeekYear();
      const isoWeek = date.isoWeek();
      const weekKey = `${isoYear}-W${isoWeek.toString().padStart(2, '0')}`;

      if (!weekGroups[weekKey]) {
        weekGroups[weekKey] = [];
      }
      weekGroups[weekKey].push(task);
    });

    // Sort weeks chronologically
    const sortedWeeks = Object.keys(weekGroups).sort((a, b) => {
      // Parse "YYYY-W##" to compare
      const [aYear, aWeek] = a.split('-W');
      const [bYear, bWeek] = b.split('-W');
      const aNum = parseInt(aYear) * 100 + parseInt(aWeek);
      const bNum = parseInt(bYear) * 100 + parseInt(bWeek);
      return aNum - bNum;
    });

    return (
      <>
        {sortedWeeks.map(weekKey => {
          const weekTasks = weekGroups[weekKey];
          // Get a date from the first task to calculate week range
          const sampleDate = dayjs(weekTasks[0].created_at);
          const startOfWeek = sampleDate.startOf('isoWeek').format('MMM D');
          const endOfWeek = sampleDate.endOf('isoWeek').format('MMM D');
          const weekNumber = sampleDate.isoWeek();

          return (
            <React.Fragment key={weekKey}>
              <div 
                style={{ 
                  borderTop: '1px solid rgba(0,0,0,0.1)', 
                  paddingTop: '8px', 
                  marginTop: '8px' 
                }}
              >
                <div style={{ fontSize: 11, color: colors.lightGray }}>
                  Week {weekNumber}: {startOfWeek} - {endOfWeek}
                </div>
              </div>
              {weekTasks.map(task => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0'
                  }}
                >
                  <ConfigProvider wave={{ disabled: true }}>
                    <Tooltip title={t('home:todoList.markAsDone')}>
                      <Button
                        type="text"
                        className="borderless-icon-btn"
                        style={{ backgroundColor: colors.transparent, flexShrink: 0 }}
                        shape="circle"
                        icon={
                          task.done ? (
                            <CheckOutlined style={{ color: colors.skyBlue, fontSize: 20 }} />
                          ) : (
                            <CheckCircleOutlined style={{ color: colors.lightGray, fontSize: 20 }} />
                          )
                        }
                        onClick={() => handleCompleteTodo(task.id)}
                      />
                    </Tooltip>
                  </ConfigProvider>
                  <div style={{ flex: 1, minWidth: 0 }}>{renderTodoLine(task)}</div>
                </div>
              ))}
            </React.Fragment>
          );
        })}
      </>
    );
  };
  
  const renderMonthView = () => {
    if (viewFilter !== 'month') return null;
    
    if (!data || !data.body) {
      return (
        <div style={{ textAlign: 'center', padding: '20px', color: colors.lightGray }}>
          {t('home:todoList.loading')}
        </div>
      );
    }
    
    if (data.body.length === 0) {
      return (
        <EmptyListPlaceholder
          imageSrc="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
          text={t('home:todoList.noTasks')}
        />
      );
    }
    
    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderTasksWithWeekGrouping(data.body)}
      </div>
    );
  };
  
  const renderListView = () => {
    if (viewFilter === 'year') return null;

    // Sort tasks by created_at descending (most recent first) for today view
    const sortedTasks = [...(data?.body || [])].sort((a, b) => 
      dayjs(b.created_at).diff(dayjs(a.created_at))
    );

    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sortedTasks.length === 0 ? (
          <EmptyListPlaceholder
            imageSrc="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
            text={t('home:todoList.noTasks')}
          />
        ) : (
          <Table
            rowKey={record => record.id || ''}
            dataSource={sortedTasks}
            columns={columns}
            showHeader={false}
            pagination={false}
            size="small"
            loading={isFetching}
          />
        )}
      </div>
    );
  };

  return (
    <div className="w-full" style={{ width: '100%', height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Page header — spans the full width, above both columns below.
          Matches the Home > Log Time page's title/subtitle styling. ── */}
      <div style={{ padding: '24px 24px 12px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {t('home:todoList.myTodoListTitle')}
        </h1>
        <p style={{ opacity: 0.5, fontSize: 13, margin: '4px 0 0' }}>
          {t('home:todoList.subtitle')}
        </p>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isDesktop ? 'row' : 'column' }}>
        {/* ── Left period-filter panel — mirrors the My Tasks "Views" rail; a
            horizontally-scrolling pill strip on narrow screens instead of a
            fixed-width vertical column. ── */}
        <div
          style={{
            width: isDesktop ? 160 : '100%',
            flexShrink: 0,
            borderRight: isDesktop ? `1px solid ${token.colorBorderSecondary}` : 'none',
            borderBottom: isDesktop ? 'none' : `1px solid ${token.colorBorderSecondary}`,
            padding: isDesktop ? '4px 0' : '4px 12px',
            display: 'flex',
            flexDirection: isDesktop ? 'column' : 'row',
            gap: isDesktop ? 0 : 6,
            overflowX: isDesktop ? 'visible' : 'auto',
          }}
        >
          {TODO_VIEW_FILTERS.map(filterKey => {
            const active = viewFilter === filterKey;
            return (
              <button
                key={filterKey}
                onClick={() => setViewFilter(filterKey)}
                style={{
                  display: 'block',
                  width: isDesktop ? '100%' : 'auto',
                  flexShrink: isDesktop ? undefined : 0,
                  whiteSpace: isDesktop ? undefined : 'nowrap',
                  padding: isDesktop ? '8px 16px' : '7px 12px',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: isDesktop ? 0 : 6,
                  fontSize: 13,
                  textAlign: 'left',
                  background: active ? token.colorPrimaryBg : 'transparent',
                  color: active ? token.colorPrimary : token.colorText,
                  fontWeight: active ? 600 : 400,
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = token.colorBgTextHover; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                {t(`home:todoList.${filterKey}`)}
              </button>
            );
          })}
        </div>

        {/* ── Todo list content ── */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, padding: isDesktop ? '4px 24px 16px' : '4px 12px 16px', display: 'flex', flexDirection: 'column' }}>
          <Flex vertical style={{ width: '100%', flex: 1, minHeight: 0 }} gap="small">
            <Form form={form} onFinish={handleTodoSubmit}>
              <Form.Item name="name">
                <Flex vertical>
                  <Input
                    ref={todoInputRef}
                    placeholder={t('home:todoList.addTask')}
                    style={{ width: isDesktop ? '25%' : '100%' }}
                    disabled={isCreatingPersonalTask}
                    onChange={e => {
                      const inputValue = e.currentTarget.value;

                      if (inputValue.length >= 1) setIsAlertShowing(true);
                      else if (inputValue === '') setIsAlertShowing(false);
                    }}
                  />
                  {isAlertShowing && (
                    <Alert
                      message={
                        <Typography.Text style={{ fontSize: 11 }}>
                          {t('home:todoList.pressEnter')} <strong>Enter</strong>{' '}
                          {t('home:todoList.toCreate')}
                        </Typography.Text>
                      }
                      type="info"
                      style={{
                        width: 'fit-content',
                        borderRadius: 2,
                        padding: '0 6px',
                      }}
                    />
                  )}
                </Flex>
              </Form.Item>
            </Form>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 10,
                background: token.colorBgContainer,
                overflow: 'hidden',
                padding: '8px 16px',
              }}
            >
              {viewFilter === 'year'
                 ? renderYearView()
                 : viewFilter === 'week'
                   ? renderWeekView()
                   : viewFilter === 'month'
                     ? renderMonthView()
                     : renderListView()}
            </div>
          </Flex>
        </div>
      </div>
    </div>
  );
};

export default TodoList;