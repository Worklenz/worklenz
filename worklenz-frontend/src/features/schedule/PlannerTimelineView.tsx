import React, { useMemo, useState, useEffect, useRef } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(quarterOfYear);
dayjs.extend(isoWeek);

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, DatePicker, Flex, Space, theme, Tooltip } from '@/shared/antd-imports';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useScheduleSocketHandlers } from '@/hooks/useScheduleSocketHandlers';
import { useProjectRoomSync } from '@/hooks/useProjectRoomSync';
import { themeWiseColor } from '@/utils/themeWiseColor';
import PlannerMultiFilterDropdown from '@/features/schedule/PlannerMultiFilterDropdown';
import {
  useFetchProjectsTimelineQuery,
  useUpdateProjectTimelineDatesMutation,
  useFetchTaskTimelineQuery,
  useUpdateTaskDatesMutation,
  TaskTimelineItem,
} from '@/api/schedule/scheduleApi';
import { ProjectTimelineItem } from '@/types/schedule/schedule-v2.types';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { setProjectId } from '@/features/project/project.slice';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';

type TimelineZoom = 'days' | 'weeks' | 'months' | 'quarters' | 'years';

// `unit` drives the fine (bottom) ruler row; `topUnit` drives an optional coarse
// grouping row above it (e.g. "June 2026" spanning several day columns, or "2026"
// spanning several month columns) — null means no grouping row is needed because the
// fine row is already the coarsest thing worth showing (Years). Weeks ticks by day
// (like Days, just more zoomed out) grouped under "Week N" headers, rather than
// collapsing straight to month names — otherwise Weeks and Months looked identical.
const TIMELINE_ZOOM_CFG: Record<
  TimelineZoom,
  {
    label: string;
    unit: 'day' | 'month' | 'quarter' | 'year';
    topUnit: 'week' | 'month' | 'quarter' | 'year' | null;
    pxPerDay: number;
  }
> = {
  days: { label: 'Days', unit: 'day', topUnit: 'month', pxPerDay: 40 },
  // Same stacked "weekday abbreviation over day number" cell as Days zoom (see units'
  // subLabel below) — 20px was too narrow for that pair and let the text overflow into
  // neighboring day columns since the cells don't clip.
  weeks: { label: 'Weeks', unit: 'day', topUnit: 'week', pxPerDay: 34 },
  months: { label: 'Months', unit: 'month', topUnit: 'year', pxPerDay: 3 },
  // Ticks by month (like Months, just more zoomed out) grouped under "Q1 2026"-style
  // headers, rather than collapsing straight to quarter-numbered columns — otherwise
  // Quarters and Years looked identical (both a handful of coarse columns per year).
  quarters: { label: 'Quarters', unit: 'month', topUnit: 'quarter', pxPerDay: 1.5 },
  years: { label: 'Years', unit: 'year', topUnit: null, pxPerDay: 0.36 },
};
// Zoom in = more detail (toward Days), zoom out = less detail (toward Years) — same
// direction convention as the Gantt/Roadmap toolbar (GanttToolbar.tsx), and mirrors
// Scoro's Gantt "period" range (Days/Weeks/Months/Quarters/Years) end to end.
const ZOOM_ORDER: TimelineZoom[] = ['days', 'weeks', 'months', 'quarters', 'years'];

const LEFT_COL_WIDTH = 280;
const MAIN_ROW_HEIGHT = 48;
const TOP_HEADER_HEIGHT = 24;
const UNIT_HEADER_HEIGHT = 34;
const BAR_HEIGHT = 28;

// Above this many simultaneously-expanded projects, task fetching switches from one
// GET /tasks request per project (N parallel requests — better for a handful of expands
// since each project's tasks render progressively as they arrive) to a single batched
// GET /tasks?projectId=a,b,c... request covering all of them (one round-trip and one
// backend query-plan instead of N, at the cost of nothing rendering until the whole
// batch resolves). Individual row expand/collapse is always well under this and stays
// on the N path; this only matters for the header's "expand all" on a large portfolio.
// Note: crossing this boundary in either direction unmounts the previous fetcher(s) and
// mounts the other mode, so every expanded row flashes back to "loading" and re-fetches —
// acceptable since it only happens right at the 11/12 boundary, not on every toggle.
const BATCH_EXPAND_THRESHOLD = 12;

// TimelineProjectBarRow always has both dates — undated projects render as a
// TimelineProjectPlaceholderRow instead (see below) rather than being placed on the grid.
type DatedProjectTimelineItem = ProjectTimelineItem & { start_date: string; end_date: string };

// One of a project's task rows (only present once that project is expanded) — either a
// real task or a loading/empty placeholder for the expanded project's task fetch.
type TimelineTaskSubRow =
  | { kind: 'task'; task: TaskTimelineItem }
  | { kind: 'tasksStatus'; projectId: string; status: 'loading' | 'empty' };

// A project and its (possibly empty) task rows, grouped together — both panels render
// one wrapper div per group (see renderRows below) so the project's own row can be
// `position: sticky` *within that wrapper*: CSS only pushes a sticky element out of view
// once its own containing block's bottom edge reaches it, so each project's row needs its
// task rows nested inside the same wrapper for the "first expanded project stays stuck
// while its tasks scroll by, then the next expanded project's row takes over" behavior —
// plain sibling rows with position:sticky wouldn't stack like that.
interface TimelineProjectGroup {
  project: ProjectTimelineItem;
  taskRows: TimelineTaskSubRow[];
}

// The project column and the date grid are two entirely separate panels (not a
// position:sticky column inside the scrolling grid) — sticky columns whose scroll
// position is driven by mirroring another pane's scrollLeft in JS are prone to
// repaint/ghosting glitches in Chromium, which is exactly the "transparent column,
// scrolled date labels showing through" bug this replaces. Instead, the left panel
// never scrolls horizontally at all, and only mirrors the right panel's vertical
// scroll, which is a plain (non-sticky) scrollTop sync.
interface TimelineRowProps {
  project: ProjectTimelineItem;
  borderColor: string;
  cardBg: string;
  highlighted?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const TimelineProjectInfoRow: React.FC<TimelineRowProps> = ({
  project,
  borderColor,
  cardBg,
  highlighted,
  expanded,
  onToggleExpand,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation('schedule');
  const { token } = theme.useToken();

  const hasDates = !!project.start_date && !!project.end_date;
  const startDateStr = hasDates ? dayjs(project.start_date).format('YYYY-MM-DD') : null;
  const endDateStr = hasDates ? dayjs(project.end_date).format('YYYY-MM-DD') : null;

  const goToProject = () =>
    navigate({
      pathname: `/worklenz/projects/${project.id}`,
      search: new URLSearchParams({ tab: 'roadmap', pinned_tab: 'roadmap' }).toString(),
    });

  return (
    <div
      style={{
        height: MAIN_ROW_HEIGHT,
        minHeight: MAIN_ROW_HEIGHT,
        borderBottom: `1px solid ${borderColor}`,
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: highlighted ? token.colorPrimaryBg : cardBg,
        transition: 'background .3s',
      }}
    >
      {/* Only this cell (icon + name + dates) navigates to the project — the grid/bar
          area in the other panel is not clickable, so scrolling the timeline never
          accidentally navigates away. */}
      <div
        onClick={goToProject}
        title={project.name}
        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer', flex: 1 }}
        onMouseEnter={e => {
          const nameEl = e.currentTarget.querySelector('[data-project-name]') as HTMLDivElement | null;
          if (nameEl) nameEl.style.color = token.colorPrimary;
        }}
        onMouseLeave={e => {
          const nameEl = e.currentTarget.querySelector('[data-project-name]') as HTMLDivElement | null;
          if (nameEl) nameEl.style.color = '';
        }}
      >
        <Badge color={project.color_code || token.colorPrimary} />
        <div style={{ minWidth: 0 }}>
          <div
            data-project-name
            style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {project.name}
          </div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
            {hasDates ? `${startDateStr} - ${endDateStr}` : t('noDatesSet', { defaultValue: 'No dates set' })}
          </div>
        </div>
      </div>

      {/* Expand/collapse toggle for this project's tasks — a separate click zone from
          the name cell above, so expanding never also navigates away. Right-aligned at
          the end of the row rather than leading it. */}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onToggleExpand?.();
        }}
        title={expanded ? t('collapse', { defaultValue: 'Collapse' }) : t('expand', { defaultValue: 'Expand' })}
        style={{
          background: 'none',
          border: 'none',
          padding: 4,
          margin: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: token.colorTextSecondary,
          flexShrink: 0,
        }}
      >
        {expanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
      </button>
    </div>
  );
};

interface TimelineBarRowProps {
  project: DatedProjectTimelineItem;
  rangeStart: Dayjs;
  pxPerDay: number;
  totalWidth: number;
  borderColor: string;
  cardBg: string;
  onDatesChange: (projectId: string, startDate: string, endDate: string) => void;
  highlighted?: boolean;
}

// Same tooltip surface treatment as PlannerScheduleView's renderTaskTooltipTitle: a
// solid white card with a drop shadow in light mode (antd's default tooltip is a dark
// chip regardless of app theme, which read as a jarring, mismatched box against the
// rest of Planner's light-mode chrome), left to antd's own dark styling in dark mode.
const tooltipProps = (themeMode: string, token: any) => ({
  color: themeMode === 'dark' ? undefined : '#fff',
  styles: {
    body: themeMode === 'dark' ? undefined : { color: token.colorText, boxShadow: '0 2px 8px rgba(0,0,0,.15)' },
  },
});

// Drag handle at a bar edge — mousedown starts a resize that only moves that one edge's
// date; stopPropagation keeps it from also triggering the grid's click-and-hold pan.
const EDGE_HANDLE_WIDTH = 8;

const TimelineProjectBarRow: React.FC<TimelineBarRowProps> = ({
  project,
  rangeStart,
  pxPerDay,
  totalWidth,
  borderColor,
  cardBg,
  onDatesChange,
  highlighted,
}) => {
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { t } = useTranslation('schedule');

  // 'start'/'end' drag an edge handle, resizing just that date; 'move' drags the bar
  // body itself, shifting both dates together by the same delta (duration unchanged).
  const [dragMode, setDragMode] = useState<'start' | 'end' | 'move' | null>(null);
  const [previewStart, setPreviewStart] = useState<Dayjs | null>(null);
  const [previewEnd, setPreviewEnd] = useState<Dayjs | null>(null);
  // Mirrors previewStart/End (plus the drag's starting mouse X) but read inside the
  // mouseup handler, which otherwise closes over the stale values from whenever the drag
  // started (the effect only re-subscribes when dragMode changes, not on every mousemove).
  const liveRef = useRef<{ start: Dayjs; end: Dayjs; startX: number } | null>(null);

  const effectiveStart = previewStart ?? dayjs(project.start_date);
  const effectiveEnd = previewEnd ?? dayjs(project.end_date);

  const xForDate = (date: string | Dayjs) => dayjs(date).diff(rangeStart, 'day') * pxPerDay;

  const startDateStr = dayjs(project.start_date).format('YYYY-MM-DD');
  const endDateStr = dayjs(project.end_date).format('YYYY-MM-DD');

  const barLeft = xForDate(effectiveStart);
  const barWidth = Math.max(4, xForDate(effectiveEnd) - barLeft + pxPerDay);

  const isOverdue = dayjs().format('YYYY-MM-DD') > endDateStr && project.done_progress < 100;

  useEffect(() => {
    if (!dragMode) return;
    const onMove = (e: MouseEvent) => {
      if (!liveRef.current) return;
      const deltaDays = Math.round((e.clientX - liveRef.current.startX) / pxPerDay);
      if (dragMode === 'start') {
        let next = dayjs(project.start_date).add(deltaDays, 'day');
        const maxStart = dayjs(project.end_date).subtract(1, 'day');
        if (next.isAfter(maxStart)) next = maxStart;
        liveRef.current = { ...liveRef.current, start: next };
        setPreviewStart(next);
      } else if (dragMode === 'end') {
        let next = dayjs(project.end_date).add(deltaDays, 'day');
        const minEnd = dayjs(project.start_date).add(1, 'day');
        if (next.isBefore(minEnd)) next = minEnd;
        liveRef.current = { ...liveRef.current, end: next };
        setPreviewEnd(next);
      } else {
        // 'move' — both dates shift by the same delta, so the duration never changes.
        const nextStart = dayjs(project.start_date).add(deltaDays, 'day');
        const nextEnd = dayjs(project.end_date).add(deltaDays, 'day');
        liveRef.current = { ...liveRef.current, start: nextStart, end: nextEnd };
        setPreviewStart(nextStart);
        setPreviewEnd(nextEnd);
      }
    };
    const onUp = () => {
      setDragMode(null);
      const final = liveRef.current;
      liveRef.current = null;
      setPreviewStart(null);
      setPreviewEnd(null);
      if (!final) return;
      const newStart = final.start.format('YYYY-MM-DD');
      const newEnd = final.end.format('YYYY-MM-DD');
      if (newStart !== startDateStr || newEnd !== endDateStr) {
        onDatesChange(project.id, newStart, newEnd);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragMode]);

  const startEdgeDrag = (edge: 'start' | 'end') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    liveRef.current = { start: dayjs(project.start_date), end: dayjs(project.end_date), startX: e.clientX };
    setDragMode(edge);
  };

  // Clicking the bar body (as opposed to an edge handle) drags the whole bar left/right
  // instead of resizing — stopPropagation keeps it from also triggering the grid's
  // click-and-hold pan (which still fires normally for clicks on empty grid background,
  // since that's a separate mousedown handler on the scroll container, not this bar).
  const startBarMove = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    liveRef.current = { start: dayjs(project.start_date), end: dayjs(project.end_date), startX: e.clientX };
    setDragMode('move');
  };

  // Overdue (deadline passed and not fully done) swaps the base hue to the theme's
  // error/red; otherwise it stays primary/blue. All three segments share that one base
  // color and are told apart by opacity alone (todo faintest, done full) — using the
  // theme's own light-tint tokens (colorPrimaryBg/colorPrimaryBorder) for this looked
  // fine in light mode but the doing/todo tokens were too close to each other in dark
  // mode, making them read as a single block instead of two. Opacity blends against
  // whatever's behind the bar, so the three stay visually distinct in either theme.
  const baseColor = isOverdue ? token.colorError : token.colorPrimary;
  const opacity = { done: 1, doing: 0.55, todo: 0.25 };

  // One line per status (count + its share of the total in brackets), matching the
  // label/value layout of Schedule's own task tooltip (opacity-dimmed label, plain value).
  const projectTooltip = (
    <div style={{ minWidth: 170 }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{project.name}</div>
      {isOverdue && (
        <div style={{ fontSize: 12, fontWeight: 700, color: token.colorError, marginBottom: 6 }}>
          ⚠ {t('overdue', { defaultValue: 'Overdue' })}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
        <div>
          <span style={{ opacity: 0.65 }}>{t('dates', { defaultValue: 'Dates' })}: </span>
          {startDateStr} - {endDateStr}
        </div>
        <div>
          <span style={{ opacity: 0.65 }}>{t('status', { defaultValue: 'Status' })}: </span>
          {project.status_name ? (
            <span
              style={{
                display: 'inline-block',
                padding: '0 6px',
                borderRadius: 3,
                background: project.status_color || '#888',
                color: '#fff',
                fontSize: 12,
              }}
            >
              {project.status_name}
            </span>
          ) : (
            '-'
          )}
        </div>
        <div>
          <span style={{ opacity: 0.65 }}>{t('done', { defaultValue: 'Done' })}: </span>
          {project.done_count} ({project.done_progress}%)
        </div>
        <div>
          <span style={{ opacity: 0.65 }}>{t('doing', { defaultValue: 'Doing' })}: </span>
          {project.doing_count} ({project.doing_progress}%)
        </div>
        <div>
          <span style={{ opacity: 0.65 }}>{t('todo', { defaultValue: 'Todo' })}: </span>
          {project.todo_count} ({project.todo_progress}%)
        </div>
        <div>
          <span style={{ opacity: 0.65 }}>{t('totalTasks', { defaultValue: 'Total tasks' })}: </span>
          {project.total_tasks}
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        height: MAIN_ROW_HEIGHT,
        minHeight: MAIN_ROW_HEIGHT,
        width: totalWidth,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${borderColor}`,
        // Opaque (not the `undefined`/transparent it was before position:sticky was
        // introduced) — a sticky row needs its own background so task bars scrolling
        // underneath it don't visibly bleed through.
        background: highlighted ? token.colorPrimaryBg : cardBg,
        transition: 'background .3s',
      }}
    >
        <Tooltip
          title={projectTooltip}
          open={dragMode ? false : highlighted ? true : undefined}
          {...tooltipProps(themeMode, token)}
        >
          <div
            onMouseDown={startBarMove}
            style={{
              position: 'absolute',
              left: barLeft,
              width: barWidth,
              height: BAR_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              cursor: dragMode === 'move' ? 'grabbing' : 'grab',
            }}
          >
            <div
              style={{
                flex: 1,
                height: '100%',
                borderRadius: 2,
                overflow: 'hidden',
                display: 'flex',
                boxShadow: `0 0 0 1px ${token.colorBorderSecondary}`,
              }}
            >
              {project.total_tasks > 0 ? (
                <>
                  <div style={{ width: `${project.done_progress}%`, background: baseColor, opacity: opacity.done }} />
                  <div style={{ width: `${project.doing_progress}%`, background: baseColor, opacity: opacity.doing }} />
                  <div style={{ width: `${project.todo_progress}%`, background: baseColor, opacity: opacity.todo }} />
                </>
              ) : (
                // No tasks yet -> nothing to fill by status, so the bar would otherwise
                // render empty. Fill it fully in the "todo" tone instead, same as a project
                // that's 100% not-started.
                <div style={{ width: '100%', background: baseColor, opacity: opacity.todo }} />
              )}
            </div>
            {/* Invisible drag handles at each edge, layered on top of the bar-move handler
                above — resizing either one only moves that edge's date; the other date and
                the segmented fill stay put. */}
            <div
              onMouseDown={startEdgeDrag('start')}
              style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: EDGE_HANDLE_WIDTH, cursor: 'ew-resize', zIndex: 1 }}
            />
            <div
              onMouseDown={startEdgeDrag('end')}
              style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: EDGE_HANDLE_WIDTH, cursor: 'ew-resize', zIndex: 1 }}
            />
          </div>
        </Tooltip>

        {/* Live date readout while dragging an edge handle or the bar itself — sits
            outside the Tooltip (which only supports a single child) but still tracks the
            bar's position. Same light/dark surface treatment as the project/task
            tooltips: solid white + shadow in light mode, antd's own dark tooltip
            background in dark mode. Moving the whole bar shows both dates (since both
            shift together); resizing an edge shows just that edge's date. */}
        {dragMode && (
          <div
            style={{
              position: 'absolute',
              left: dragMode === 'start' ? barLeft : dragMode === 'end' ? barLeft + barWidth : barLeft + barWidth / 2,
              top: -24,
              transform: 'translateX(-50%)',
              background: themeMode === 'dark' ? token.colorBgSpotlight : '#fff',
              color: themeMode === 'dark' ? (token.colorTextLightSolid ?? '#fff') : token.colorText,
              boxShadow: themeMode === 'dark' ? undefined : '0 2px 8px rgba(0,0,0,.15)',
              fontSize: 12,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            {dragMode === 'move'
              ? `${effectiveStart.format('MMM D')} – ${effectiveEnd.format('MMM D, YYYY')}`
              : (dragMode === 'start' ? effectiveStart : effectiveEnd).format('MMM D, YYYY')}
        </div>
      )}
    </div>
  );
};

interface TimelinePlaceholderRowProps {
  project: ProjectTimelineItem;
  rangeStart: Dayjs;
  pxPerDay: number;
  totalWidth: number;
  borderColor: string;
  cardBg: string;
  onDatesChange: (projectId: string, startDate: string, endDate: string) => void;
  onHoverRangeChange: (range: { start: Dayjs; end: Dayjs } | null) => void;
}

// Undated projects have no bar to show, so their row instead previews a default
// two-month placement that follows the mouse as it moves left/right (and highlights the
// matching columns in the date header above, via onHoverRangeChange) — clicking commits
// it as the project's start/end dates through the same save path as dragging a real
// bar's edges (TimelineProjectBarRow's onDatesChange).
const TimelineProjectPlaceholderRow: React.FC<TimelinePlaceholderRowProps> = ({
  project,
  rangeStart,
  pxPerDay,
  totalWidth,
  borderColor,
  cardBg,
  onDatesChange,
  onHoverRangeChange,
}) => {
  const { token } = theme.useToken();
  const [hoverStart, setHoverStart] = useState<Dayjs | null>(null);

  const xForDate = (date: Dayjs) => date.diff(rangeStart, 'day') * pxPerDay;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const start = rangeStart.add(Math.round((e.clientX - rect.left) / pxPerDay), 'day');
    setHoverStart(start);
    onHoverRangeChange({ start, end: start.add(2, 'month').subtract(1, 'day') });
  };

  const handleMouseLeave = () => {
    setHoverStart(null);
    onHoverRangeChange(null);
  };

  const handleClick = () => {
    if (!hoverStart) return;
    const end = hoverStart.add(2, 'month').subtract(1, 'day');
    onDatesChange(project.id, hoverStart.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
  };

  const previewEnd = hoverStart ? hoverStart.add(2, 'month').subtract(1, 'day') : null;
  const previewLeft = hoverStart ? xForDate(hoverStart) : 0;
  const previewWidth = hoverStart && previewEnd ? xForDate(previewEnd) - previewLeft + pxPerDay : 0;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        height: MAIN_ROW_HEIGHT,
        minHeight: MAIN_ROW_HEIGHT,
        width: totalWidth,
        position: 'relative',
        borderBottom: `1px solid ${borderColor}`,
        cursor: 'pointer',
        // Opaque background for the same reason as TimelineProjectBarRow above — this
        // row can now be inside a position:sticky wrapper.
        background: hoverStart ? token.colorFillQuaternary : cardBg,
      }}
    >
      {hoverStart && previewEnd && (
        <div
          style={{
            position: 'absolute',
            left: previewLeft,
            width: previewWidth,
            top: '50%',
            transform: 'translateY(-50%)',
            height: BAR_HEIGHT,
            borderRadius: 2,
            border: `1.5px dashed ${token.colorPrimary}`,
            background: token.colorPrimaryBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: token.colorPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {hoverStart.format('D MMM')} – {previewEnd.format('D MMM')}
        </div>
      )}
    </div>
  );
};

// Non-visual data-fetcher — one instance per expanded project, mounted/unmounted as
// the project expands/collapses so RTK Query's own subscription lifecycle (and
// keepUnusedDataFor) handles fetching and dropping the cache for us, rather than the
// parent trying to call a variable number of query hooks itself (which the rules of
// hooks don't allow). Reports back up via onTasksChange instead of rendering anything,
// so the parent stays the single source of truth for the row list both panels share.
interface TimelineExpandedProjectTasksProps {
  projectId: string;
  startDate?: string;
  endDate?: string;
  onTasksChange: (projectId: string, tasks: TaskTimelineItem[] | undefined) => void;
}

const TimelineExpandedProjectTasks: React.FC<TimelineExpandedProjectTasksProps> = ({
  projectId,
  startDate,
  endDate,
  onTasksChange,
}) => {
  const { data, isLoading } = useFetchTaskTimelineQuery({ projectId, startDate, endDate });

  useEffect(() => {
    onTasksChange(projectId, isLoading ? undefined : (data?.body ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isLoading, data]);

  // Clears this project's entry (back to "loading") when it collapses or this view
  // unmounts, rather than leaving stale task data behind for next time it expands.
  useEffect(() => {
    return () => onTasksChange(projectId, undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return null;
};

interface TimelineExpandedProjectsBatchTasksProps {
  projectIds: string[];
  startDate?: string;
  endDate?: string;
  onTasksChange: (projectId: string, tasks: TaskTimelineItem[] | undefined) => void;
}

// Used instead of BATCH_EXPAND_THRESHOLD-or-more individual TimelineExpandedProjectTasks
// instances (see the parent's useBatchFetch) — one GET /tasks?projectId=a,b,c... call
// covering every expanded project instead of one call each, then splits the flat
// response back out per project by its project_id before reporting up. Same
// onTasksChange contract as the single-project fetcher, so the rest of the row/rendering
// logic doesn't need to know which mode is active.
const TimelineExpandedProjectsBatchTasks: React.FC<TimelineExpandedProjectsBatchTasksProps> = ({
  projectIds,
  startDate,
  endDate,
  onTasksChange,
}) => {
  // Joined once per render for the query key; effects below key off this string (stable
  // across re-renders as long as the actual id set doesn't change) rather than the
  // `projectIds` array reference, which is a new array every render.
  const projectIdParam = projectIds.join(',');
  const { data, isLoading } = useFetchTaskTimelineQuery({ projectId: projectIdParam, startDate, endDate });

  useEffect(() => {
    if (isLoading) return;
    const tasks = data?.body ?? [];
    const byProject = new Map<string, TaskTimelineItem[]>();
    for (const id of projectIdParam.split(',')) byProject.set(id, []);
    for (const task of tasks) {
      byProject.get(task.project_id)?.push(task);
    }
    byProject.forEach((projectTasks, projectId) => onTasksChange(projectId, projectTasks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdParam, isLoading, data]);

  // Resets every project in this batch back to "loading" once the batch itself unmounts
  // (everything collapsed, or the expanded count dropped back under the threshold and
  // the parent switched back to per-project fetching).
  useEffect(() => {
    const ids = projectIdParam.split(',');
    return () => {
      ids.forEach(id => onTasksChange(id, undefined));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdParam]);

  return null;
};

interface TimelineTaskInfoRowProps {
  task: TaskTimelineItem;
  borderColor: string;
  onClick: () => void;
}

// Indented one level under its parent project's TimelineProjectInfoRow above it — same
// row height so it lines up with TimelineTaskBarRow in the date-grid panel. Clicking
// opens the shared TaskDrawer (same drawer used by the Schedule/Workload Planner tabs
// and everywhere else in the app) rather than building a bespoke status/edit UI here.
const TimelineTaskInfoRow: React.FC<TimelineTaskInfoRowProps> = ({ task, borderColor, onClick }) => {
  const { token } = theme.useToken();

  return (
    <div
      onClick={onClick}
      title={task.name}
      style={{
        height: MAIN_ROW_HEIGHT,
        minHeight: MAIN_ROW_HEIGHT,
        borderBottom: `1px solid ${borderColor}`,
        padding: '8px 12px 8px 36px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
      }}
    >
      <Badge color={task.status_color || token.colorPrimary} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textDecoration: task.is_done_status ? 'line-through' : undefined,
          opacity: task.is_done_status ? 0.6 : 1,
        }}
      >
        {task.name}
      </div>
      {task.subtask_count > 0 && (
        <span style={{ fontSize: 11, opacity: 0.5, flexShrink: 0 }}>
          {task.completed_subtask_count}/{task.subtask_count}
        </span>
      )}
    </div>
  );
};

interface TimelineTaskStatusRowProps {
  borderColor: string;
  status: 'loading' | 'empty';
}

// Placeholder row shown in the left panel while an expanded project's tasks are
// loading, or once loaded if there are none in the current date range — paired with
// TimelineTaskStatusBarRow below for the matching spacer in the right panel.
const TimelineTaskStatusRow: React.FC<TimelineTaskStatusRowProps> = ({ borderColor, status }) => {
  const { t } = useTranslation('schedule');
  return (
    <div
      style={{
        height: MAIN_ROW_HEIGHT,
        minHeight: MAIN_ROW_HEIGHT,
        borderBottom: `1px solid ${borderColor}`,
        padding: '8px 12px 8px 36px',
        display: 'flex',
        alignItems: 'center',
        fontSize: 12,
        opacity: 0.45,
      }}
    >
      {status === 'loading'
        ? t('loadingTasks', { defaultValue: 'Loading tasks…' })
        : t('noTasksInRange', { defaultValue: 'No tasks in this range' })}
    </div>
  );
};

const TimelineTaskStatusBarRow: React.FC<{ borderColor: string; totalWidth: number }> = ({
  borderColor,
  totalWidth,
}) => (
  <div
    style={{
      height: MAIN_ROW_HEIGHT,
      minHeight: MAIN_ROW_HEIGHT,
      width: totalWidth,
      borderBottom: `1px solid ${borderColor}`,
    }}
  />
);

interface TimelineTaskBarRowProps {
  task: TaskTimelineItem;
  rangeStart: Dayjs;
  pxPerDay: number;
  totalWidth: number;
  borderColor: string;
  onDatesChange: (taskId: string, startDate: string, endDate: string) => void;
}

const TASK_BAR_HEIGHT = 18;

// Drag-to-reschedule for a single task's bar — adapted from TimelineProjectBarRow's own
// dragMode/liveRef/mousemove/mouseup implementation just above (same rangeStart/pxPerDay
// coordinate space, same YYYY-MM-DD commit convention) rather than the heavier per-project
// Gantt's drag logic, which carries dependency-line/swimlane concerns this row doesn't need.
const TimelineTaskBarRow: React.FC<TimelineTaskBarRowProps> = ({
  task,
  rangeStart,
  pxPerDay,
  totalWidth,
  borderColor,
  onDatesChange,
}) => {
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { t } = useTranslation('schedule');

  const hasDates = !!task.start_date && !!task.end_date;

  const [dragMode, setDragMode] = useState<'start' | 'end' | 'move' | null>(null);
  const [previewStart, setPreviewStart] = useState<Dayjs | null>(null);
  const [previewEnd, setPreviewEnd] = useState<Dayjs | null>(null);
  const liveRef = useRef<{ start: Dayjs; end: Dayjs; startX: number } | null>(null);

  const effectiveStart = previewStart ?? (hasDates ? dayjs(task.start_date as string) : null);
  const effectiveEnd = previewEnd ?? (hasDates ? dayjs(task.end_date as string) : null);

  const xForDate = (date: string | Dayjs) => dayjs(date).diff(rangeStart, 'day') * pxPerDay;

  const startDateStr = hasDates ? dayjs(task.start_date as string).format('YYYY-MM-DD') : null;
  const endDateStr = hasDates ? dayjs(task.end_date as string).format('YYYY-MM-DD') : null;

  useEffect(() => {
    if (!dragMode || !hasDates) return;
    const onMove = (e: MouseEvent) => {
      if (!liveRef.current) return;
      const deltaDays = Math.round((e.clientX - liveRef.current.startX) / pxPerDay);
      if (dragMode === 'start') {
        let next = dayjs(task.start_date as string).add(deltaDays, 'day');
        const maxStart = dayjs(task.end_date as string).subtract(1, 'day');
        if (next.isAfter(maxStart)) next = maxStart;
        liveRef.current = { ...liveRef.current, start: next };
        setPreviewStart(next);
      } else if (dragMode === 'end') {
        let next = dayjs(task.end_date as string).add(deltaDays, 'day');
        const minEnd = dayjs(task.start_date as string).add(1, 'day');
        if (next.isBefore(minEnd)) next = minEnd;
        liveRef.current = { ...liveRef.current, end: next };
        setPreviewEnd(next);
      } else {
        const nextStart = dayjs(task.start_date as string).add(deltaDays, 'day');
        const nextEnd = dayjs(task.end_date as string).add(deltaDays, 'day');
        liveRef.current = { ...liveRef.current, start: nextStart, end: nextEnd };
        setPreviewStart(nextStart);
        setPreviewEnd(nextEnd);
      }
    };
    const onUp = () => {
      setDragMode(null);
      const final = liveRef.current;
      liveRef.current = null;
      setPreviewStart(null);
      setPreviewEnd(null);
      if (!final) return;
      const newStart = final.start.format('YYYY-MM-DD');
      const newEnd = final.end.format('YYYY-MM-DD');
      if (newStart !== startDateStr || newEnd !== endDateStr) {
        onDatesChange(task.id, newStart, newEnd);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragMode, hasDates]);

  const startEdgeDrag = (edge: 'start' | 'end') => (e: React.MouseEvent) => {
    if (!hasDates) return;
    e.stopPropagation();
    e.preventDefault();
    liveRef.current = { start: dayjs(task.start_date as string), end: dayjs(task.end_date as string), startX: e.clientX };
    setDragMode(edge);
  };

  const startBarMove = (e: React.MouseEvent) => {
    if (!hasDates) return;
    e.stopPropagation();
    e.preventDefault();
    liveRef.current = { start: dayjs(task.start_date as string), end: dayjs(task.end_date as string), startX: e.clientX };
    setDragMode('move');
  };

  return (
    <div
      style={{
        height: MAIN_ROW_HEIGHT,
        minHeight: MAIN_ROW_HEIGHT,
        width: totalWidth,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      {hasDates && effectiveStart && effectiveEnd ? (
        <Tooltip
          title={
            <div style={{ minWidth: 170 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{task.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                <div>
                  <span style={{ opacity: 0.65 }}>{t('dates', { defaultValue: 'Dates' })}: </span>
                  {startDateStr} - {endDateStr}
                </div>
                <div>
                  <span style={{ opacity: 0.65 }}>{t('status', { defaultValue: 'Status' })}: </span>
                  {task.status_name || '-'}
                </div>
              </div>
            </div>
          }
          open={dragMode ? false : undefined}
          {...tooltipProps(themeMode, token)}
        >
          <div
            onMouseDown={startBarMove}
            style={{
              position: 'absolute',
              left: xForDate(effectiveStart),
              width: Math.max(4, xForDate(effectiveEnd) - xForDate(effectiveStart) + pxPerDay),
              height: TASK_BAR_HEIGHT,
              borderRadius: 2,
              background: task.status_color || token.colorPrimary,
              opacity: task.is_done_status ? 0.55 : 1,
              boxShadow: `0 0 0 1px ${token.colorBorderSecondary}`,
              cursor: dragMode === 'move' ? 'grabbing' : 'grab',
            }}
          >
            <div
              onMouseDown={startEdgeDrag('start')}
              style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: EDGE_HANDLE_WIDTH, cursor: 'ew-resize', zIndex: 1 }}
            />
            <div
              onMouseDown={startEdgeDrag('end')}
              style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: EDGE_HANDLE_WIDTH, cursor: 'ew-resize', zIndex: 1 }}
            />
          </div>
        </Tooltip>
      ) : (
        <span style={{ paddingLeft: 12, fontSize: 12, opacity: 0.4 }}>
          {t('noDatesSet', { defaultValue: 'No dates set' })}
        </span>
      )}
    </div>
  );
};

const PlannerTimelineView: React.FC = () => {
  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();

  // Live sync: date/status changes made here (or in any other project view) refresh
  // this view's data via RTK Query cache invalidation — see useScheduleSocketHandlers
  // for exactly which socket events it listens for.
  useScheduleSocketHandlers();

  const [zoom, setZoom] = useState<TimelineZoom>('months');
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterClients, setFilterClients] = useState<string[]>([]);
  // Portfolio-wide date range filter — narrows both which projects are shown and, once
  // applied, becomes the visible grid range itself (see rangeStart/rangeEnd below)
  // instead of the range being auto-derived from the filtered projects' own dates.
  const [dateFilter, setDateFilter] = useState<[Dayjs, Dayjs] | null>(null);
  const anyFilterActive =
    filterProjects.length > 0 ||
    filterStatuses.length > 0 ||
    filterPriorities.length > 0 ||
    filterCategories.length > 0 ||
    filterClients.length > 0 ||
    !!dateFilter;
  const clearAllFilters = () => {
    setFilterProjects([]);
    setFilterStatuses([]);
    setFilterPriorities([]);
    setFilterCategories([]);
    setFilterClients([]);
    setDateFilter(null);
  };

  // Which projects are expanded to show their tasks in place, and the tasks fetched for
  // each — populated by the (non-visual) TimelineExpandedProjectTasks instances rendered
  // below, one per expanded project id, rather than this component calling a variable
  // number of query hooks itself. undefined = still loading; [] = loaded, no tasks in range.
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const expandedProjectIdsArray = Array.from(expandedProjectIds);
  const [tasksByProjectId, setTasksByProjectId] = useState<Record<string, TaskTimelineItem[] | undefined>>({});
  const toggleExpandProject = (projectId: string) => {
    setExpandedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };
  const handleExpandedTasksChange = (projectId: string, tasks: TaskTimelineItem[] | undefined) => {
    setTasksByProjectId(prev => (prev[projectId] === tasks ? prev : { ...prev, [projectId]: tasks }));
  };

  const openTaskDrawer = (task: TaskTimelineItem) => {
    dispatch(setProjectId(task.project_id));
    dispatch(setSelectedTaskId(task.id));
    dispatch(setShowTaskDrawer(true));
  };

  const [updateTaskDates] = useUpdateTaskDatesMutation();
  const handleTaskDatesChange = (taskId: string, startDate: string, endDate: string) => {
    updateTaskDates({ taskId, start_date: startDate, end_date: endDate });
  };

  // Joins/leaves each expanded project's socket room (same JOIN_OR_LEAVE_PROJECT_ROOM
  // pattern used by the single-project view — see project-view.tsx) so the date/status
  // change broadcasts useScheduleSocketHandlers listens for actually reach this client.
  // Shared with PlannerScheduleView/PlannerWorkloadView via useProjectRoomSync, which
  // handles the join/leave diffing and reconnect re-join/unmount cleanup.
  useProjectRoomSync(expandedProjectIds);

  // Set by TimelineProjectPlaceholderRow while the mouse hovers an undated project's
  // row, so the date header above can highlight the same two-month window.
  const [hoverPreviewRange, setHoverPreviewRange] = useState<{ start: Dayjs; end: Dayjs } | null>(null);
  // Set right after a placeholder row commits its dates, to briefly highlight the row as
  // confirmation the edit landed (row order itself is frozen — see orderRef/orderedProjects
  // below — so the row doesn't move and doesn't need to be scrolled back into view).
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null);
  const focusClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracked project IDs in the order they were first seen this mount — see orderedProjects below.
  const orderRef = useRef<string[]>([]);

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const leftBodyScrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  const [updateProjectDates] = useUpdateProjectTimelineDatesMutation();
  const handleProjectDatesChange = (projectId: string, startDate: string, endDate: string) => {
    updateProjectDates({ projectId, start_date: startDate, end_date: endDate });
  };
  const handlePlaceholderDatesCommit = (projectId: string, startDate: string, endDate: string) => {
    handleProjectDatesChange(projectId, startDate, endDate);
    setFocusProjectId(projectId);
  };

  // Click-and-hold-drag anywhere on the grid background pans it horizontally, following
  // the mouse — the bar edge-resize handles stopPropagation so they take priority over
  // this instead of also triggering a pan.
  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const handleGridMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !bodyScrollRef.current) return;
    panStateRef.current = { startX: e.clientX, startScrollLeft: bodyScrollRef.current.scrollLeft };
    setIsPanning(true);
  };
  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const state = panStateRef.current;
      const el = bodyScrollRef.current;
      if (!state || !el) return;
      el.scrollLeft = state.startScrollLeft - (e.clientX - state.startX);
    };
    const onUp = () => {
      setIsPanning(false);
      panStateRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning]);

  // Measure the available grid width so short date ranges stretch to fill the screen
  // instead of leaving a blank gap on the right (same technique as PlannerScheduleView's
  // gridWidth/colWidth stretch — see PlannerScheduleView.tsx's ResizeObserver). This
  // wraps only the right (date-grid) panel now, so gridWidth is already the space
  // available for date columns — no need to subtract the project column's width.
  useEffect(() => {
    const el = gridWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) setGridWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cfg = TIMELINE_ZOOM_CFG[zoom];
  const today = dayjs();

  const { data: projectsResponse, isLoading } = useFetchProjectsTimelineQuery();
  const allProjects = projectsResponse?.body || [];

  const statusOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allProjects.forEach(p => {
      if (p.status_id && p.status_name) seen.set(p.status_id, p.status_name);
    });
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [allProjects]);

  const priorityOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allProjects.forEach(p => {
      if (p.priority_id && p.priority_name) seen.set(p.priority_id, p.priority_name);
    });
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [allProjects]);

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allProjects.forEach(p => {
      if (p.category_id && p.category_name) seen.set(p.category_id, p.category_name);
    });
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [allProjects]);

  const clientOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allProjects.forEach(p => {
      if (p.client_id && p.client_name) seen.set(p.client_id, p.client_name);
    });
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [allProjects]);

  const filteredProjects = useMemo(() => {
    return allProjects.filter(p => {
      if (filterProjects.length && !filterProjects.includes(p.id)) return false;
      if (filterStatuses.length && !(p.status_id && filterStatuses.includes(p.status_id))) return false;
      if (filterPriorities.length && !(p.priority_id && filterPriorities.includes(p.priority_id))) return false;
      if (filterCategories.length && !(p.category_id && filterCategories.includes(p.category_id))) return false;
      if (filterClients.length && !(p.client_id && filterClients.includes(p.client_id))) return false;
      // Same "exclude if the field needed to match isn't set" idiom as the filters above —
      // a project with no dates has nothing to compare against a date range.
      if (dateFilter) {
        if (!p.start_date || !p.end_date) return false;
        const pStart = dayjs(p.start_date);
        const pEnd = dayjs(p.end_date);
        if (pEnd.isBefore(dateFilter[0], 'day') || pStart.isAfter(dateFilter[1], 'day')) return false;
      }
      return true;
    });
  }, [allProjects, filterProjects, filterStatuses, filterPriorities, filterCategories, filterClients, dateFilter]);

  // Only projects with both a start and end date can be placed on the date-driven grid
  // (their position/width comes from those dates); dateless ones can't be, but rather
  // than dropping them from the row list they render with a hover-to-place interaction
  // instead of a draggable bar (see TimelineProjectPlaceholderRow). On first load the
  // backend sorts them last (NULLS LAST), but their row position is otherwise frozen like
  // everything else — see orderedProjects below.
  // `projects` (dated-only) is still needed for date-boundary calculations below.
  const projects = useMemo(
    () => filteredProjects.filter((p): p is DatedProjectTimelineItem => !!p.start_date && !!p.end_date),
    [filteredProjects]
  );

  // Freezes on-screen row order for the life of this mount. The backend always returns
  // projects sorted by start_date, and every date edit (drag or placeholder commit)
  // triggers a refetch — without this, the row a user just dragged (and others) would
  // jump to a new position the instant the edit lands. Order is tracked against the full
  // (unfiltered) project set so a project temporarily hidden by a filter returns to its
  // original spot if the filter is cleared; genuinely new projects are appended at the
  // end. Resets naturally on remount — PlannerLayout renders each Planner tab through a
  // routed <Outlet/>, so this clears when the user leaves and returns to Timeline, or
  // refreshes the page.
  const orderedProjects = useMemo(() => {
    const known = new Set(orderRef.current);
    for (const p of allProjects) {
      if (!known.has(p.id)) {
        orderRef.current.push(p.id);
        known.add(p.id);
      }
    }
    const allIds = new Set(allProjects.map(p => p.id));
    orderRef.current = orderRef.current.filter(id => allIds.has(id));

    const byId = new Map(filteredProjects.map(p => [p.id, p]));
    return orderRef.current.filter(id => byId.has(id)).map(id => byId.get(id)!);
  }, [filteredProjects, allProjects]);

  // Header row master toggle — collapses everything only once every currently-visible
  // project is expanded; otherwise (none or only some expanded) expands the rest.
  const allExpanded = orderedProjects.length > 0 && expandedProjectIds.size >= orderedProjects.length;
  const toggleExpandAll = () => {
    setExpandedProjectIds(allExpanded ? new Set() : new Set(orderedProjects.map(p => p.id)));
  };

  // Single source of row order shared by BOTH panels (project names on the left, bars on
  // the right) — each renders this exact same array of groups in the exact same order
  // instead of each doing its own orderedProjects.map(...). That's deliberate: once
  // expanding a project can insert a variable number of task rows beneath it, the two
  // panels HAVE to derive from one shared list or they drift out of alignment (a task's
  // bar ending up next to the wrong task's name). Every row is MAIN_ROW_HEIGHT tall
  // regardless of kind, so existing index-based scroll math elsewhere keeps working
  // unchanged. Grouped by project (rather than one flat row list) so each project's own
  // row can be rendered as a position:sticky header over its own task rows.
  const renderRows = useMemo<TimelineProjectGroup[]>(() => {
    return orderedProjects.map(project => {
      if (!expandedProjectIds.has(project.id)) return { project, taskRows: [] };
      const tasks = tasksByProjectId[project.id];
      const taskRows: TimelineTaskSubRow[] =
        tasks === undefined
          ? [{ kind: 'tasksStatus', projectId: project.id, status: 'loading' }]
          : tasks.length === 0
            ? [{ kind: 'tasksStatus', projectId: project.id, status: 'empty' }]
            : tasks.map(task => ({ kind: 'task', task }));
      return { project, taskRows };
    });
  }, [orderedProjects, expandedProjectIds, tasksByProjectId]);

  // Briefly highlights a project right after a placeholder-row commit, waiting for
  // orderedProjects to actually contain it before flashing it. Deliberately does not
  // scroll the grid into view — the row is already the one the user just clicked, so
  // forcing a scroll only produced an unwanted "jump" instead of a smooth confirmation.
  useEffect(() => {
    if (!focusProjectId) return;
    const exists = orderedProjects.some(p => p.id === focusProjectId);
    if (!exists) return;
    if (focusClearTimeoutRef.current) clearTimeout(focusClearTimeoutRef.current);
    focusClearTimeoutRef.current = setTimeout(() => setFocusProjectId(null), 1600);
  }, [orderedProjects, focusProjectId]);

  useEffect(
    () => () => {
      if (focusClearTimeoutRef.current) clearTimeout(focusClearTimeoutRef.current);
    },
    []
  );

  // Visible date range spans the earliest project start to the latest project end,
  // padded by one zoom-unit on each side, rounded to whole units so the ruler's
  // columns line up cleanly (whole years / quarters / weeks) instead of starting mid-unit.
  // Round to the coarser topUnit's boundary when there is one (e.g. Weeks rounds to a
  // whole ISO week, not just a whole day) so the grouping row's first/last group isn't
  // a partial week/month/year.
  const boundaryUnit = cfg.topUnit === 'week' ? 'isoWeek' : (cfg.topUnit ?? cfg.unit);
  // dayjs's isoWeek plugin only teaches startOf/endOf about 'isoWeek' — add/subtract
  // don't recognize it as a unit at all (it silently falls through to an unrelated
  // default instead of erroring), which threw every date column, including the "today"
  // line, off by a day. A plain 7-day 'week' step is equivalent here regardless of
  // which weekday the week starts on, so it's safe to swap in for the +/-1 padding below.
  const boundaryStepUnit = boundaryUnit === 'isoWeek' ? 'week' : boundaryUnit;

  const rangeStart = useMemo(() => {
    // An active date filter pins the visible range to what the user actually asked for —
    // rounded only to the current zoom's fine unit (cfg.unit), never the coarser
    // boundaryUnit/topUnit grouping used below, and with none of the extra unit of
    // padding or the Years-zoom "at least 3 years back" floor. Those exist to keep
    // *auto-derived-from-projects* ranges from starting/ending mid-group and to give a
    // sensible default span with no filter — applying the same rounding to an explicit
    // 2-month filter is what previously ballooned it out to a 3-year range (e.g.
    // 2026-08-01–2026-09-30 became "Jan 2025 – Dec 2027" at Months zoom, whose
    // boundaryUnit is 'year').
    if (dateFilter) return dateFilter[0].startOf(cfg.unit as any);

    const base = projects.length
      ? projects.reduce((min, p) => (dayjs(p.start_date).isBefore(min) ? dayjs(p.start_date) : min), dayjs(projects[0].start_date))
      : today;
    let start = base.startOf(boundaryUnit as any).subtract(1, boundaryStepUnit as any);
    // Years zoom always shows at least 3 years back from today, regardless of how
    // recent the earliest project is — extended further only if a project goes back
    // beyond that. Dragging a bar past this floor still works — it's a minimum, not a
    // cap — the grid just expands to follow the dragged date (see rangeEnd/rangeStart's
    // project-date-based `base` above).
    if (zoom === 'years') {
      const floor = today.startOf('year').subtract(3, 'year');
      if (floor.isBefore(start)) start = floor;
    }
    return start;
  }, [projects, boundaryUnit, boundaryStepUnit, zoom, dateFilter, cfg.unit]);

  const rangeEnd = useMemo(() => {
    if (dateFilter) return dateFilter[1].endOf(cfg.unit as any);

    const base = projects.length
      ? projects.reduce((max, p) => (dayjs(p.end_date).isAfter(max) ? dayjs(p.end_date) : max), dayjs(projects[0].end_date))
      : today;
    let end = base.endOf(boundaryUnit as any).add(1, boundaryStepUnit as any);
    // Years zoom always shows at least 2 years forward from today (so the default
    // Years view is 3 back + current + 2 forward = 6 years total).
    if (zoom === 'years') {
      const ceiling = today.endOf('year').add(2, 'year');
      if (ceiling.isAfter(end)) end = ceiling;
    }
    return end;
  }, [projects, boundaryUnit, boundaryStepUnit, zoom, dateFilter, cfg.unit]);

  const totalDays = Math.max(1, rangeEnd.diff(rangeStart, 'day'));

  // Stretch columns to fill the available width when the date range is short (e.g. a
  // handful of projects at Years zoom) rather than leaving blank space to the right of
  // the grid — mirrors PlannerScheduleView's colWidth stretch-to-fill behavior.
  const pxPerDay = useMemo(() => {
    const natural = totalDays * cfg.pxPerDay;
    return gridWidth > natural && totalDays > 0 ? gridWidth / totalDays : cfg.pxPerDay;
  }, [gridWidth, totalDays, cfg.pxPerDay]);

  const totalWidth = totalDays * pxPerDay;

  const units = useMemo(() => {
    const list: { key: string; label: string; subLabel?: string; isWeekend: boolean; width: number }[] = [];
    let cur = rangeStart;
    while (cur.isBefore(rangeEnd)) {
      const next = cur.add(1, cfg.unit);
      const days = next.diff(cur, 'day');
      list.push({
        key: cur.format('YYYY-MM-DD'),
        // Days/Weeks/Months/Quarters show only the fine label here — the year (and, at
        // Days zoom, the month) is shown once in the topGroups row above instead of
        // repeating on every column. Day-unit columns (Days and Weeks zoom) get a
        // weekday abbreviation stacked above the day number (e.g. "Mon" / "6") so it
        // reads as a calendar date rather than a bare number — this is what makes Weeks
        // zoom distinguishable from a plain numbered ruler.
        label: cfg.unit === 'year' ? cur.format('YYYY') : cfg.unit === 'day' ? cur.format('D') : cur.format('MMM'),
        subLabel: cfg.unit === 'day' ? cur.format('ddd') : undefined,
        isWeekend: cfg.unit === 'day' && (cur.day() === 0 || cur.day() === 6),
        width: days * pxPerDay,
      });
      cur = next;
    }
    return list;
  }, [rangeStart, rangeEnd, cfg.unit, pxPerDay]);

  // Coarse grouping row spanning the fine units above (see TIMELINE_ZOOM_CFG.topUnit) —
  // mirrors PlannerScheduleView's monthGroups/weekGroups spanning-header pattern.
  const topGroups = useMemo(() => {
    if (!cfg.topUnit) return [];
    const groups: { key: string; label: string; width: number }[] = [];
    units.forEach(u => {
      const d = dayjs(u.key);
      const key =
        cfg.topUnit === 'week'
          ? `${d.isoWeekYear()}-${d.isoWeek()}`
          : cfg.topUnit === 'month'
            ? d.format('YYYY-MM')
            : cfg.topUnit === 'quarter'
              ? `${d.year()}-Q${d.quarter()}`
              : d.format('YYYY');
      const label =
        cfg.topUnit === 'week'
          ? `Week ${d.isoWeek()}`
          : cfg.topUnit === 'month'
            ? d.format('MMMM YYYY')
            : cfg.topUnit === 'quarter'
              ? `Q${d.quarter()} ${d.year()}`
              : d.format('YYYY');
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.width += u.width;
      } else {
        groups.push({ key, label, width: u.width });
      }
    });
    return groups;
  }, [units, cfg.topUnit]);

  const rangeLabel = `${rangeStart.format('MMM YYYY')} - ${rangeEnd.format('MMM YYYY')}`;
  const todayLeft = today.diff(rangeStart, 'day') * pxPerDay;

  const handleZoomIn = () => {
    const idx = ZOOM_ORDER.indexOf(zoom);
    if (idx > 0) setZoom(ZOOM_ORDER[idx - 1]);
  };
  const handleZoomOut = () => {
    const idx = ZOOM_ORDER.indexOf(zoom);
    if (idx < ZOOM_ORDER.length - 1) setZoom(ZOOM_ORDER[idx + 1]);
  };
  const handleToday = () => {
    const el = bodyScrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, todayLeft - el.clientWidth / 2);
  };

  // Today stays centered by default: once on first load (as soon as the grid's width
  // has been measured and real project data has arrived) and again on every zoom
  // change, since zooming rescales the whole day/pxPerDay coordinate system out from
  // under whatever scroll position was centered before. Panning (handleGridMouseDown
  // above) is the only thing that should move the view away from center after that —
  // this effect intentionally does NOT depend on scroll position, filters, or dragged
  // project dates, so it never fights the user's own panning.
  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el || gridWidth === 0 || isLoading) return;
    el.scrollLeft = Math.max(0, todayLeft - el.clientWidth / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, gridWidth > 0, isLoading]);

  // Vertically centers the list on today's position in the start-date order once on first
  // load, same reasoning as the horizontal centering above. Picking the first project whose
  // range merely *covers* today isn't enough — a long-running project that started years
  // ago still covers today and still sorts first, so "centering" on it just clamps back to
  // the very top of the list (nothing above it to balance against) instead of actually
  // moving the view. Finding the last project that has already started by today instead
  // lands on today's real spot in the start_date-sorted order, further down among whatever
  // is currently active. Deliberately only runs once per mount (not on every scroll,
  // filter, or dragged date), so it never fights the user's own scrolling afterward.
  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el || isLoading) return;
    let index = -1;
    orderedProjects.forEach((p, i) => {
      if (p.start_date && !dayjs(p.start_date).isAfter(today, 'day')) index = i;
    });
    if (index === -1) return;
    el.scrollTop = Math.max(0, index * MAIN_ROW_HEIGHT - el.clientHeight / 2 + MAIN_ROW_HEIGHT / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const bg = themeWiseColor('#fff', '#141414', themeMode);
  const cardBg = themeWiseColor('#fff', '#1f1f1f', themeMode);
  const borderColor = themeWiseColor('#e8e8e8', '#303030', themeMode);

  const zoomBtnStyle = (active: boolean, isLast: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    borderRight: isLast ? 'none' : `1px solid ${token.colorBorderSecondary}`,
    background: active ? token.colorPrimary : 'transparent',
    color: active ? (token.colorWhite ?? '#fff') : token.colorText,
    transition: 'all .15s',
    whiteSpace: 'nowrap',
  });

  // Matches the LEFT/RIGHT panels' actual header stack height (topGroups row is
  // conditional, the unit row is always there) so the empty-state overlay starts right
  // below the header instead of covering it — same technique as PlannerScheduleView /
  // PlannerWorkloadView's headerHeight.
  const headerHeight = (topGroups.length > 0 ? TOP_HEADER_HEIGHT : 0) + UNIT_HEADER_HEIGHT;

  // Shown as a centered overlay (see the position:absolute wrapper next to the loading
  // spinner below) when there are no projects to place on the grid — either none exist,
  // or a filter excluded all of them. Same friendly-and-positive copy as
  // PlannerScheduleView/PlannerWorkloadView's emptyStateBlock, so all three Planner tabs
  // read as one consistent surface. Centered over the whole grid (both the project
  // column and the date grid), not just the narrow 280px project column.
  const emptyStateBlock = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {anyFilterActive
            ? t('timelineEmptyFilteredTitle', { defaultValue: "You're all caught up here" })
            : t('timelineEmptyTitle', { defaultValue: 'Nothing to show yet' })}
        </div>
        <div style={{ fontSize: 12, opacity: 0.55, maxWidth: 340 }}>
          {anyFilterActive
            ? t('timelineEmptyFilteredDesc', {
                defaultValue: 'No projects match the current filters. Try widening Projects, Status, Priority, Category, or Clients.',
              })
            : t('timelineEmptyProjectsDesc', { defaultValue: 'No projects to show yet.' })}
        </div>
        {anyFilterActive && (
          <Button size="small" style={{ marginTop: 6 }} onClick={clearAllFilters}>
            {t('clearFilters', { defaultValue: 'Clear filters' })}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        paddingTop: 16,
        boxSizing: 'border-box',
        minHeight: 0,
      }}
    >
      {/* Non-visual task fetchers, scoped to the same portfolio-wide date filter, report
          back via handleExpandedTasksChange. Below BATCH_EXPAND_THRESHOLD expanded
          projects, one TimelineExpandedProjectTasks per project (N parallel requests,
          progressive per-project rendering); at or above it (typically only via the
          header's "expand all"), one TimelineExpandedProjectsBatchTasks instead (a
          single batched request) — see the components above for why. */}
      {expandedProjectIdsArray.length >= BATCH_EXPAND_THRESHOLD ? (
        <TimelineExpandedProjectsBatchTasks
          key="batch"
          projectIds={expandedProjectIdsArray}
          startDate={dateFilter ? dateFilter[0].format('YYYY-MM-DD') : undefined}
          endDate={dateFilter ? dateFilter[1].format('YYYY-MM-DD') : undefined}
          onTasksChange={handleExpandedTasksChange}
        />
      ) : (
        expandedProjectIdsArray.map(id => (
          <TimelineExpandedProjectTasks
            key={id}
            projectId={id}
            startDate={dateFilter ? dateFilter[0].format('YYYY-MM-DD') : undefined}
            endDate={dateFilter ? dateFilter[1].format('YYYY-MM-DD') : undefined}
            onTasksChange={handleExpandedTasksChange}
          />
        ))
      )}

      {/* Filters + date-nav box — boxed toolbar, mirrors the task list view's
          rounded/bordered filter bar (see ImprovedTaskFiltersContainer) and
          PlannerScheduleView's own toolbar box. */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: 8,
          flexShrink: 0,
        }}
      >
      {/* Filters row */}
      <Flex align="center" gap={8} wrap="wrap" style={{ padding: '10px 12px' }}>
        <PlannerMultiFilterDropdown
          label={t('allProjects', { defaultValue: 'Projects' })}
          options={allProjects.map(p => ({ value: p.id, label: p.name || '' }))}
          selected={filterProjects}
          onChange={setFilterProjects}
        />
        <PlannerMultiFilterDropdown
          label={t('allStatuses', { defaultValue: 'Status' })}
          options={statusOptions}
          selected={filterStatuses}
          onChange={setFilterStatuses}
        />
        <PlannerMultiFilterDropdown
          label={t('allPriorities', { defaultValue: 'Priority' })}
          options={priorityOptions}
          selected={filterPriorities}
          onChange={setFilterPriorities}
        />
        <PlannerMultiFilterDropdown
          label={t('allCategories', { defaultValue: 'Category' })}
          options={categoryOptions}
          selected={filterCategories}
          onChange={setFilterCategories}
        />
        <PlannerMultiFilterDropdown
          label={t('allClients', { defaultValue: 'Clients' })}
          options={clientOptions}
          selected={filterClients}
          onChange={setFilterClients}
        />
        <DatePicker.RangePicker
          size="small"
          value={dateFilter}
          onChange={v => setDateFilter(v && v[0] && v[1] ? [v[0], v[1]] : null)}
          placeholder={[
            t('startDate', { defaultValue: 'Start date' }),
            t('endDate', { defaultValue: 'End date' }),
          ]}
          style={{ fontSize: 12 }}
        />
      </Flex>

      {/* Range label + zoom row */}
      <Flex
        align="center"
        gap={8}
        wrap="wrap"
        style={{ padding: '8px 12px', borderTop: `1px solid ${borderColor}` }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, marginRight: 8 }}>{rangeLabel}</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Space size={4}>
            <Button
              size="small"
              shape="circle"
              icon={<ZoomInOutlined />}
              onClick={handleZoomIn}
              disabled={zoom === 'days'}
              title={t('zoomIn', { defaultValue: 'Zoom In' })}
            />
            <Button
              size="small"
              shape="circle"
              icon={<ZoomOutOutlined />}
              onClick={handleZoomOut}
              disabled={zoom === 'years'}
              title={t('zoomOut', { defaultValue: 'Zoom Out' })}
            />
            <Button
              size="small"
              shape="circle"
              icon={<ExpandOutlined />}
              onClick={handleFullscreen}
              title={t('fullscreen', { defaultValue: 'Fullscreen' })}
            />
          </Space>

          <div style={{ display: 'inline-flex', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 7, overflow: 'hidden' }}>
            <button onClick={handleToday} style={zoomBtnStyle(false, true)}>
              {t('today', { defaultValue: 'Today' })}
            </button>
          </div>
        </div>
      </Flex>
      </div>

      {/* Grid — the project column (left) and the date grid (right) are two separate
          panels; the left one never scrolls horizontally, so there's no sticky-column
          positioning to glitch against the right panel's JS-driven horizontal scroll.
          Boxed to match the filters box above (mirrors PlannerScheduleView's calendar
          box / the task list view's bordered table container). */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          position: 'relative',
          border: `1px solid ${borderColor}`,
          borderRadius: 8,
          overflow: 'hidden',
          background: cardBg,
        }}
      >
        {/* Loading spinner centered over the whole grid (both panels) — rendering it
            inside just the narrow left project column instead would center it in that
            280px sliver, not on screen. */}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
              background: bg,
            }}
          >
            <WorklenzLogoLoader />
          </div>
        )}

        {/* Empty state, same overlay technique as the loading spinner above — centered
            over the whole grid body (both panels), not just the narrow project column.
            Starts below headerHeight so the project/date column headers stay visible,
            same as Schedule/Workload's empty state. */}
        {!isLoading && projects.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: headerHeight,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
              background: bg,
            }}
          >
            {emptyStateBlock}
          </div>
        )}

        {/* LEFT: project column */}
        <div
          style={{
            width: LEFT_COL_WIDTH,
            minWidth: LEFT_COL_WIDTH,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${borderColor}`,
            background: cardBg,
          }}
        >
          {topGroups.length > 0 && <div style={{ height: TOP_HEADER_HEIGHT, minHeight: TOP_HEADER_HEIGHT, borderBottom: `1px solid ${borderColor}` }} />}
          <div
            style={{
              height: UNIT_HEADER_HEIGHT,
              minHeight: UNIT_HEADER_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px 0 16px',
              fontSize: 12,
              fontWeight: 600,
              opacity: 0.45,
              textTransform: 'uppercase',
              borderBottom: `1px solid ${borderColor}`,
            }}
          >
            {t('project', { defaultValue: 'Project' })}
            {/* Master expand/collapse — expands every visible project at once, or
                collapses everything if any are currently expanded. */}
            <button
              type="button"
              onClick={toggleExpandAll}
              title={
                allExpanded
                  ? t('collapseAll', { defaultValue: 'Collapse all' })
                  : t('expandAll', { defaultValue: 'Expand all' })
              }
              style={{
                background: 'none',
                border: 'none',
                padding: 4,
                margin: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: token.colorTextSecondary,
                textTransform: 'none',
              }}
            >
              {allExpanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
            </button>
          </div>
          <div
            ref={leftBodyScrollRef}
            onScroll={() => {
              if (bodyScrollRef.current && leftBodyScrollRef.current) {
                bodyScrollRef.current.scrollTop = leftBodyScrollRef.current.scrollTop;
              }
            }}
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}
          >
            {isLoading ? null : orderedProjects.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
                {t('noDataAvailable', { defaultValue: 'No data available' })}
              </div>
            ) : (
              renderRows.map(group => (
                // Group wrapper is the sticky containing block: TimelineProjectInfoRow
                // inside it sticks to top:0 of the scroll container while this group's
                // own task rows scroll by beneath it, and gets pushed out once this
                // wrapper's bottom (i.e. the last task row) reaches the top — at which
                // point the NEXT group's own sticky row takes over. z-index keeps the
                // stuck row above the task rows still scrolling underneath it.
                <div key={group.project.id} style={{ position: 'relative' }}>
                  <div style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <TimelineProjectInfoRow
                      project={group.project}
                      cardBg={cardBg}
                      borderColor={borderColor}
                      highlighted={group.project.id === focusProjectId}
                      expanded={expandedProjectIds.has(group.project.id)}
                      onToggleExpand={() => toggleExpandProject(group.project.id)}
                    />
                  </div>
                  {group.taskRows.map(row =>
                    row.kind === 'tasksStatus' ? (
                      <TimelineTaskStatusRow
                        key={`${row.projectId}-status`}
                        borderColor={borderColor}
                        status={row.status}
                      />
                    ) : (
                      <TimelineTaskInfoRow
                        key={row.task.id}
                        task={row.task}
                        borderColor={borderColor}
                        onClick={() => openTaskDrawer(row.task)}
                      />
                    )
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: date grid */}
        <div ref={gridWrapperRef} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div ref={headerScrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', background: cardBg, borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
            <div style={{ position: 'relative', width: totalWidth }}>
              {topGroups.length > 0 && (
                <div style={{ display: 'flex', width: totalWidth, height: TOP_HEADER_HEIGHT, minHeight: TOP_HEADER_HEIGHT, borderBottom: `1px solid ${borderColor}` }}>
                  {topGroups.map(g => (
                    <div
                      key={g.key}
                      style={{
                        width: g.width,
                        minWidth: g.width,
                        flexShrink: 0,
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        opacity: 0.55,
                        borderRight: `1px solid ${borderColor}`,
                      }}
                    >
                      {g.label}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', width: totalWidth, height: UNIT_HEADER_HEIGHT, minHeight: UNIT_HEADER_HEIGHT }}>
                {units.map(u => (
                  <div
                    key={u.key}
                    style={{
                      width: u.width,
                      minWidth: u.width,
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      borderRight: `1px solid ${borderColor}`,
                      background: u.isWeekend ? token.colorFillQuaternary : undefined,
                    }}
                  >
                    {u.subLabel && (
                      <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.55, lineHeight: 1.3 }}>{u.subLabel}</span>
                    )}
                    <span style={{ lineHeight: 1.3 }}>{u.label}</span>
                  </div>
                ))}
              </div>

              {/* Highlights the date columns spanned by the hovered placeholder-row
                  preview (TimelineProjectPlaceholderRow), in the same left/width
                  coordinate space as the body's bars below. */}
              {hoverPreviewRange && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: hoverPreviewRange.start.diff(rangeStart, 'day') * pxPerDay,
                    width: (hoverPreviewRange.end.diff(hoverPreviewRange.start, 'day') + 1) * pxPerDay,
                    background: token.colorPrimary,
                    opacity: 0.18,
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />
              )}
            </div>
          </div>

          <div
            ref={bodyScrollRef}
            onScroll={() => {
              if (headerScrollRef.current && bodyScrollRef.current) {
                headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
              }
              if (leftBodyScrollRef.current && bodyScrollRef.current) {
                leftBodyScrollRef.current.scrollTop = bodyScrollRef.current.scrollTop;
              }
            }}
            onMouseDown={handleGridMouseDown}
            style={{ flex: 1, minHeight: 0, overflow: 'auto', cursor: isPanning ? 'grabbing' : 'grab', userSelect: isPanning ? 'none' : undefined }}
          >
            <div style={{ width: totalWidth, minWidth: totalWidth, minHeight: '100%', position: 'relative' }}>
              {/* Weekend column shading (Days/Weeks zoom only, where the unit is a day) —
                  same faint fill as the weekend header cells, so a weekend is visible at
                  a glance while scanning the grid, not just in the header row. */}
              {cfg.unit === 'day' &&
                (() => {
                  let x = 0;
                  return units.map(u => {
                    const left = x;
                    x += u.width;
                    if (!u.isWeekend) return null;
                    return (
                      <div
                        key={`weekend-${u.key}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left,
                          width: u.width,
                          background: token.colorFillQuaternary,
                          zIndex: 0,
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  });
                })()}

              {/* "Today" vertical indicator, spans the full height of the row content below */}
              {todayLeft >= 0 && todayLeft <= totalWidth && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: todayLeft,
                    borderLeft: `1px dashed ${token.colorPrimary}`,
                    zIndex: 0,
                    pointerEvents: 'none',
                  }}
                />
              )}

              {!isLoading &&
                renderRows.map(group => (
                  // Same sticky-group structure as the left panel's project column —
                  // deliberately mirrored row-for-row so the sticky project bar here
                  // stays visually aligned with the sticky project name on the left
                  // while scrolling, rather than the two panels drifting apart.
                  <div key={group.project.id} style={{ position: 'relative' }}>
                    <div style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                      {group.project.start_date && group.project.end_date ? (
                        <TimelineProjectBarRow
                          project={group.project as DatedProjectTimelineItem}
                          rangeStart={rangeStart}
                          pxPerDay={pxPerDay}
                          totalWidth={totalWidth}
                          borderColor={borderColor}
                          cardBg={cardBg}
                          onDatesChange={handleProjectDatesChange}
                          highlighted={group.project.id === focusProjectId}
                        />
                      ) : (
                        <TimelineProjectPlaceholderRow
                          project={group.project}
                          rangeStart={rangeStart}
                          pxPerDay={pxPerDay}
                          totalWidth={totalWidth}
                          borderColor={borderColor}
                          cardBg={cardBg}
                          onDatesChange={handlePlaceholderDatesCommit}
                          onHoverRangeChange={setHoverPreviewRange}
                        />
                      )}
                    </div>
                    {group.taskRows.map(row =>
                      row.kind === 'tasksStatus' ? (
                        <TimelineTaskStatusBarRow
                          key={`${row.projectId}-status-bar`}
                          borderColor={borderColor}
                          totalWidth={totalWidth}
                        />
                      ) : (
                        <TimelineTaskBarRow
                          key={row.task.id}
                          task={row.task}
                          rangeStart={rangeStart}
                          pxPerDay={pxPerDay}
                          totalWidth={totalWidth}
                          borderColor={borderColor}
                          onDatesChange={handleTaskDatesChange}
                        />
                      )
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlannerTimelineView;
