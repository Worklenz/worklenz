import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, BarElement, CategoryScale, LinearScale } from 'chart.js';
import { ChartOptions } from 'chart.js';
import { Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

Chart.register(BarElement, CategoryScale, LinearScale);

type EstimatedVsActualCellProps = {
  actualTime: number | null;
  actualTimeString: string | null;
  estimatedTime: number | null;
  estimatedTimeString: string | null;
};

const EstimatedVsActualCell = ({
  actualTime,
  actualTimeString,
  estimatedTime,
  estimatedTimeString,
}: EstimatedVsActualCellProps) => {
  const { t } = useTranslation('reporting-projects');

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    scales: {
      x: {
        display: false,
      },
      y: {
        display: false,
      },
    },
    plugins: {
      legend: {
        display: false,
        position: 'top' as const,
      },
      datalabels: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
  };

  // data for the chart
  const graphData = {
    labels: [t('estimatedText'), t('actualText')],
    datasets: [
      {
        data: [estimatedTime, actualTime],
        backgroundColor: ['#7a84df', '#c191cc'],
        barThickness: 15,
        height: 29,
      },
    ],
  };

  return (
    <div>
      {actualTime || estimatedTime ? (
        <div style={{ position: 'relative', width: '100%', maxWidth: '200px' }}>
          <Bar options={options} data={graphData} style={{ maxHeight: 39 }} />
          <Typography.Text
            style={{
              position: 'absolute',
              fontSize: 12,
              fontWeight: 500,
              left: 8,
              top: 1,
            }}
          >{`${t('estimatedText')}: ${estimatedTimeString}`}</Typography.Text>
          <Typography.Text
            style={{
              position: 'absolute',
              fontSize: 12,
              fontWeight: 500,
              left: 8,
              top: 20,
            }}
          >{`${t('actualText')}: ${actualTimeString}`}</Typography.Text>
        </div>
      ) : (
        <Typography.Text>-</Typography.Text>
      )}
    </div>
  );
};

export default EstimatedVsActualCell;
