import React from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { theme } from '@/shared/antd-imports';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export interface ChartDatum {
  label: string;
  value: number;
  color: string;
}

/** Lazy-loaded by ChartWidgets so Chart.js stays out of the main bundle. Colours come from the active antd theme. */
export const OverviewDoughnut = ({ data, ariaLabel }: { data: ChartDatum[]; ariaLabel: string }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ height: 200 }}>
      <Doughnut
        aria-label={ariaLabel}
        role="img"
        data={{
          labels: data.map(d => d.label),
          datasets: [
            {
              data: data.map(d => d.value),
              backgroundColor: data.map(d => d.color),
              borderColor: token.colorBgContainer,
              borderWidth: 2,
            },
          ],
        }}
        options={{
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: { legend: { position: 'right', labels: { color: token.colorText, boxWidth: 12 } } },
        }}
      />
    </div>
  );
};

export const OverviewBars = ({ data, ariaLabel }: { data: ChartDatum[]; ariaLabel: string }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ height: 200 }}>
      <Bar
        aria-label={ariaLabel}
        role="img"
        data={{
          labels: data.map(d => d.label),
          datasets: [{ data: data.map(d => d.value), backgroundColor: data.map(d => d.color), borderRadius: 4 }],
        }}
        options={{
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: token.colorTextSecondary }, grid: { display: false } },
            y: {
              beginAtZero: true,
              ticks: { color: token.colorTextSecondary, precision: 0 },
              grid: { color: token.colorBorderSecondary },
            },
          },
        }}
      />
    </div>
  );
};
