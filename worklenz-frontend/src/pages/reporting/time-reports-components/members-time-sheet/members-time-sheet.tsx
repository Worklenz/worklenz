import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
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
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { reportingTimesheetApiService } from '@/api/reporting/reporting.timesheet.api.service';
import { IRPTTimeMember } from '@/types/reporting/reporting.types';
import logger from '@/utils/errorLogger';
import { format } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

interface MembersTimeSheetProps {
  onTotalsUpdate: (totals: {
    total_time_logs: string;
    total_estimated_hours: string;
    total_utilization: string;
  }) => void;
}
export interface MembersTimeSheetRef {
  exportChart: () => void;
}

const MembersTimeSheet = forwardRef<MembersTimeSheetRef, MembersTimeSheetProps>(
  ({ onTotalsUpdate }, ref) => {
    const { t } = useTranslation('time-report');
    const chartRef = React.useRef<ChartJS<'bar', string[], unknown>>(null);

    const {
      teams,
      loadingTeams,
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
    } = useAppSelector(state => state.timeReportsOverviewReducer);
    const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

    const [loading, setLoading] = useState(false);
    const [jsonData, setJsonData] = useState<IRPTTimeMember[]>([]);

    const labels = Array.isArray(jsonData) ? jsonData.map(item => item.name) : [];
    const dataValues = Array.isArray(jsonData)
      ? jsonData.map(item => {
          const loggedTimeInHours = parseFloat(item.logged_time || '0') / 3600;
          return loggedTimeInHours.toFixed(2);
        })
      : [];
    const colors = Array.isArray(jsonData)
      ? jsonData.map(item => {
          const utilizationPercent = parseFloat(item.utilization_percent || '0');

          if (utilizationPercent < 90) {
            return '#faad14'; // Orange for under-utilized (< 90%)
          } else if (utilizationPercent <= 110) {
            return '#52c41a'; // Green for optimal utilization (90-110%)
          } else {
            return '#ef4444'; // Red for over-utilized (> 110%)
          }
        })
      : [];

    const themeMode = useAppSelector(state => state.themeReducer.mode);

    // Helper function to format hours to "X hours Y mins"
    const formatHours = (decimalHours: number) => {
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
    };

    // Chart data
    const data = {
      labels,
      datasets: [
        {
          label: t('loggedTime'),
          data: dataValues,
          backgroundColor: colors,
          barThickness: 40,
        },
      ],
    };

    // Chart options
    const options = {
      maintainAspectRatio: false,
      plugins: {
        datalabels: {
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
        },
        legend: {
          display: false,
          position: 'top' as const,
        },
        tooltip: {
          // Basic styling
          backgroundColor: themeMode === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          titleColor: themeMode === 'dark' ? '#ffffff' : '#000000',
          bodyColor: themeMode === 'dark' ? '#ffffff' : '#000000',
          borderColor: themeMode === 'dark' ? '#4a5568' : '#e2e8f0',
          cornerRadius: 8,
          padding: 12,

          // Remove colored squares
          displayColors: false,

          // Positioning - better alignment for horizontal bar chart
          xAlign: 'left' as const,
          yAlign: 'center' as const,

          callbacks: {
            // Customize the title (member name)
            title: function (context: any) {
              const idx = context[0].dataIndex;
              const member = jsonData[idx];
              return `👤 ${member?.name || 'Unknown Member'}`;
            },

            // Customize the label content
            label: function (context: any) {
              const idx = context.dataIndex;
              const member = jsonData[idx];
              const hours = parseFloat(member?.utilized_hours || '0');
              const percent = parseFloat(member?.utilization_percent || '0.00');
              const overUnder = parseFloat(member?.over_under_utilized_hours || '0');

              // Color indicators based on utilization state
              let statusText = '';
              let criteriaText = '';
              switch (member.utilization_state) {
                case 'under':
                  statusText = '🟠 Under-Utilized';
                  criteriaText = '(< 90%)';
                  break;
                case 'optimal':
                  statusText = '🟢 Optimally Utilized';
                  criteriaText = '(90% - 110%)';
                  break;
                case 'over':
                  statusText = '🔴 Over-Utilized';
                  criteriaText = '(> 110%)';
                  break;
                default:
                  statusText = '⚪ Unknown';
                  criteriaText = '';
              }

              return [
                `⏱️ ${context.dataset.label}: ${formatHours(hours)}`,
                `📊 Utilization: ${percent.toFixed(1)}%`,
                `${statusText} ${criteriaText}`,
                `📈 Variance: ${formatHours(Math.abs(overUnder))}${overUnder < 0 ? ' (under)' : overUnder > 0 ? ' (over)' : ''}`,
              ];
            },

            // Add a footer with additional info
            footer: function (context: any) {
              const idx = context[0].dataIndex;
              const member = jsonData[idx];
              const loggedTime = parseFloat(member?.logged_time || '0') / 3600;
              return `📊 Total Logged: ${formatHours(loggedTime)}`;
            },
          },
        },
      },
      backgroundColor: 'black',
      indexAxis: 'y' as const,
      responsive: true,
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
    };

    const fetchChartData = async () => {
      try {
        setLoading(true);

        const selectedTeams = teams.filter(team => team.selected);
        const selectedProjects = filterProjects.filter(project => project.selected);
        const selectedCategories = categories.filter(category => category.selected);
        const selectedMembers = members.filter(member => member.selected);
        const selectedUtilization = utilization.filter(item => item.selected);

        // Format dates using date-fns
        const formattedDateRange = dateRange
          ? [
              format(new Date(dateRange[0]), 'yyyy-MM-dd'),
              format(new Date(dateRange[1]), 'yyyy-MM-dd'),
            ]
          : undefined;

        const body = {
          teams: selectedTeams.map(t => t.id),
          projects: selectedProjects.map(project => project.id),
          categories: selectedCategories.map(category => category.id),
          members: selectedMembers.map(member => member.id),
          utilization: selectedUtilization.map(item => item.id),
          duration,
          date_range: formattedDateRange,
          billable,
          noCategory,
        };

        const res = await reportingTimesheetApiService.getMemberTimeSheets(body, archived);

        if (res.done) {
          // Ensure filteredRows is always an array, even if API returns null/undefined
          setJsonData(res.body?.filteredRows || []);

          const totalsRaw = res.body?.totals || {};
          const totals = {
            total_time_logs: totalsRaw.total_time_logs ?? '0',
            total_estimated_hours: totalsRaw.total_estimated_hours ?? '0',
            total_utilization: totalsRaw.total_utilization ?? '0',
          };
          onTotalsUpdate(totals);
        } else {
          // Handle API error case
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
        // Reset data on error
        setJsonData([]);
        onTotalsUpdate({
          total_time_logs: '0',
          total_estimated_hours: '0',
          total_utilization: '0',
        });
      } finally {
        setLoading(false);
      }
    };

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

    useEffect(() => {
      fetchChartData();
    }, [
      duration,
      dateRange,
      billable,
      archived,
      noCategory,
      selectedTeamIds,
      selectedProjectIds,
      selectedCategoryIds,
      selectedMemberIds,
      selectedUtilizationIds,
    ]);

    const exportChart = () => {
      if (chartRef.current) {
        // Get the canvas element
        const canvas = chartRef.current.canvas;

        // Create a temporary canvas to draw with background
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        // Set dimensions
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;

        // Fill background based on theme
        tempCtx.fillStyle = themeMode === 'dark' ? '#1f1f1f' : '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw the original chart on top
        tempCtx.drawImage(canvas, 0, 0);

        // Create download link
        const link = document.createElement('a');
        link.download = 'members-time-sheet.png';
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
      }
    };

    useImperativeHandle(ref, () => ({
      exportChart,
    }));

    return (
      <div style={{ position: 'relative' }}>
        <div
          style={{
            maxWidth: 'calc(100vw - 220px)',
            minWidth: 'calc(100vw - 260px)',
            minHeight: 'calc(100vh - 300px)',
            height: `${60 * data.labels.length}px`,
          }}
        >
          <Bar data={data} options={options} ref={chartRef} />
        </div>
      </div>
    );
  }
);

MembersTimeSheet.displayName = 'MembersTimeSheet';

export default MembersTimeSheet;
