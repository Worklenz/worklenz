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
import { useGetWorkloadMembersQuery } from '@/api/project-workload/project-workload.api.service';
import projectWorkloadApi from '@/api/project-workload/project-workload.api.service';
import { setWorkloadView, setDateRange } from '@/features/project-workload/projectWorkloadSlice';
import dayjs from 'dayjs';

type WorkloadView = 'chart' | 'calendar' | 'table';

const ProjectViewWorkload = React.memo(() => {
  const { t } = useTranslation('workload');
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();

  const { workloadView, dateRange, filters } = useAppSelector(state => state.projectWorkload);
  const [localView, setLocalView] = useState<WorkloadView>(workloadView || 'chart');

  // Use the members API directly for better compatibility with the chart component
  const {
    data: workloadData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useGetWorkloadMembersQuery(
    { 
      projectId: projectId!,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    },
    {
      skip: !projectId || !dateRange.startDate || !dateRange.endDate,
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  // Initialize date range on component mount if not set
  useEffect(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      const defaultRange = {
        startDate: dayjs().startOf('week').format('YYYY-MM-DD'),
        endDate: dayjs().endOf('week').add(3, 'weeks').format('YYYY-MM-DD'),
      };
      dispatch(setDateRange(defaultRange));
    }
  }, []); // Only run on mount

  // Debug logging and state monitoring
  useEffect(() => {
    const state = {
      projectId,
      dateRange,
      isLoading,
      isFetching,
      hasData: !!workloadData,
      dataLength: workloadData?.body?.length || 0,
      error: error,
    };
  }, [projectId, dateRange, isLoading, isFetching, workloadData, error]);

  // Force refetch when projectId or dateRange changes
  useEffect(() => {
    if (projectId && dateRange.startDate && dateRange.endDate) {
      console.log('Project or date range changed, refetching workload data for:', projectId);
      // Small delay to ensure component is fully mounted and state is updated
      const timeoutId = setTimeout(() => {
        refetch();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [projectId, dateRange.startDate, dateRange.endDate, refetch]);

  // Retry mechanism for failed loads
  const handleRetry = useCallback(() => {
    console.log('Manual retry triggered');
    refetch();
  }, [refetch]);

  // Enhanced refetch handler with debugging
  const handleRefresh = useCallback(() => {
    console.log('=== REFRESH TRIGGERED ===');
    
    try {
      // Invalidate cache first to ensure fresh data
      dispatch(projectWorkloadApi.util.invalidateTags(['ProjectWorkload']));
      
      // Force a fresh refetch
      refetch();
      console.log('Refetch completed successfully');
    } catch (error) {
      console.error('Error calling refetch:', error);
    }
  }, [refetch, projectId, dateRange, isLoading, isFetching, workloadData, error, dispatch]);

  // Memoize the content to prevent unnecessary re-renders
  const memoizedContent = useMemo(() => {
    if (!workloadData) return null;

    switch (localView) {
      case 'calendar':
        return <WorkloadCalendar data={workloadData as any} />;
      case 'table':
        return <WorkloadTable data={workloadData as any} />;
      case 'chart':
      default:
        return <WorkloadChart data={workloadData as any} />;
    }
  }, [workloadData, localView]);

  const handleViewChange = useCallback(
    (value: string | number) => {
      const view = value as WorkloadView;
      setLocalView(view);
      dispatch(setWorkloadView(view));
    },
    [dispatch]
  );

  const renderContent = () => {
    if (isLoading || isFetching) {
      return (
        <Flex justify="center" align="center" style={{ minHeight: 400 }}>
          <Spin size="large" />
        </Flex>
      );
    }

    if (error) {
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
                  {typeof error === 'string' ? error : JSON.stringify(error)}
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

    if (!workloadData || !workloadData.body || workloadData.body.length === 0) {
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
      gap={16}
      style={{
        height: '100%',
        padding: '16px 0',
      }}
    >
      <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
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
          isLoading={isLoading}
          isFetching={isFetching}
        />
      </Flex>

      {isLoading || isFetching ? <Skeleton active paragraph={{ rows: 4 }} style={{ paddingTop: 16 }} /> : <>
        <WorkloadOverview data={workloadData as any} isLoading={isLoading} />

        <Card
          style={{
            flex: 1,
            overflow: 'auto',
          }}
        >
          {renderContent()}
        </Card>
      </>}
    </Flex>
  );
});

ProjectViewWorkload.displayName = 'ProjectViewWorkload';

export default ProjectViewWorkload;
