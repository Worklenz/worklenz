import React, { useEffect, useState, forwardRef, useImperativeHandle, useMemo, useCallback, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Spin, Empty } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { reportingTimesheetApiService } from '@/api/reporting/reporting.timesheet.api.service';
import { IRPTTimeMember } from '@/types/reporting/reporting.types';
import logger from '@/utils/errorLogger';
import { format } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

// Virtualization constants
const BAR_HEIGHT = 50; // Height per bar in pixels
const VISIBLE_BUFFER = 5; // Extra bars above/below viewport for smooth scrolling
const VIRTUALIZATION_THRESHOLD = 25; // Only virtualize when more than this many members (lowered for better performance)
const DATALABELS_THRESHOLD = 50; // Disable datalabels above this count for performance (lowered to reduce rendering load)

interface MembersTimeSheetProps {
  onTotalsUpdate: (totals: {
    total_time_logs: string;
    total_estimated_hours: string;
    total_utilization: string;
  }) => void;
  onLoadingChange?: (loading: boolean) => void;
}
export interface MembersTimeSheetRef {
  exportChart: () => void;
}

const MembersTimeSheet = forwardRef<MembersTimeSheetRef, MembersTimeSheetProps>(
  ({ onTotalsUpdate, onLoadingChange }, ref) => {
    const { t } = useTranslation('time-report');
    const chartRef = useRef<any>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollTimerRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
    const availableSpaceRef = useRef<HTMLDivElement>(null);
    const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
      teams,
      loadingTeams,
      departments,
      loadingDepartments,
      practices,
      loadingPractices,
      categories,
      loadingCategories,
      projects: filterProjects,
      loadingProjects,
      members,
      loadingMembers,
      utilization,
      loadingUtilization,
      billable,
      archived,
      noCategory,
      showOnlyMembersWithTimeLogs,
    } = useAppSelector(state => state.timeReportsOverviewReducer);
    const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

    const [loading, setLoading] = useState(false);
    const [jsonData, setJsonData] = useState<IRPTTimeMember[]>([]);
    const [scrollTop, setScrollTop] = useState(0);
    // Fallback used only until the ResizeObserver below reports the real,
    // measured container height (and as a floor for very short viewports).
    const [windowHeight, setWindowHeight] = useState(() => window.innerHeight);
    // The actual height the surrounding layout gives this component (the
    // Card body it sits in flexes to fill the page down to the bottom) —
    // measured directly instead of guessed from window.innerHeight, so the
    // virtualized scroll box always matches its real available space and
    // never ends up nested inside another scrollable box.
    const [containerHeight, setContainerHeight] = useState(0);

    useEffect(() => {
      let resizeTimer: ReturnType<typeof requestAnimationFrame> | null = null;
      const handleResize = () => {
        if (resizeTimer) cancelAnimationFrame(resizeTimer);
        resizeTimer = requestAnimationFrame(() => setWindowHeight(window.innerHeight));
      };
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        if (resizeTimer) cancelAnimationFrame(resizeTimer);
      };
    }, []);

    const totalCount = jsonData.length;
    const shouldVirtualize = totalCount > VIRTUALIZATION_THRESHOLD;
    const shouldShowDatalabels = totalCount <= DATALABELS_THRESHOLD;

    useEffect(() => {
      if (!shouldVirtualize || !availableSpaceRef.current) return;
      const el = availableSpaceRef.current;
      const observer = new ResizeObserver(entries => {
        const height = entries[0]?.contentRect.height;
        if (height) setContainerHeight(height);
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, [shouldVirtualize]);

    // Calculate the viewport height for the chart container
    const viewportHeight = useMemo(() => {
      if (!shouldVirtualize) {
        // When not virtualizing, use the natural height
        return Math.max(totalCount * BAR_HEIGHT, 300);
      }
      // Prefer the measured container height; fall back to a window-relative
      // guess only until the ResizeObserver reports a real value. Floored so
      // short viewports (e.g. landscape mobile) never collapse to an
      // unusable size.
      const measured = containerHeight || Math.min(windowHeight - 350, 1750);
      return Math.max(measured, 300);
    }, [shouldVirtualize, totalCount, windowHeight, containerHeight]);

    // Total scrollable height (full virtual content)
    const totalVirtualHeight = totalCount * BAR_HEIGHT;

    // Calculate visible range based on scroll position
    const { visibleStart, visibleEnd, visibleData } = useMemo(() => {
      if (!shouldVirtualize || totalCount === 0) {
        return { visibleStart: 0, visibleEnd: totalCount, visibleData: jsonData };
      }

      const startIdx = Math.max(0, Math.floor(scrollTop / BAR_HEIGHT) - VISIBLE_BUFFER);
      const visibleBars = Math.ceil(viewportHeight / BAR_HEIGHT) + VISIBLE_BUFFER * 2;
      const endIdx = Math.min(totalCount, startIdx + visibleBars);

      return {
        visibleStart: startIdx,
        visibleEnd: endIdx,
        visibleData: jsonData.slice(startIdx, endIdx),
      };
    }, [shouldVirtualize, totalCount, scrollTop, viewportHeight, jsonData]);

    // Memoize chart data processing — only for the visible slice
    const { labels, dataValues, colors } = useMemo(() => {
      if (!Array.isArray(visibleData) || visibleData.length === 0) {
        return { labels: [], dataValues: [], colors: [] };
      }

      const labels = visibleData.map(item => item.name);
      const dataValues = visibleData.map(item => {
        const loggedTimeInHours = parseFloat(item.logged_time || '0') / 3600;
        return Number(loggedTimeInHours.toFixed(2));
      });
      const colors = visibleData.map(item => {
        const utilizationPercent = parseFloat(item.utilization_percent || '0');

        if (utilizationPercent < 90) {
          return '#faad14'; // Orange for under-utilized (< 90%)
        } else if (utilizationPercent <= 110) {
          return '#52c41a'; // Green for optimal utilization (90-110%)
        } else {
          return '#ef4444'; // Red for over-utilized (> 110%)
        }
      });

      return { labels, dataValues, colors };
    }, [visibleData]);

    const themeMode = useAppSelector(state => state.themeReducer.mode);

    // Helper function to format hours to "X hours Y mins"
    const formatHours = useCallback((decimalHours: number) => {
      const wholeHours = Math.floor(decimalHours);
      const minutes = Math.round((decimalHours - wholeHours) * 60);

      if (wholeHours === 0 && minutes === 0) {
        return '0 mins';
      } else if (wholeHours === 0) {
        return `${minutes} mins`;
      } else if (minutes === 0) {
        return `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'}`;
      } else {
        return `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'} ${minutes} mins`;
      }
    }, []);

    // Memoize chart data to prevent unnecessary re-renders
    const data = useMemo(
      () => ({
        labels,
        datasets: [
          {
            label: t('loggedTime'),
            data: dataValues,
            backgroundColor: colors,
            barThickness: 40,
          },
        ],
      }),
      [labels, dataValues, colors, t]
    );

    // Chart options with performance optimizations for large datasets
    const options = useMemo(() => ({
      maintainAspectRatio: false,
      animation: {
        duration: 0, // Always disable animation — virtualized updates are frequent
      },
      plugins: {
        datalabels: shouldShowDatalabels
          ? {
            color: 'white',
            anchor: 'start' as const,
            align: 'right' as const,
            offset: 20,
            textStrokeColor: 'black',
            textStrokeWidth: 4,
            formatter: function (value: string) {
              const hours = parseFloat(value);
              const wholeHours = Math.floor(hours);
              const minutes = Math.round((hours - wholeHours) * 60);

              if (wholeHours === 0 && minutes === 0) {
                return '0 mins';
              } else if (wholeHours === 0) {
                return `${minutes} mins`;
              } else if (minutes === 0) {
                return `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'}`;
              } else {
                return `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'} ${minutes} mins`;
              }
            },
          }
          : { display: false },
        legend: {
          display: false,
          position: 'top' as const,
        },
        tooltip: {
          backgroundColor: themeMode === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          titleColor: themeMode === 'dark' ? '#ffffff' : '#000000',
          bodyColor: themeMode === 'dark' ? '#ffffff' : '#000000',
          footerColor: themeMode === 'dark' ? '#ffffff' : '#000000',
          borderColor: themeMode === 'dark' ? '#4a5568' : '#e2e8f0',
          cornerRadius: 8,
          padding: 12,
          displayColors: false,
          xAlign: 'left' as const,
          yAlign: 'center' as const,

          callbacks: {
            title: function (context: any) {
              const idx = context[0].dataIndex;
              const member = visibleData[idx];
              return member?.name || 'Unknown Member';
            },
            label: function (context: any) {
              const idx = context.dataIndex;
              const member = visibleData[idx];
              const hours = parseFloat(member?.utilized_hours || '0');
              const percent = parseFloat(member?.utilization_percent || '0.00');
              const overUnder = parseFloat(member?.over_under_utilized_hours || '0');

              let statusText = '';
              let criteriaText = '';
              switch (member?.utilization_state) {
                case 'under':
                  statusText = 'Under-Utilized';
                  criteriaText = '(< 90%)';
                  break;
                case 'optimal':
                  statusText = 'Optimally Utilized';
                  criteriaText = '(90% - 110%)';
                  break;
                case 'over':
                  statusText = 'Over-Utilized';
                  criteriaText = '(> 110%)';
                  break;
                default:
                  statusText = 'Unknown';
                  criteriaText = '';
              }

              return [
                `${context.dataset.label}: ${formatHours(hours)}`,
                `Utilization: ${percent.toFixed(1)}%`,
                `${statusText} ${criteriaText}`,
                `Variance: ${formatHours(Math.abs(overUnder))}${overUnder < 0 ? ' (under)' : overUnder > 0 ? ' (over)' : ''}`,
              ];
            },
            footer: function (context: any) {
              const idx = context[0].dataIndex;
              const member = visibleData[idx];
              const loggedTime = parseFloat(member?.logged_time || '0') / 3600;
              return `Total Logged: ${formatHours(loggedTime)}`;
            },
          },
        },
      },
      backgroundColor: 'black',
      indexAxis: 'y' as const,
      responsive: true,
      interaction: {
        mode: 'nearest' as const,
        axis: 'y' as const,
        intersect: false,
      },
      scales: {
        x: {
          title: {
            display: true,
            text: t('loggedTime'),
            align: 'end' as const,
            font: {
              family: 'Helvetica',
            },
          },
          grid: {
            color: themeMode === 'dark' ? '#2c2f38' : '#e5e5e5',
            lineWidth: 1,
          },
        },
        y: {
          title: {
            display: true,
            text: t('member'),
            align: 'end' as const,
            font: {
              family: 'Helvetica',
            },
          },
          grid: {
            color: themeMode === 'dark' ? '#2c2f38' : '#e5e5e5',
            lineWidth: 1,
          },
        },
      },
    }), [themeMode, shouldShowDatalabels, visibleData, formatHours, t]);

    // Scroll handler with requestAnimationFrame for smooth performance
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;

      if (scrollTimerRef.current) {
        cancelAnimationFrame(scrollTimerRef.current);
      }

      scrollTimerRef.current = requestAnimationFrame(() => {
        setScrollTop(newScrollTop);
      });
    }, []);

    // Cleanup rAF on unmount
    useEffect(() => {
      return () => {
        if (scrollTimerRef.current) {
          cancelAnimationFrame(scrollTimerRef.current);
        }
      };
    }, []);

    const fetchChartData = useCallback(async () => {
      // The filter option lists (teams, projects, categories, members, ...)
      // are still being fetched — "no selection" right now doesn't mean the
      // user has an empty selection, it means we don't know yet. Resolving
      // to the empty state here would flash "No data matching the selected
      // filters" (and zeroed-out stats) before the real filters have even
      // loaded. Stay in the loading state and let the effect re-trigger
      // fetchChartData once these settle (they're all in its deps below).
      if (
        loadingTeams ||
        loadingCategories ||
        loadingProjects ||
        loadingMembers ||
        loadingUtilization ||
        loadingDepartments ||
        loadingPractices
      ) {
        setLoading(true);
        onLoadingChange?.(true);
        return;
      }

      try {
        setLoading(true);
        onLoadingChange?.(true);

        // Validate dateRange before making API call
        if (!dateRange || dateRange.length !== 2 || !dateRange[0] || !dateRange[1]) {
          console.warn('[MembersTimeSheet] Invalid dateRange, skipping fetch:', dateRange);
          setLoading(false);
          return;
        }

        const selectedTeams = teams.filter(team => team.selected);
        const selectedDepartments = departments.filter(department => department.selected);
        const selectedPractices = practices.filter(practice => practice.selected);
        const selectedProjects = filterProjects.filter(project => project.selected);
        const selectedCategories = categories.filter(category => category.selected);
        const selectedMembers = members.filter(member => member.selected);
        const selectedUtilization = utilization.filter(item => item.selected);

        // Validate primary filters - show empty chart if any required filter is not met
        // This matches backend logic which returns no data when primary filters are empty
        const hasInvalidFilters =
          selectedProjects.length === 0 || // Projects are required
          selectedTeams.length === 0 || // Teams are required
          selectedCategories.length === 0 || // Categories required unless "No Category" is checked
          selectedMembers.length === 0; // Members are required (backend line 790: members.length === 0 → show nothing)

        if (hasInvalidFilters) {
          setJsonData([]);
          onTotalsUpdate({
            total_time_logs: '0',
            total_estimated_hours: '0',
            total_utilization: '0',
          });
          return;
        }

        // Format dates using date-fns
        const formattedDateRange = dateRange
          ? [
              format(new Date(dateRange[0]), 'yyyy-MM-dd'),
              format(new Date(dateRange[1]), 'yyyy-MM-dd'),
            ]
          : undefined;

        const body = {
          teams: selectedTeams.map(t => t.id),
          department_ids: selectedDepartments.map(department => department.id),
          practice_ids: selectedPractices.map(practice => practice.id),
          projects: selectedProjects.map(project => project.id),
          categories: selectedCategories.map(category => category.id),
          members: selectedMembers.map(member => member.id),
          utilization: selectedUtilization.map(item => item.id),
          duration,
          date_range: formattedDateRange,
          billable,
          noCategory,
          showOnlyMembersWithTimeLogs,
        };

        const res = await reportingTimesheetApiService.getMemberTimeSheets(body, archived);

        if (res.done) {
          // Ensure filteredRows is always an array, even if API returns null/undefined
          // The API response structure includes filteredRows and totals properties
          const responseData = res.body as any;
          setJsonData(responseData?.filteredRows || []);

          const totalsRaw = responseData?.totals || {};
          const totals = {
            total_time_logs: totalsRaw.total_time_logs ?? '0',
            total_estimated_hours: totalsRaw.total_estimated_hours ?? '0',
            total_utilization: totalsRaw.total_utilization ?? '0',
          };
          onTotalsUpdate(totals);
        } else {
          console.error('[MembersTimeSheet] API response not successful:', {
            done: res.done,
            message: res.message,
            hasBody: !!res.body,
          });
          setJsonData([]);
          onTotalsUpdate({
            total_time_logs: '0',
            total_estimated_hours: '0',
            total_utilization: '0',
          });
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        logger.error('Error fetching chart data:', error);
        setJsonData([]);
        onTotalsUpdate({
          total_time_logs: '0',
          total_estimated_hours: '0',
          total_utilization: '0',
        });
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    }, [
      onLoadingChange,
      teams,
      loadingTeams,
      departments,
      loadingDepartments,
      practices,
      loadingPractices,
      filterProjects,
      loadingProjects,
      categories,
      loadingCategories,
      members,
      loadingMembers,
      utilization,
      loadingUtilization,
      duration,
      dateRange,
      billable,
      noCategory,
      showOnlyMembersWithTimeLogs,
      archived,
    ]);

    // Create stable references for selected items to prevent unnecessary re-renders
    const selectedTeamIds = React.useMemo(
      () =>
        teams
          .filter(team => team.selected)
          .map(t => t.id)
          .join(','),
      [teams]
    );

    const selectedProjectIds = React.useMemo(
      () =>
        filterProjects
          .filter(project => project.selected)
          .map(p => p.id)
          .join(','),
      [filterProjects]
    );

    const selectedDepartmentIds = React.useMemo(
      () =>
        departments
          .filter(department => department.selected)
          .map(dep => dep.id)
          .join(','),
      [departments]
    );

    const selectedCategoryIds = React.useMemo(
      () =>
        categories
          .filter(category => category.selected)
          .map(c => c.id)
          .join(','),
      [categories]
    );

    const selectedMemberIds = React.useMemo(
      () =>
        members
          .filter(member => member.selected)
          .map(m => m.id)
          .join(','),
      [members]
    );

    const selectedUtilizationIds = React.useMemo(
      () =>
        utilization
          .filter(item => item.selected)
          .map(u => u.id)
          .join(','),
      [utilization]
    );

    // Debounced: on first mount, the filter lists this depends on (teams,
    // categories, projects, departments, practices, members, utilization)
    // arrive one at a time from TimeReportPageHeader's sequential fetches,
    // each one changing its selectedXIds memo and re-triggering this effect.
    // Firing fetchChartData on every one of those meant up to ~7 back-to-back
    // API calls and loading-state flips on first load (visible as the
    // spinner/skeletons flashing repeatedly). Debouncing collapses that
    // burst into a single fetch once the filters settle.
    useEffect(() => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      fetchDebounceRef.current = setTimeout(() => {
        fetchChartData();
      }, 200);
      return () => {
        if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      };
    }, [
      duration,
      dateRange,
      billable,
      archived,
      noCategory,
      selectedTeamIds,
      selectedDepartmentIds,
      selectedProjectIds,
      selectedCategoryIds,
      selectedMemberIds,
      selectedUtilizationIds,
      showOnlyMembersWithTimeLogs,
      fetchChartData,
    ]);

    // Export renders the full chart (not just visible slice) to offscreen canvas
    const exportChart = useCallback(() => {
      if (!jsonData.length) return;

      // Build full dataset for export
      const fullLabels = jsonData.map(item => item.name);
      const fullValues = jsonData.map(item => {
        const loggedTimeInHours = parseFloat(item.logged_time || '0') / 3600;
        return loggedTimeInHours.toFixed(2);
      });
      const fullColors = jsonData.map(item => {
        const pct = parseFloat(item.utilization_percent || '0');
        if (pct < 90) return '#faad14';
        if (pct <= 110) return '#52c41a';
        return '#ef4444';
      });

      // Create an offscreen canvas and render the full chart
      const offscreenCanvas = document.createElement('canvas');
      const fullHeight = Math.max(jsonData.length * BAR_HEIGHT, 400);
      offscreenCanvas.width = 1200;
      offscreenCanvas.height = fullHeight;

      const ctx = offscreenCanvas.getContext('2d');
      if (!ctx) return;

      // Fill background
      ctx.fillStyle = themeMode === 'dark' ? '#1f1f1f' : '#ffffff';
      ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

      // Create a temporary chart instance for the full export
      const exportChart = new ChartJS(ctx as any, {
        type: 'bar',
        data: {
          labels: fullLabels,
          datasets: [{
            label: t('loggedTime'),
            data: fullValues,
            backgroundColor: fullColors,
            barThickness: 40,
          }],
        },
        options: {
          maintainAspectRatio: false,
          animation: { duration: 0 },
          indexAxis: 'y',
          responsive: false,
          plugins: {
            datalabels: { display: false },
            legend: { display: false },
          },
          scales: {
            x: {
              title: { display: true, text: t('loggedTime') },
              grid: { color: themeMode === 'dark' ? '#2c2f38' : '#e5e5e5' },
            },
            y: {
              title: { display: true, text: t('member') },
              grid: { color: themeMode === 'dark' ? '#2c2f38' : '#e5e5e5' },
            },
          },
        },
        plugins: [ChartDataLabels],
      });

      exportChart.render();

      // Download
      const link = document.createElement('a');
      link.download = 'members-time-sheet.png';
      link.href = offscreenCanvas.toDataURL('image/png');
      link.click();

      // Cleanup
      exportChart.destroy();
    }, [jsonData, themeMode, t]);

    useImperativeHandle(ref, () => ({
      exportChart,
    }));

    // The height the chart canvas should be (visible portion only)
    const chartCanvasHeight = shouldVirtualize
      ? visibleData.length * BAR_HEIGHT
      : Math.max(totalCount * BAR_HEIGHT, 300);

    // Offset to position the chart correctly within the virtual scroll
    const chartOffsetTop = shouldVirtualize ? visibleStart * BAR_HEIGHT : 0;

    return (
      <div
        style={
          shouldVirtualize
            ? { position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }
            : { position: 'relative' }
        }
      >
        {/* Overlay, not a wrapping element — keeps the height:100% chain the
            virtualized layout above relies on intact, unlike wrapping the
            whole tree in <Spin>. Covers the stale/empty chart underneath
            while a fetch is in flight instead of flashing zeroed-out bars. */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: themeMode === 'dark' ? 'rgba(20, 20, 20, 0.55)' : 'rgba(255, 255, 255, 0.6)',
            }}
          >
            <Spin size="large" />
          </div>
        )}

        {totalCount === 0 && !loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 300,
            }}
          >
            <Empty
              description={t('noDataMatchingFilters', {
                defaultValue: 'No data matching the selected filters',
              })}
            />
          </div>
        ) : (
          <>
            {totalCount > 0 && (
          <div
            style={{
              flexShrink: 0,
              marginBottom: 12,
              fontSize: '14px',
              color: themeMode === 'dark' ? '#a0a0a0' : '#666',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              Displaying {totalCount} member{totalCount !== 1 ? 's' : ''}
              {shouldVirtualize && (
                <span style={{ marginLeft: 8, fontSize: '12px', opacity: 0.7 }}>
                  (showing {visibleStart + 1}–{Math.min(visibleEnd, totalCount)} in view)
                </span>
              )}
            </span>
          </div>
        )}

        {shouldVirtualize ? (
          /* Virtualized rendering for large datasets — availableSpaceRef fills
             the remaining height the surrounding layout gives this component,
             which is what the ResizeObserver above measures into
             containerHeight, so the scroll box below matches it exactly. */
          <div ref={availableSpaceRef} style={{ flex: 1, minHeight: 0 }}>
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{
                width: '100%',
                height: `${viewportHeight}px`,
                overflowY: 'auto',
                overflowX: 'hidden',
                position: 'relative',
              }}
            >
              {/* Spacer div to create the full scrollable height */}
              <div style={{ height: `${totalVirtualHeight}px`, position: 'relative' }}>
                {/* Chart positioned at the correct offset within the virtual space */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${chartOffsetTop}px`,
                    left: 0,
                    right: 0,
                    height: `${chartCanvasHeight}px`,
                  }}
                >
                  <Bar data={data} options={options} ref={chartRef} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Standard rendering for small datasets */
          <div
            style={{
              width: '100%',
              height: `${chartCanvasHeight}px`,
              overflowX: 'hidden',
            }}
          >
            <Bar data={data} options={options} ref={chartRef} />
          </div>
        )}
          </>
        )}
      </div>
    );
  }
);

MembersTimeSheet.displayName = 'MembersTimeSheet';

export default MembersTimeSheet;
