import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, ChartOptions } from 'chart.js';
import { Badge, Card, Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { IRPTOverviewMemberChartData } from '@/types/reporting/reporting.types';

Chart.register(ArcElement, Tooltip);

interface MembersReportsStatusGraphProps {
  model: IRPTOverviewMemberChartData | undefined;
  loading: boolean;
}

const MembersReportsStatusGraph = ({ model, loading }: MembersReportsStatusGraphProps) => {
  // localization
  const { t } = useTranslation('reporting-members-drawer');

  // chart data
  const chartData = {
    labels: model?.chart.map(item => t(`${item.name.toLowerCase()}Text`)),
    datasets: [
      {
        label: t('tasksText'),
        data: model?.chart.map(item => item.y),
        backgroundColor: model?.chart.map(item => item.color),
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
        position: 'top' as const,
      },
      datalabels: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: context => {
            const value = context.raw as number;
            return `${context.label}: ${value} task${value !== 1 ? 's' : ''}`;
          },
        },
      },
    },
  };

  return (
    <Card
      loading={loading}
      title={
        <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
          {t('tasksByStatusText')}
        </Typography.Text>
      }
    >
      <div className="flex items-start gap-6">
        <div className="shrink-0" style={{ width: 160, height: 160 }}>
          <Doughnut
            data={chartData}
            options={options}
            style={{ width: 160, height: 160 }}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          {/* total tasks */}
          <Flex gap={4} align="center" className="min-w-0">
            <Badge color="#a9a9a9" className="shrink-0" />
            <Typography.Text ellipsis={{ tooltip: `${t('allText')} (${model?.total})` }} className="min-w-0 flex-1">
              {t('allText')} ({model?.total})
            </Typography.Text>
          </Flex>

          {/* status-specific tasks — scrollable after 10 items */}
          <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
            <div className="flex flex-col gap-2">
              {model?.chart.map(item => (
                <Flex key={item.name} gap={4} align="center" className="min-w-0">
                  <Badge color={item.color} className="shrink-0" />
                  <Typography.Text ellipsis={{ tooltip: `${t(`${item.name.toLowerCase()}Text`)} (${item.y})` }} className="min-w-0 flex-1">
                    {t(`${item.name.toLowerCase()}Text`)} ({item.y})
                  </Typography.Text>
                </Flex>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MembersReportsStatusGraph;
