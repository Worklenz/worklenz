import React, { useMemo, useState, useEffect, useRef } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(quarterOfYear);
dayjs.extend(isoWeek);

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Flex, Space, theme, Tooltip } from '@/shared/antd-imports';
import { ZoomInOutlined, ZoomOutOutlined, ExpandOutlined } from '@ant-design/icons';

import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import PlannerMultiFilterDropdown from '@/features/schedule/PlannerMultiFilterDropdown';
import {
  useFetchProjectsTimelineQuery,
  useUpdateProjectTimelineDatesMutation,
} from '@/api/schedule/scheduleApi';
import { ProjectTimelineItem } from '@/types/schedule/schedule-v2.types';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';

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

// TimelineProjectBarRow always has both dates — undated projects render as a
// TimelineProjectPlaceholderRow instead (see below) rather than being placed on the grid.
type DatedProjectTimelineItem = ProjectTimelineItem & { start_date: string; end_date: string };

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
}

const TimelineProjectInfoRow: React.FC<TimelineRowProps> = ({ project, borderColor, cardBg, highlighted }) => {
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
        gap: 8,
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
        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer' }}
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
    </div>
  );
};

interface TimelineBarRowProps {
  project: DatedProjectTimelineItem;
  rangeStart: Dayjs;
  pxPerDay: number;
  totalWidth: number;
  borderColor: string;
  onDatesChange: (projectId: string, startDate: string, endDate: string) => void;
  highlighted?: boolean;
}

// Same tooltip surface treatment as PlannerScheduleView's renderTaskTooltipTitle: a
// solid white card with a drop shadow in light mode (antd's default tooltip is a dark
// chip regardless of app theme, which read as a jarring, mismatched box against the
// rest of Planner's light-mode chrome), left to antd's own dark styling in dark mode.
const tooltipProps = (themeMode: string, token: any) => ({
  color: themeMode === 'dark' ? undefined : '#fff',
  overlayInnerStyle:
    themeMode === 'dark' ? undefined : { color: token.colorText, boxShadow: '0 2px 8px rgba(0,0,0,.15)' },
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
  onDatesChange,
  highlighted,
}) => {
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

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
        <div style={{ fontSize: 12, fontWeight: 700, color: token.colorError, marginBottom: 6 }}>⚠ Overdue</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
        <div>
          <span style={{ opacity: 0.65 }}>Dates: </span>
          {startDateStr} - {endDateStr}
        </div>
        <div>
          <span style={{ opacity: 0.65 }}>Status: </span>
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
          <span style={{ opacity: 0.65 }}>Done: </span>
          {project.done_count} ({project.done_progress}%)
        </div>
        <div>
          <span style={{ opacity: 0.65 }}>Doing: </span>
          {project.doing_count} ({project.doing_progress}%)
        </div>
        <div>
          <span style={{ opacity: 0.65 }}>Todo: </span>
          {project.todo_count} ({project.todo_progress}%)
        </div>
        <div>
          <span style={{ opacity: 0.65 }}>Total tasks: </span>
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
        background: highlighted ? token.colorPrimaryBg : undefined,
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
        background: hoverStart ? token.colorFillQuaternary : undefined,
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

const PlannerTimelineView: React.FC = () => {
  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { token } = theme.useToken();

  const [zoom, setZoom] = useState<TimelineZoom>('months');
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterClients, setFilterClients] = useState<string[]>([]);
  const anyFilterActive =
    filterProjects.length > 0 ||
    filterStatuses.length > 0 ||
    filterPriorities.length > 0 ||
    filterCategories.length > 0 ||
    filterClients.length > 0;
  const clearAllFilters = () => {
    setFilterProjects([]);
    setFilterStatuses([]);
    setFilterPriorities([]);
    setFilterCategories([]);
    setFilterClients([]);
  };

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
      return true;
    });
  }, [allProjects, filterProjects, filterStatuses, filterPriorities, filterCategories, filterClients]);

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
  }, [projects, boundaryUnit, boundaryStepUnit, zoom]);

  const rangeEnd = useMemo(() => {
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
  }, [projects, boundaryUnit, boundaryStepUnit, zoom]);

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
          options={allProjects.map(p => ({ value: p.id, label: p.name }))}
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
              padding: '0 16px',
              fontSize: 12,
              fontWeight: 600,
              opacity: 0.45,
              textTransform: 'uppercase',
              borderBottom: `1px solid ${borderColor}`,
            }}
          >
            {t('project', { defaultValue: 'Project' })}
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
              orderedProjects.map(project => (
                <TimelineProjectInfoRow
                  key={project.id}
                  project={project}
                  cardBg={cardBg}
                  borderColor={borderColor}
                  highlighted={project.id === focusProjectId}
                />
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
                orderedProjects.map(project =>
                  project.start_date && project.end_date ? (
                    <TimelineProjectBarRow
                      key={project.id}
                      project={project as DatedProjectTimelineItem}
                      rangeStart={rangeStart}
                      pxPerDay={pxPerDay}
                      totalWidth={totalWidth}
                      borderColor={borderColor}
                      onDatesChange={handleProjectDatesChange}
                      highlighted={project.id === focusProjectId}
                    />
                  ) : (
                    <TimelineProjectPlaceholderRow
                      key={project.id}
                      project={project}
                      rangeStart={rangeStart}
                      pxPerDay={pxPerDay}
                      totalWidth={totalWidth}
                      borderColor={borderColor}
                      onDatesChange={handlePlaceholderDatesCommit}
                      onHoverRangeChange={setHoverPreviewRange}
                    />
                  )
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlannerTimelineView;
