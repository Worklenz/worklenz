import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
  ChartData,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { IRPTTimeProject } from '@/types/reporting/reporting.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import logger from '@/utils/errorLogger';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { reportingTimesheetApiService } from '@/api/reporting/reporting.timesheet.api.service';

// Project color palette
const PROJECT_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEEAD',
  '#D4A5A5',
  '#9B59B6',
  '#3498DB',
  '#F1C40F',
  '#1ABC9C',
];

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

enum IToggleOptions {
  'WORKING_DAYS',
  'MAN_DAYS',
}

export interface EstimatedVsActualTimeSheetRef {
  exportChart: () => void;
}

interface IEstimatedVsActualTimeSheetProps {
  type: string;
}

const EstimatedVsActualTimeSheet = forwardRef<
  EstimatedVsActualTimeSheetRef,
  IEstimatedVsActualTimeSheetProps
>(({ type }, ref) => {
  const chartRef = useRef<any>(null);

  // State for filters and data
  const [jsonData, setJsonData] = useState<IRPTTimeProject[]>([]);
  const [loading, setLoading] = useState(false);

  const [chartHeight, setChartHeight] = useState(600);
  const [chartWidth, setChartWidth] = useState(1080);

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const {
    teams,
    loadingTeams,
    categories,
    loadingCategories,
    noCategory,
    projects: filterProjects,
    loadingProjects,
    billable,
    archived,
  } = useAppSelector(state => state.timeReportsOverviewReducer);
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

  // Add type checking before mapping
  const labels = Array.isArray(jsonData) ? jsonData.map(item => item.name) : [];
  const actualDays = Array.isArray(jsonData)
    ? jsonData.map(item => {
        const value = item.value ? parseFloat(item.value) : 0;
        return (isNaN(value) ? 0 : value).toString();
      })
    : [];
  const estimatedDays = Array.isArray(jsonData)
    ? jsonData.map(item => {
        const value = item.estimated_value ? parseFloat(item.estimated_value) : 0;
        return (isNaN(value) ? 0 : value).toString();
      })
    : [];

  // Format date helper
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get project color
  const getProjectColor = (index: number): string => {
    return PROJECT_COLORS[index % PROJECT_COLORS.length];
  };

  // Chart data with colors
  const data = {
    labels,
    datasets: [
      {
        label: 'Estimated Days',
        data: estimatedDays,
        backgroundColor: jsonData.map((_, index) => getProjectColor(index) + '80'), // 80 for opacity
        barThickness: 50,
      },
      {
        label: 'Actual Days',
        data: actualDays,
        backgroundColor: jsonData.map((_, index) => getProjectColor(index)),
        barThickness: 50,
      },
    ],
  };

  // Chart options
  const options = {
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          footer: (items: any[]) => {
            if (items.length > 0) {
              const project = jsonData[items[0].dataIndex];
              if (project.end_date) {
                const endDate = new Date(project.end_date);
                return 'Ends On: ' + formatDate(endDate);
              }
            }
            return '';
          },
        },
      },
      datalabels: {
        color: 'white',
        anchor: 'start' as const,
        align: 'start' as const,
        offset: -30,
        borderColor: '#000',
        textStrokeColor: 'black',
        textStrokeWidth: 4,
      },
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        title: {
          display: true,
          text: 'Project',
          align: 'end' as const,
          font: {
            family: 'Helvetica',
          },
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          padding: 5,
          font: {
            size: 11,
          },
        },
      },
      y: {
        type: 'linear' as const,
        title: {
          display: true,
          text: 'Days',
          align: 'end' as const,
          font: {
            family: 'Helvetica',
          },
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
        type: type === 'WORKING_DAYS' ? 'WORKING_DAYS' : 'MAN_DAYS',
        teams: selectedTeams.map(t => t.id),
        categories: selectedCategories.map(c => c.id),
        selectNoCategory: noCategory,
        projects: selectedProjects.map(p => p.id),
        duration: duration,
        date_range: dateRange,
        billable,
      };
      const res = await reportingTimesheetApiService.getProjectEstimatedVsActual(body, archived);
      if (res.done) {
        // Ensure res.body is an array before setting it
        const dataArray = Array.isArray(res.body) ? res.body : [];
        setJsonData(dataArray);

        // Update chart dimensions based on data
        if (dataArray.length) {
          const containerWidth = window.innerWidth - 300;
          const virtualWidth = dataArray.length * 120;
          setChartWidth(virtualWidth > containerWidth ? virtualWidth : window.innerWidth - 250);
        }
      }
    } catch (error) {
      logger.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setChartHeight(window.innerHeight - 300);
    fetchChartData();
  }, [
    teams,
    categories,
    filterProjects,
    duration,
    dateRange,
    billable,
    archived,
    type,
    noCategory,
  ]);

  const exportChart = () => {
    if (chartRef.current) {
      // Get the canvas element
      const canvas = chartRef.current.canvas;

      // Create a temporary canvas to draw with background
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        console.error('Failed to get canvas context');
        return;
      }

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
      link.download = 'estimated-vs-actual-time-sheet.png';
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
    } else {
      console.error('Chart ref is null');
    }
  };

  useImperativeHandle(ref, () => ({
    exportChart,
  }));

  return (
    <div style={{ position: 'relative' }}>
      {/* Outer container with fixed width */}
      <div
        style={{
          width: '100%',
          position: 'relative',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        {/* Chart container */}
        <div
          style={{
            width: `${chartWidth}px`,
            height: `${chartHeight}px`,
            minWidth: 'max-content',
          }}
        >
          <Bar
            ref={chartRef}
            data={data}
            options={options}
            width={chartWidth}
            height={chartHeight}
          />
        </div>
      </div>
    </div>
  );
});

EstimatedVsActualTimeSheet.displayName = 'EstimatedVsActualTimeSheet';

export default EstimatedVsActualTimeSheet;
