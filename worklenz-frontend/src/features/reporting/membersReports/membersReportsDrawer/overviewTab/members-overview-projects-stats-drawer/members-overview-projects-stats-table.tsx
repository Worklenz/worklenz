import { memo } from 'react';
import {
  ConfigProvider,
  Flex,
  Skeleton,
  Spin,
  Table,
  TableColumnsType,
  Typography,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import CustomTableTitle from '@components/CustomTableTitle';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import { colors } from '@/styles/colors';
import { toCamelCase } from '@/utils/toCamelCase';
import ProjectCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-cell/project-cell';
import ProjectDaysLeftAndOverdueCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-days-left-and-overdue-cell/project-days-left-and-overdue-cell';
import ProjectManagerCell from '@/pages/reporting/projects-reports/projects-reports-table/table-cells/project-manager-cell/project-manager-cell';

type ProjectReportsTableProps = {
  projectList: any[];
  loading: Boolean;
};

const MembersOverviewProjectsStatsTable = ({ projectList, loading }: ProjectReportsTableProps) => {
  // localization
  const { t } = useTranslation('reporting-members-drawer');

  const columns: TableColumnsType = [
    {
      key: 'name',
      title: <CustomTableTitle title={t('nameColumn')} />,
      width: 300,
      render: record => (
        <ProjectCell projectId={record.id} project={record.name} projectColor={record.color_code} />
      ),
      fixed: 'left' as const,
    },
    {
      key: 'startDate',
      title: <CustomTableTitle title={t('startDateColumn')} />,
      render: record => (
        <Typography.Text className="group-hover:text-[#1890ff]">
          {record?.start_date ? simpleDateFormat(record?.start_date) : '-'}
        </Typography.Text>
      ),
      width: 120,
    },
    {
      key: 'endDate',
      title: <CustomTableTitle title={t('endDateColumn')} />,
      render: record => (
        <Typography.Text className="group-hover:text-[#1890ff]">
          {record?.start_date ? simpleDateFormat(record?.end_date) : '-'}
        </Typography.Text>
      ),
      width: 120,
    },
    {
      key: 'daysLeft',
      title: <CustomTableTitle title={t('daysLeftColumn')} />,
      // render: record => <ProjectDaysLeftAndOverdueCell daysLeft={record.days_left} />,
      width: 150,
    },
    {
      key: 'estimatedTime',
      title: <CustomTableTitle title={t('estimatedTimeColumn')} />,
      render: record => (
        <Typography.Text className="group-hover:text-[#1890ff]">
          {record.estimated_time_string}
        </Typography.Text>
      ),
      width: 120,
    },
    {
      key: 'actualTime',
      title: <CustomTableTitle title={t('actualTimeColumn')} />,
      render: record => (
        <Typography.Text className="group-hover:text-[#1890ff]">
          {record.actual_time_string}
        </Typography.Text>
      ),
      width: 120,
    },
    {
      key: 'status',
      title: <CustomTableTitle title={t('statusColumn')} />,
      // render: record => {
      // const statusItem = statusData.find(item => item.label === record.status_name);

      // return statusItem ? (
      //   <Typography.Text
      //     style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      //     className="group-hover:text-[#1890ff]"
      //   >
      //     {statusItem.icon}
      //     {t(`${statusItem.value}Text`)}
      //   </Typography.Text>
      // ) : (
      //   <Typography.Text>-</Typography.Text>
      // );
      // },
      width: 120,
    },
    {
      key: 'projectHealth',
      title: <CustomTableTitle title={t('projectHealthColumn')} />,
      render: record => (
        <Flex
          gap={6}
          align="center"
          style={{
            width: 'fit-content',
            borderRadius: 24,
            paddingInline: 8,
            height: 30,
            backgroundColor: record.health_color,
            color: colors.darkGray,
            cursor: 'pointer',
          }}
        >
          <Typography.Text
            style={{
              color: colors.darkGray,
              fontSize: 13,
            }}
          >
            {record.health_name ? t(`${toCamelCase(record.health_name)}Text`) : '-'}
          </Typography.Text>
        </Flex>
      ),
      width: 120,
    },
    {
      key: 'category',
      title: <CustomTableTitle title="Category" />,
      render: record => (
        <Flex
          gap={6}
          align="center"
          style={{
            width: 'fit-content',
            borderRadius: 24,
            paddingInline: 8,
            textTransform: 'capitalize',
            fontSize: 13,
            height: 22,
            backgroundColor: record.category_color,
          }}
        >
          {record.category_name ? record.category_name : '-'}
        </Flex>
      ),
      width: 120,
    },
    {
      key: 'projectManager',
      title: <CustomTableTitle title={t('projectManagerColumn')} />,
      render: record => <ProjectManagerCell manager={record.project_manager} />,
      width: 180,
    },
  ];

  return (
    <ConfigProvider
      theme={{
        components: {
          Table: {
            cellPaddingBlock: 8,
            cellPaddingInline: 8,
          },
        },
      }}
    >
      {loading ? (
        <Skeleton style={{ paddingTop: 16 }} />
      ) : (
        <Table
          columns={columns}
          dataSource={projectList}
          pagination={{ showSizeChanger: true, defaultPageSize: 10 }}
          scroll={{ x: 'max-content' }}
          onRow={record => {
            return {
              style: { height: 38, cursor: 'pointer' },
              className: 'group even:bg-[#4e4e4e10]',
            };
          }}
        />
      )}
    </ConfigProvider>
  );
};

export default memo(MembersOverviewProjectsStatsTable);
