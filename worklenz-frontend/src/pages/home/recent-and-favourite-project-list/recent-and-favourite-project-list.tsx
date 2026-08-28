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
  theme,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AddFavouriteProjectButton from './add-favourite-project-button';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { useGetProjectsQuery } from '@/api/home-page/home-page.api.service';
import { useNavigate } from 'react-router-dom';
const MY_PROJECTS_FILTER_KEY = 'my-dashboard-active-projects-filter';

const RecentAndFavouriteProjectList = () => {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const { token } = theme.useToken();

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

  return (
    <Card style={{ width: '100%', borderRadius: 10 }} styles={{ body: { padding: '20px' } }}>
      {/* Header — matches HomeProgressDonut's plain title styling */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {t('projects.title')} ({projectsData?.body?.length})
        </div>
        <Flex gap={8} align="center">
          <Tooltip title={t('projects.refreshProjects')}>
            <Button
              shape="circle"
              size="small"
              icon={<SyncOutlined spin={projectsIsFetching} />}
              onClick={refetch}
            />
          </Tooltip>
          <Segmented<'Recent' | 'Favourites'>
            size="small"
            options={[
              { value: 'Recent', label: t('projects.recent') },
              { value: 'Favourites', label: t('projects.favourites') },
            ]}
            defaultValue={getActiveProjectsFilter() === 0 ? 'Recent' : 'Favourites'}
            onChange={handleSegmentChange}
          />
        </Flex>
      </div>

      <div style={{ maxHeight: 420, overflow: 'auto' }}>
        {!projectsData ? (
          <div
            style={{
              minHeight: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <WorklenzLogoLoader />
          </div>
        ) : projectsData?.body?.length === 0 ? (
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
          <div style={{ position: 'relative' }}>
            <Table
              className="custom-two-colors-row-table"
              rowKey="id"
              dataSource={projectsData?.body}
              columns={columns}
              showHeader={false}
              pagination={false}
            />
            {projectsIsFetching && (
              // antd's Spin centering math assumes a small default indicator, so a
              // large custom one (via the `loading` prop) renders off-center — overlay
              // it ourselves instead, matching the Planner views' pattern.
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: token.colorBgContainer,
                  opacity: 0.85,
                  zIndex: 5,
                }}
              >
                <WorklenzLogoLoader />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default RecentAndFavouriteProjectList;
