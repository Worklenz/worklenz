import { lazy, Suspense } from 'react';
import { Spin } from '@/shared/antd-imports';

// Lazy load Chart.js components
const LazyBarChart = lazy(() => 
  import('react-chartjs-2').then(module => ({ default: module.Bar }))
);

const LazyLineChart = lazy(() => 
  import('react-chartjs-2').then(module => ({ default: module.Line }))
);

const LazyPieChart = lazy(() => 
  import('react-chartjs-2').then(module => ({ default: module.Pie }))
);

const LazyDoughnutChart = lazy(() => 
  import('react-chartjs-2').then(module => ({ default: module.Doughnut }))
);

// Lazy load Gantt components
const LazyGanttChart = lazy(() => 
  import('gantt-task-react').then(module => ({ default: module.Gantt }))
);

// Chart loading fallback
const ChartLoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '300px',
    background: '#fafafa',
    borderRadius: '8px',
    border: '1px solid #f0f0f0'
  }}>
    <Spin size="large" />
  </div>
);

// Wrapped components with Suspense
export const BarChart = (props: any) => (
  <Suspense fallback={<ChartLoadingFallback />}>
    <LazyBarChart {...props} />
  </Suspense>
);

export const LineChart = (props: any) => (
  <Suspense fallback={<ChartLoadingFallback />}>
    <LazyLineChart {...props} />
  </Suspense>
);

export const PieChart = (props: any) => (
  <Suspense fallback={<ChartLoadingFallback />}>
    <LazyPieChart {...props} />
  </Suspense>
);

export const DoughnutChart = (props: any) => (
  <Suspense fallback={<ChartLoadingFallback />}>
    <LazyDoughnutChart {...props} />
  </Suspense>
);

export const GanttChart = (props: any) => (
  <Suspense fallback={<ChartLoadingFallback />}>
    <LazyGanttChart {...props} />
  </Suspense>
);

// Hook to preload chart libraries when needed
export const usePreloadCharts = () => {
  const preloadCharts = () => {
    // Preload Chart.js
    import('react-chartjs-2');
    import('chart.js');
    
    // Preload Gantt
    import('gantt-task-react');
  };

  return { preloadCharts };
}; 