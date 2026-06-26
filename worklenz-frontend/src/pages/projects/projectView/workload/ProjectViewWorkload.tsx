import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Flex, Card, Segmented, Spin, Empty, Skeleton } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import WorkloadOverview from './components/WorkloadOverview';
import WorkloadChart from './components/WorkloadChart';
import WorkloadCalendar from './components/WorkloadCalendar';
import WorkloadTable from './components/WorkloadTable';
import WorkloadFilters from './components/WorkloadFilters';
import {
  useGetProjectWorkloadQuery,
  useGetWorkloadMembersQuery,
} from '@/api/project-workload/project-workload.api.service';
import projectWorkloadApi from '@/api/project-workload/project-workload.api.service';
import { setWorkloadView, setDateRange } from '@/features/project-workload/projectWorkloadSlice';
import dayjs from 'dayjs';
import './project-view-workload.css'; // Import CSS file

type WorkloadView = 'chart' | 'calendar' | 'table';

const ProjectViewWorkload = React.memo(() => {
  const { t } = useTranslation('workload');
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();

  const { workloadView, dateRange, filters } = useAppSelector(state => state.projectWorkload);
  const [localView, setLocalView] = useState<WorkloadView>(workloadView || 'chart');

  // Use the comprehensive project workload API that combines all data
  const {
    data: workloadData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useGetProjectWorkloadQuery(
    {
      projectId: projectId!,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    },
    {
      skip: !projectId,
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  // Fallback to simpler API if the comprehensive one fails
  const {
    data: fallbackData,
    isLoading: fallbackLoading,
    error: fallbackError,
    refetch: fallbackRefetch,
    isFetching: fallbackFetching,
  } = useGetWorkloadMembersQuery(
    {
      projectId: projectId!,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    },
    {
      skip: !projectId || !error, // Only use fallback if main query has error
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  // Use fallback data if main query failed
  const finalData = error && fallbackData ? fallbackData : workloadData;
  const finalLoading = error ? fallbackLoading : isLoading;
  const finalError = error && fallbackError ? fallbackError : error;
  const finalRefetch = error ? fallbackRefetch : refetch;
  const finalFetching = error ? fallbackFetching : isFetching;

  // Initialize date range on component mount if not set
  useEffect(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      const defaultRange = {
        startDate: dayjs().startOf('week').format('YYYY-MM-DD'),
        endDate: dayjs().endOf('week').format('YYYY-MM-DD'),
      };
      dispatch(setDateRange(defaultRange));
    }
  }, [dateRange.startDate, dateRange.endDate, dispatch]);

  // Force refetch when projectId or dateRange changes
  useEffect(() => {
    if (projectId) {
      finalRefetch();
    }
  }, [projectId, dateRange.startDate, dateRange.endDate, finalRefetch]);

  const handleRetry = useCallback(() => {
    finalRefetch();
  }, [finalRefetch]);

  const handleRefresh = useCallback(() => {
    try {
      dispatch(projectWorkloadApi.util.invalidateTags(['ProjectWorkload']));
      finalRefetch();
    } catch (error) {
      console.error('Error refreshing workload:', error);
    }
  }, [finalRefetch, dispatch]);

  // Memoize the content to prevent unnecessary re-renders
  const memoizedContent = useMemo(() => {
    if (!finalData) return null;

    switch (localView) {
      case 'calendar':
        return <WorkloadCalendar data={finalData as any} />;
      case 'table':
        return <WorkloadTable data={finalData as any} />;
      case 'chart':
      default:
        return <WorkloadChart data={finalData as any} />;
    }
  }, [finalData, localView]);

  const handleViewChange = useCallback(
    (value: string | number) => {
      const view = value as WorkloadView;
      setLocalView(view);
      dispatch(setWorkloadView(view));
    },
    [dispatch]
  );

  const renderContent = () => {
    if (finalLoading || finalFetching) {
      return (
        <Flex justify="center" align="center" style={{ minHeight: 400 }}>
          <Spin size="large" />
        </Flex>
      );
    }

    if (finalError) {
      return (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <Empty
            description={
              <div>
                <p>{t('errorLoadingData')}</p>
                <p
                  style={{
                    fontSize: '12px',
                    opacity: 0.65,
                    marginBottom: '16px',
                  }}
                >
                  {typeof finalError === 'string' ? finalError : JSON.stringify(finalError)}
                </p>
                <button
                  onClick={handleRetry}
                  className="ant-btn ant-btn-primary"
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                  }}
                >
                  {t('retry')}
                </button>
              </div>
            }
          />
        </div>
      );
    }

    if (
      !finalData ||
      (!finalData.members && !finalData.body) ||
      (finalData.members && finalData.members.length === 0) ||
      (finalData.body && finalData.body.length === 0)
    ) {
      return (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <Empty
            description={
              <div>
                <p>{t('noWorkloadData')}</p>
                <button
                  onClick={handleRetry}
                  className="ant-btn ant-btn-primary"
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    marginTop: '16px',
                  }}
                >
                  {t('refreshData')}
                </button>
              </div>
            }
          />
        </div>
      );
    }

    return memoizedContent;
  };

  return (
    <Flex
      vertical
      style={{
        height: 'calc(100vh - 220px)', // Adjust based on your header height
        paddingLeft: '24px',
        paddingRight: '24px',
        paddingTop: '16px',
      }}
    >
      {/* Fixed Header Section - View Tabs and Filters */}
      <Flex
        justify="space-between"
        align="center"
        wrap="wrap"
        gap={16}
        style={{ marginBottom: '16px' }}
      >
        <Segmented
          value={localView}
          onChange={handleViewChange}
          options={[
            { label: t('chartView'), value: 'chart' },
            { label: t('calendarView'), value: 'calendar' },
            { label: t('tableView'), value: 'table' },
          ]}
        />
        <WorkloadFilters
          onRefresh={handleRefresh}
          isLoading={finalLoading}
          isFetching={finalFetching}
        />
      </Flex>

      {/* Scrollable Content Section */}
      <div
        className="workload-scroll-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <Flex
          vertical
          gap={16}
          style={{
            paddingBottom: '24px',
          }}
        >
          {finalLoading || finalFetching ? (
            <Skeleton active paragraph={{ rows: 4 }} style={{ paddingTop: 16 }} />
          ) : (
            <>
              <WorkloadOverview data={finalData as any} isLoading={finalLoading} />

              <Card>{renderContent()}</Card>
            </>
          )}
        </Flex>
      </div>
    </Flex>
  );
});

ProjectViewWorkload.displayName = 'ProjectViewWorkload';

export default ProjectViewWorkload;
