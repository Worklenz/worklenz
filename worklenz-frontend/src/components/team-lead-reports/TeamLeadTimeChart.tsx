import React, { useEffect, forwardRef, useImperativeHandle } from 'react';
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
import { useTranslation } from 'react-i18next';
import { TimeLogsSummary } from '@/api/team-lead-reports/team-lead-reports.api.service';
import { theme } from '@/shared/antd-imports';
import { formatSecondsToPaddedHoursMinutes } from '@/utils/time-format.utils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

interface TeamLeadTimeChartProps {
  dateRange: [string, string] | null;
  chartData: TimeLogsSummary[];
  loading?: boolean;
  onTotalsUpdate: (totals: {
    total_time_logs: string;
    total_estimated_hours: string;
    total_utilization: string;
  }) => void;
}

export interface TeamLeadTimeChartRef {
  exportChart: () => void;
}

const TeamLeadTimeChart = forwardRef<TeamLeadTimeChartRef, TeamLeadTimeChartProps>(
  ({ dateRange, chartData, loading = false, onTotalsUpdate }, ref) => {
    const { t } = useTranslation('team-lead-reports');
    const { token } = theme.useToken();
    const chartRef = React.useRef<ChartJS<'bar', string[], unknown>>(null);

    // Helper function to format time duration
    const formatDuration = (seconds: number | string | null | undefined) => {
      const numSeconds = typeof seconds === 'number' ? seconds : parseFloat(seconds as string) || 0;
      return formatSecondsToPaddedHoursMinutes(numSeconds);
    };

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

    const labels = Array.isArray(chartData) ? chartData.map(item => item.managed_member_name) : [];
    const dataValues = Array.isArray(chartData)
      ? chartData.map(item => {
          const loggedTimeInHours = parseFloat(item.total_time_minutes?.toString() || '0') / 3600;
          return loggedTimeInHours.toFixed(2);
        })
      : [];

    // Color coding based on activity level
    const colors = Array.isArray(chartData)
      ? chartData.map(item => {
          const hours = parseFloat(item.total_time_minutes?.toString() || '0') / 3600;
          const logsCount = item.total_logs || 0;

          // Color based on activity level
          if (hours === 0 || logsCount === 0) {
            return '#d9d9d9'; // Gray for no activity
          } else if (hours < 8) {
            return '#faad14'; // Orange for low activity
          } else if (hours <= 40) {
            return '#52c41a'; // Green for normal activity
          } else {
            return '#1890ff'; // Blue for high activity
          }
        })
      : [];

    // Chart data
    const data = {
      labels,
      datasets: [
        {
          label: t('timeTracking.loggedTime', { defaultValue: 'Logged Time' }),
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
            return formatHours(hours);
          },
        },
        legend: {
          display: false,
          position: 'top' as const,
        },
        tooltip: {
          // Basic styling
          backgroundColor: token.colorBgElevated,
          titleColor: token.colorText,
          bodyColor: token.colorText,
          borderColor: token.colorBorder,
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
              const member = chartData[idx];
              return `👤 ${member?.managed_member_name || 'Unknown Member'}`;
            },

            // Customize the label content
            label: function (context: any) {
              const idx = context.dataIndex;
              const member = chartData[idx];
              const hours = parseFloat(member?.total_time_minutes?.toString() || '0') / 3600;
              const logsCount = member?.total_logs || 0;
              const projectsCount = member?.projects_worked_on || 0;
              const activeDays = member?.days_logged || 0;

              return [
                `⏱️ ${context.dataset.label}: ${formatHours(hours)}`,
                `📊 Total Logs: ${logsCount}`,
                `📁 Projects: ${projectsCount}`,
                `📅 Active Days: ${activeDays}`,
              ];
            },

            // Add a footer with additional info
            footer: function (context: any) {
              const idx = context[0].dataIndex;
              const member = chartData[idx];
              const lastActivity = member?.last_log_date;
              return lastActivity
                ? `📅 Last Activity: ${new Date(lastActivity).toLocaleDateString()}`
                : '';
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
            text: t('timeTracking.loggedTime', { defaultValue: 'Logged Time (Hours)' }),
            align: 'end' as const,
            font: {
              family: 'Helvetica',
            },
          },
          grid: {
            color: token.colorBorderSecondary,
            lineWidth: 1,
          },
        },
        y: {
          title: {
            display: true,
            text: t('timeTracking.teamMembers', { defaultValue: 'Team Members' }),
            align: 'end' as const,
            font: {
              family: 'Helvetica',
            },
          },
          grid: {
            color: token.colorBorderSecondary,
            lineWidth: 1,
          },
        },
      },
    };

    // Note: Totals are now calculated by the backend and passed from parent
    // This component doesn't need to calculate totals anymore

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
        tempCtx.fillStyle = token.colorBgContainer;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw the original chart on top
        tempCtx.drawImage(canvas, 0, 0);

        // Create download link
        const link = document.createElement('a');
        link.download = 'team-lead-time-chart.png';
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
            height: `${Math.max(60 * data.labels.length, 300)}px`,
          }}
        >
          <Bar data={data} options={options} ref={chartRef} />
        </div>
      </div>
    );
  }
);

TeamLeadTimeChart.displayName = 'TeamLeadTimeChart';

export default TeamLeadTimeChart;
