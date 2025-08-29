import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
} from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { colors } from '@/styles/colors';
import { IJobTitle, IJobTitlesViewModel } from '@/types/job.types';
import { deleteJobTitle } from '@features/settings/job/jobSlice';
import PinRouteToNavbarButton from '@components/PinRouteToNavbarButton';
import {
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import JobTitleDrawer from './job-titles-drawer';
import logger from '@/utils/errorLogger';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_job_titles_visit } from '@/shared/worklenz-analytics-events';

interface PaginationType {
  current: number;
  pageSize: number;
  field: string;
  order: string;
  total: number;
  pageSizeOptions: string[];
  size: 'small' | 'default';
}

const JobTitlesSettings = () => {
  const { t } = useTranslation('settings/job-titles');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  useDocumentTitle('Manage Job Titles');

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [jobTitles, setJobTitles] = useState<IJobTitlesViewModel>({});
  const [pagination, setPagination] = useState<PaginationType>({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
    total: 0,
    pageSizeOptions: ['5', '10', '15', '20', '50', '100'],
    size: 'small',
  });

  const getJobTitles = useMemo(() => {
    return async () => {
      const response = await jobTitlesApiService.getJobTitles(
        pagination.current,
        pagination.pageSize,
        pagination.field,
        pagination.order,
        searchQuery
      );
      if (response.done) {
        setJobTitles(response.body);
        setPagination(prev => ({ ...prev, total: response.body.total || 0 }));
      }
    };
  }, [pagination.current, pagination.pageSize, pagination.field, pagination.order, searchQuery]);

  useEffect(() => {
    trackMixpanelEvent(evt_settings_job_titles_visit);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    getJobTitles();
  }, [getJobTitles]);

  const handleEditClick = (id: string) => {
    setSelectedJobId(id);
    setShowDrawer(true);
  };

  const handleCreateClick = () => {
    setSelectedJobId(null);
    setShowDrawer(true);
  };

  const handleDrawerClose = () => {
    setSelectedJobId(null);
    setShowDrawer(false);
    getJobTitles();
  };

  const deleteJobTitle = async (id: string) => {
    if (!id) return;
    try {
      const res = await jobTitlesApiService.deleteJobTitle(id);
      if (res.done) {
        getJobTitles();
      }
    } catch (error) {
      logger.error('Failed to delete job title:', error);
    }
  };

  const columns: TableProps['columns'] = useMemo(
    () => [
      {
        key: 'jobTitle',
        title: t('nameColumn'),
        sorter: true,
        onCell: record => ({
          onClick: () => handleEditClick(record.id),
        }),
        render: (record: IJobTitle) => <Typography.Text>{record.name}</Typography.Text>,
      },
      {
        key: 'actionBtns',
        width: 80,
        render: (record: IJobTitle) => (
          <Flex gap={8} style={{ padding: 0 }}>
            <Tooltip title="Edit">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => record.id && handleEditClick(record.id)}
              />
            </Tooltip>

            <Popconfirm
              title={t('deleteConfirmationTitle')}
              icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
              okText={t('deleteConfirmationOk')}
              cancelText={t('deleteConfirmationCancel')}
              onConfirm={() => record.id && deleteJobTitle(record.id)}
            >
              <Tooltip title="Delete">
                <Button shape="default" icon={<DeleteOutlined />} size="small" />
              </Tooltip>
            </Popconfirm>
          </Flex>
        ),
      },
    ],
    [t]
  );

  const handleTableChange = (newPagination: any, _filters: any, sorter: any) => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
      field: sorter.field || 'name',
      order: sorter.order === 'ascend' ? 'asc' : 'desc',
    }));
  };

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="flex-end">
          <Flex gap={8} align="center" justify="flex-end" style={{ width: '100%', maxWidth: 400 }}>
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.currentTarget.value)}
              placeholder={t('searchPlaceholder')}
              style={{ maxWidth: 232 }}
              suffix={<SearchOutlined />}
            />
            <Button type="primary" onClick={handleCreateClick}>
              {t('createJobTitleButton')}
            </Button>

            <Tooltip title={t('pinTooltip')} trigger={'hover'}>
              <PinRouteToNavbarButton
                name="jobTitles"
                path="/worklenz/settings/job-titles"
                adminOnly
              />
            </Tooltip>
          </Flex>
        </Flex>
      }
    >
      <Table
        dataSource={jobTitles.data}
        size="small"
        columns={columns}
        rowKey={(record: IJobTitle) => record.id!}
        pagination={pagination}
        onChange={handleTableChange}
      />
      <JobTitleDrawer
        drawerOpen={showDrawer}
        jobTitleId={selectedJobId}
        drawerClosed={handleDrawerClose}
      />
    </Card>
  );
};

export default JobTitlesSettings;
