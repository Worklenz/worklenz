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
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { setLabelAndToggleDrawer } from '../../../../features/timeReport/projects/timeLogSlice';
import ProjectTimeLogDrawer from '../../../../features/timeReport/projects/ProjectTimeLogDrawer';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { reportingTimesheetApiService } from '@/api/reporting/reporting.timesheet.api.service';
import { IRPTTimeProject } from '@/types/reporting/reporting.types';
import { Empty, Spin } from 'antd';
import logger from '@/utils/errorLogger';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

const BAR_THICKNESS = 40;
const STROKE_WIDTH = 4;
const MIN_HEIGHT = 'calc(100vh - 300px)';
const SIDEBAR_WIDTH = 220;

export interface ProjectTimeSheetChartRef {
  exportChart: () => void;
}

const ProjectTimeSheetChart = forwardRef<ProjectTimeSheetChartRef>((_, ref) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('time-report');
  const [jsonData, setJsonData] = useState<IRPTTimeProject[]>([]);
  const [loading, setLoading] = useState(false);
  const chartRef = React.useRef<ChartJS<'bar', string[], unknown>>(null);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
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

  const handleBarClick = (event: any, elements: any) => {
    if (elements.length > 0) {
      const elementIndex = elements[0].index;
      const label = jsonData[elementIndex];
      if (label) {
        dispatch(setLabelAndToggleDrawer(label));
      }
    }
  };

  const data = {
    labels: Array.isArray(jsonData) ? jsonData.map(item => item?.name || '') : [],
    datasets: [
      {
        label: t('loggedTime'),
        data: Array.isArray(jsonData)
          ? jsonData.map(item => {
              const loggedTime = item?.logged_time || '0';
              const loggedTimeInHours = parseFloat(loggedTime) / 3600;
              return loggedTimeInHours.toFixed(2);
            })
          : [],
        backgroundColor: Array.isArray(jsonData)
          ? jsonData.map(item => item?.color_code || '#000000')
          : [],
        barThickness: BAR_THICKNESS,
      },
    ],
  };

  const options = {
    maintainAspectRatio: false,
    plugins: {
      datalabels: {
        color: 'white',
        anchor: 'start' as const,
        align: 'right' as const,
        offset: 20,
        textStrokeColor: 'black',
        textStrokeWidth: STROKE_WIDTH,
      },
      legend: {
        display: false,
        position: 'top' as const,
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
          text: t('projects'),
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
    // onClick: handleBarClick,
  };

  const fetchChartData = async () => {
    try {
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

      const res = await reportingTimesheetApiService.getProjectTimeSheets(body, archived);
      if (res.done) {
        setJsonData(res.body || []);
      }
    } catch (error) {
      logger.error('Error fetching chart data:', error);
    }
  };

  useEffect(() => {
    if (!loadingTeams && !loadingProjects && !loadingCategories) {
      setLoading(true);
      fetchChartData().finally(() => {
        setLoading(false);
      });
    }
  }, [
    teams,
    filterProjects,
    categories,
    duration,
    dateRange,
    billable,
    archived,
    loadingTeams,
    loadingProjects,
    loadingCategories,
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
      link.download = 'project-time-sheet.png';
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
    }
  };

  useImperativeHandle(ref, () => ({
    exportChart,
  }));

  // if (loading) {
  //   return (
  //     <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
  //       <Spin />
  //     </div>
  //   );
  // }

  return (
    <div>
      <div
        style={{
          maxWidth: `calc(100vw - ${SIDEBAR_WIDTH}px)`,
          minWidth: 'calc(100vw - 260px)',
          minHeight: MIN_HEIGHT,
          height: `${60 * data.labels.length}px`,
        }}
      >
        <Bar data={data} options={options} ref={chartRef} />
      </div>
      <ProjectTimeLogDrawer />
    </div>
  );
});

ProjectTimeSheetChart.displayName = 'ProjectTimeSheetChart';

export default ProjectTimeSheetChart;
