import { useEffect, useRef } from 'react';
import debounce from 'lodash-es/debounce';
import { useSocket } from '@/socket/socketContext';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { SocketEvents } from '@/shared/socket-events';
import homePageApi from '@/api/home-page/home-page.api.service';
import { userActivityApiService } from '@/api/home-page/user-activity.api.service';

type HomePageTag = 'myTasks' | 'taskCounts' | 'calendarTasks' | 'personalTasks';
type UserActivityTag = 'UserRecentTasks' | 'UserTimeLoggedTasks';

// Home's dashboard (stat cards, My Tasks table, Calendar) is backed by RTK
// Query, but nothing invalidates its cache when a task is edited elsewhere in
// the same session — e.g. from a Project view's task list/board, or the Task
// Drawer, which only update their own project-scoped/task-management slices.
// Mounted once in MainLayout.tsx (not HomeLayout — it must keep listening
// even while the user isn't on a Home route), this hook re-invalidates the
// affected tags whenever one of these task-mutation events comes back over
// the shared socket, so Home stays fresh without needing a reload.
//
// activityTags cover the "Continue where you left off" Activity/Time Logged
// tabs and the stat cards' Focus Time split, which live in a separate
// userActivityApi cache (task_activity_logs / task_work_log backed) — those
// never had any invalidation wired up at all, home route or not.
const EVENT_TAGS: Array<{
  event: SocketEvents;
  homeTags?: HomePageTag[];
  activityTags?: UserActivityTag[];
}> = [
  { event: SocketEvents.TASK_STATUS_CHANGE, homeTags: ['myTasks', 'taskCounts', 'calendarTasks', 'personalTasks'], activityTags: ['UserRecentTasks'] },
  { event: SocketEvents.TASK_ASSIGNEES_CHANGE, homeTags: ['myTasks', 'taskCounts', 'calendarTasks', 'personalTasks'], activityTags: ['UserRecentTasks'] },
  { event: SocketEvents.QUICK_ASSIGNEES_UPDATE, homeTags: ['myTasks', 'taskCounts', 'calendarTasks', 'personalTasks'], activityTags: ['UserRecentTasks'] },
  { event: SocketEvents.TASK_END_DATE_CHANGE, homeTags: ['myTasks', 'taskCounts', 'calendarTasks', 'personalTasks'], activityTags: ['UserRecentTasks'] },
  { event: SocketEvents.TASK_DUE_TIME_CHANGE, homeTags: ['myTasks', 'taskCounts', 'calendarTasks', 'personalTasks'], activityTags: ['UserRecentTasks'] },
  { event: SocketEvents.TASK_PRIORITY_CHANGE, homeTags: ['myTasks', 'personalTasks'], activityTags: ['UserRecentTasks'] },
  { event: SocketEvents.TASK_NAME_CHANGE, homeTags: ['myTasks', 'calendarTasks', 'personalTasks'], activityTags: ['UserRecentTasks'] },
  { event: SocketEvents.QUICK_TASK, homeTags: ['myTasks', 'taskCounts', 'calendarTasks', 'personalTasks'], activityTags: ['UserRecentTasks'] },
  { event: SocketEvents.PERSONAL_TASK_CREATED, homeTags: ['personalTasks'] },
  { event: SocketEvents.PERSONAL_TASK_UPDATED, homeTags: ['personalTasks'] },
  // Manual work-log create/update/delete (task drawer's time log tab) — broadcast to all clients.
  { event: SocketEvents.TASK_TIME_LOG_UPDATED, activityTags: ['UserTimeLoggedTasks'] },
  // Timer stop persists a task_work_log row too; only echoed back to the
  // timer owner's own socket, which is exactly the user this data is scoped to.
  { event: SocketEvents.TASK_TIMER_STOP, activityTags: ['UserTimeLoggedTasks'] },
];

export const useHomeDashboardSocketSync = (): void => {
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();
  const pendingHomeTags = useRef<Set<HomePageTag>>(new Set());
  const pendingActivityTags = useRef<Set<UserActivityTag>>(new Set());
  const flush = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    if (!flush.current) {
      flush.current = debounce(() => {
        if (pendingHomeTags.current.size > 0) {
          dispatch(homePageApi.util.invalidateTags(Array.from(pendingHomeTags.current)));
          pendingHomeTags.current.clear();
        }
        if (pendingActivityTags.current.size > 0) {
          dispatch(userActivityApiService.util.invalidateTags(Array.from(pendingActivityTags.current)));
          pendingActivityTags.current.clear();
        }
      }, 300);
    }

    const handlers = EVENT_TAGS.map(({ event, homeTags, activityTags }) => {
      const handler = () => {
        homeTags?.forEach(tag => pendingHomeTags.current.add(tag));
        activityTags?.forEach(tag => pendingActivityTags.current.add(tag));
        flush.current?.();
      };
      return { event: event.toString(), handler };
    });

    handlers.forEach(({ event, handler }) => socket?.on(event, handler));

    return () => {
      handlers.forEach(({ event, handler }) => socket?.removeListener(event, handler));
      flush.current?.cancel();
      pendingHomeTags.current.clear();
      pendingActivityTags.current.clear();
    };
  }, [socket, connected, dispatch]);
};
