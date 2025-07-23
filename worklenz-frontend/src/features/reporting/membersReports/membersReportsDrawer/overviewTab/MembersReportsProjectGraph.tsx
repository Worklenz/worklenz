import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip } from 'chart.js';
import { Badge, Card, Flex, Typography, Tooltip as AntTooltip } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { IRPTOverviewMemberChartData } from '@/types/reporting/reporting.types';

Chart.register(ArcElement, Tooltip);

interface MembersReportsProjectGraphProps {
  model: IRPTOverviewMemberChartData | undefined;
  loading: boolean;
}

const MembersReportsProjectGraph = ({ model, loading }: MembersReportsProjectGraphProps) => {
  // localization
  const { t } = useTranslation('reporting-members-drawer');

  // chart data
  const chartData = {
    labels: model?.chart.map(item => item.name),
    datasets: [
      {
        label: t('tasksText'),
        data: model?.chart.map(item => item.y),
        backgroundColor: model?.chart.map(item => item.color),
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
        position: 'top' as const,
      },
      datalabels: {
        display: false,
      },
    },
  };

  return (
    <Card
      loading={loading}
      title={
        <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
          {t('tasksByProjectsText')}
        </Typography.Text>
      }
    >
      <div className="flex flex-wrap items-center justify-center gap-6 xl:flex-nowrap">
        <Doughnut
          data={chartData}
          options={options}
          className="max-h-[200px] w-full max-w-[200px]"
        />

        <div className="flex flex-row flex-wrap gap-3 xl:flex-col">
          {/* total tasks */}
          <Flex gap={4} align="center">
            <Badge color="#000" />
            <Typography.Text ellipsis>
              {t('allText')} ({model?.total})
            </Typography.Text>
          </Flex>

          {/* project-specific tasks */}
          {model?.chart.map((item, index) => (
            <AntTooltip key={index} title={`${item.name} (${item.y})`}>
              <Flex key={item.name} gap={4} align="center" style={{ maxWidth: 120 }}>
                <Badge color={item.color} />
                <Typography.Text ellipsis>{item.name}</Typography.Text>({item.y})
              </Flex>
            </AntTooltip>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default MembersReportsProjectGraph;
