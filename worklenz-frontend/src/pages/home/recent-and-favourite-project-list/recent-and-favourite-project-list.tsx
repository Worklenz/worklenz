import { SyncOutlined } from '@/shared/antd-imports';
import {
  Badge,
  Button,
  Card,
  Empty,
  Flex,
  Segmented,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AddFavouriteProjectButton from './add-favourite-project-button';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { useGetProjectsQuery } from '@/api/home-page/home-page.api.service';
import { useNavigate } from 'react-router-dom';
const MY_PROJECTS_FILTER_KEY = 'my-dashboard-active-projects-filter';

const RecentAndFavouriteProjectList = () => {
  const { t } = useTranslation('home');
  const navigate = useNavigate();

  const [projectSegment, setProjectSegment] = useState<'Recent' | 'Favourites'>('Recent');

  const getActiveProjectsFilter = useCallback(() => {
    return +(localStorage.getItem(MY_PROJECTS_FILTER_KEY) || 0);
  }, []);

  const setActiveProjectsFilter = useCallback((value: number) => {
    localStorage.setItem(MY_PROJECTS_FILTER_KEY, value.toString());
  }, []);

  // Initialize projectSegment from localStorage on component mount
  useEffect(() => {
    const filterValue = getActiveProjectsFilter();
    setProjectSegment(filterValue === 0 ? 'Recent' : 'Favourites');
  }, [getActiveProjectsFilter]);

  const {
    data: projectsData,
    isFetching: projectsIsFetching,
    error: projectsError,
    refetch,
  } = useGetProjectsQuery({ view: getActiveProjectsFilter() });

  // Refetch data when projectSegment changes
  useEffect(() => {
    refetch();
  }, [projectSegment, refetch]);

  const handleSegmentChange = useCallback(
    (value: 'Recent' | 'Favourites') => {
      setProjectSegment(value);
      setActiveProjectsFilter(value === 'Recent' ? 0 : 1);
      refetch();
    },
    [refetch]
  );

  // Table columns configuration
  const columns = useMemo<TableProps<IProjectViewModel>['columns']>(
    () => [
      {
        key: 'completeBtn',
        width: 32,
        render: (record: IProjectViewModel) => (
          <AddFavouriteProjectButton key={record.id} record={record} handleRefresh={refetch} />
        ),
      },
      {
        key: 'name',
        render: (record: IProjectViewModel) => (
          <Typography.Paragraph
            key={record.id}
            style={{ margin: 0, paddingInlineEnd: 6, cursor: 'pointer' }}
            onClick={() =>
              navigate(`/worklenz/projects/${record.id}?tab=tasks-list&pinned_tab=tasks-list`)
            }
          >
            <Badge color={record.color_code} style={{ marginInlineEnd: 4 }} />
            {record.name}
          </Typography.Paragraph>
        ),
      },
    ],
    [refetch]
  );

  // Empty state message
  const emptyDescription = useMemo(
    () => (
      <Typography.Text>
        {projectSegment === 'Recent'
          ? t('projects.noRecentProjects')
          : t('projects.noFavouriteProjects')}
      </Typography.Text>
    ),
    [projectSegment, t]
  );

  // Card header components
  const cardTitle = (
    <Typography.Title level={5} style={{ marginBlockEnd: 0 }}>
      {t('projects.title')} ({projectsData?.body?.length})
    </Typography.Title>
  );

  const cardExtra = (
    <Flex gap={8} align="center">
      <Tooltip title={t('projects.refreshProjects')}>
        <Button
          shape="circle"
          icon={<SyncOutlined spin={projectsIsFetching} />}
          onClick={refetch}
        />
      </Tooltip>
      <Segmented<'Recent' | 'Favourites'>
        options={[
          { value: 'Recent', label: t('projects.recent') },
          { value: 'Favourites', label: t('projects.favourites') },
        ]}
        defaultValue={getActiveProjectsFilter() === 0 ? 'Recent' : 'Favourites'}
        onChange={handleSegmentChange}
      />
    </Flex>
  );

  return (
    <Card title={cardTitle} extra={cardExtra} style={{ width: '100%' }}>
      <div style={{ maxHeight: 420, overflow: 'auto' }}>
        {projectsData?.body?.length === 0 ? (
          <Empty
            image="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
            imageStyle={{ height: 60 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            description={emptyDescription}
          />
        ) : (
          <Table
            className="custom-two-colors-row-table"
            rowKey="id"
            dataSource={projectsData?.body}
            columns={columns}
            showHeader={false}
            pagination={false}
            loading={projectsIsFetching}
          />
        )}
      </div>
    </Card>
  );
};

export default RecentAndFavouriteProjectList;
