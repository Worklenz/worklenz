import React, { Suspense } from 'react';
import { Spin } from '@/shared/antd-imports';

// Lazy load chart components to reduce initial bundle size
const LazyBar = React.lazy(() =>
  import('react-chartjs-2').then(module => ({ default: module.Bar }))
);
const LazyDoughnut = React.lazy(() =>
  import('react-chartjs-2').then(module => ({ default: module.Doughnut }))
);

interface ChartLoaderProps {
  type: 'bar' | 'doughnut';
  data: any;
  options?: any;
  [key: string]: any;
}

const ChartLoader: React.FC<ChartLoaderProps> = ({ type, ...props }) => {
  const ChartComponent = type === 'bar' ? LazyBar : LazyDoughnut;

  return (
    <Suspense fallback={<Spin size="large" />}>
      <ChartComponent {...props} />
    </Suspense>
  );
};

export default ChartLoader;
