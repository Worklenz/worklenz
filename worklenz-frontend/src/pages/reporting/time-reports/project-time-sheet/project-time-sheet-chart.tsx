import React, { useEffect, useState, forwardRef, useImperativeHandle, lazy, Suspense } from 'react';
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
import { Empty, Spin } from '@/shared/antd-imports';
import logger from '@/utils/errorLogger';

// Lazy load the Bar chart component
const LazyBarChart = lazy(() =>
  import('react-chartjs-2').then(module => ({ default: module.Bar }))
);

// Chart loading fallback
const ChartLoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '400px',
      background: '#fafafa',
      borderRadius: '8px',
      border: '1px solid #f0f0f0',
    }}
  >
    <Spin size="large" />
  </div>
);

// Register Chart.js components only when needed
let isChartJSRegistered = false;
const registerChartJS = () => {
  if (!isChartJSRegistered) {
    ChartJS.register(
      CategoryScale,
      LinearScale,
      BarElement,
      Title,
      Tooltip,
      Legend,
      ChartDataLabels
    );
    isChartJSRegistered = true;
  }
};

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
  const [chartReady, setChartReady] = useState(false);
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

  // Initialize chart when component mounts
  useEffect(() => {
    const initChart = () => {
      registerChartJS();
      setChartReady(true);
    };

    // Use requestIdleCallback to defer chart initialization
    if ('requestIdleCallback' in window) {
      requestIdleCallback(initChart, { timeout: 1000 });
    } else {
      setTimeout(initChart, 500);
    }
  }, []);

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
    if (!loadingTeams && !loadingProjects && !loadingCategories && chartReady) {
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
    chartReady,
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
      link.download = 'project-time-sheet-chart.png';
      link.href = tempCanvas.toDataURL();
      link.click();
    }
  };

  useImperativeHandle(ref, () => ({
    exportChart,
  }));

  if (loading) {
    return (
      <div style={{ minHeight: MIN_HEIGHT }}>
        <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
      </div>
    );
  }

  if (!Array.isArray(jsonData) || jsonData.length === 0) {
    return (
      <div style={{ minHeight: MIN_HEIGHT }}>
        <Empty description={t('noDataAvailable')} />
      </div>
    );
  }

  const chartHeight = jsonData.length * (BAR_THICKNESS + 10) + 100;
  const containerHeight = Math.max(chartHeight, 400);

  return (
    <div style={{ minHeight: MIN_HEIGHT }}>
      <div style={{ height: `${containerHeight}px`, width: '100%' }}>
        {chartReady ? (
          <Suspense fallback={<ChartLoadingFallback />}>
            <LazyBarChart data={data} options={options} ref={chartRef} />
          </Suspense>
        ) : (
          <ChartLoadingFallback />
        )}
      </div>
      <ProjectTimeLogDrawer />
    </div>
  );
});

ProjectTimeSheetChart.displayName = 'ProjectTimeSheetChart';

export default ProjectTimeSheetChart;
