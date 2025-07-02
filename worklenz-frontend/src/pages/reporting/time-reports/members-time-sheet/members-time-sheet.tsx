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
import { useAppDispatch } from '@/hooks/useAppDispatch';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

export interface MembersTimeSheetRef {
  exportChart: () => void;
}

const MembersTimeSheet = forwardRef<MembersTimeSheetRef>((_, ref) => {
  const { t } = useTranslation('time-report');
  const dispatch = useAppDispatch();
  const chartRef = React.useRef<ChartJS<'bar', string[], unknown>>(null);

  const {
    teams,
    loadingTeams,
    categories,
    loadingCategories,
    projects: filterProjects,
    loadingProjects,
    billable,
    archived,
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
  const colors = Array.isArray(jsonData) ? jsonData.map(item => item.color_code) : [];

  const themeMode = useAppSelector(state => state.themeReducer.mode);

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
      },
      legend: {
        display: false,
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const idx = context.dataIndex;
            const member = jsonData[idx];
            const hours = member?.utilized_hours || '0.00';
            const percent = member?.utilization_percent || '0.00';
            const overUnder = member?.over_under_utilized_hours || '0.00';
            return [
              `${context.dataset.label}: ${hours} h`,
              `Utilization: ${percent}%`,
              `Over/Under Utilized: ${overUnder} h`,
            ];
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

      const body = {
        teams: selectedTeams.map(t => t.id),
        projects: selectedProjects.map(project => project.id),
        categories: selectedCategories.map(category => category.id),
        duration,
        date_range: dateRange,
        billable,
      };

      const res = await reportingTimesheetApiService.getMemberTimeSheets(body, archived);
      if (res.done) {
        setJsonData(res.body || []);
      }
    } catch (error) {
      logger.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [dispatch, duration, dateRange, billable, archived, teams, filterProjects, categories]);

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
});

MembersTimeSheet.displayName = 'MembersTimeSheet';

export default MembersTimeSheet;
