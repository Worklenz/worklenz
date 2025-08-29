import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Flex, Card, Segmented, Spin, Empty } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import WorkloadOverview from './components/WorkloadOverview';
import WorkloadChart from './components/WorkloadChart';
import WorkloadCalendar from './components/WorkloadCalendar';
import WorkloadTable from './components/WorkloadTable';
import WorkloadFilters from './components/WorkloadFilters';
import { useGetProjectWorkloadQuery } from '@/api/project-workload/project-workload.api.service';
import { setWorkloadView, setDateRange } from '@/features/project-workload/projectWorkloadSlice';
import dayjs from 'dayjs';

type WorkloadView = 'chart' | 'calendar' | 'table';

const ProjectViewWorkload = React.memo(() => {
  const { t } = useTranslation('workload');
  const { projectId } = useParams<{ projectId: string }>();
  const dispatch = useAppDispatch();

  const { workloadView, dateRange, filters } = useAppSelector(state => state.projectWorkload);
  const [localView, setLocalView] = useState<WorkloadView>(workloadView || 'chart');

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
      skip: !projectId || !dateRange.startDate || !dateRange.endDate,
      refetchOnMountOrArgChange: true, // Always refetch when component mounts or args change
      refetchOnFocus: false, // Don't refetch on window focus for performance
      refetchOnReconnect: true, // Refetch on network reconnect
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

  // Debug logging and auto-trigger fallback
  useEffect(() => {
    const state = {
      projectId,
      dateRange,
      isLoading,
      isFetching,
      hasData: !!workloadData,
      dataLength: workloadData?.members?.length || 0,
      error: error,
    };
    console.log('Workload Component State:', state);

    // Fallback: If we have all required params but no data and not loading, trigger fetch
    if (
      projectId &&
      dateRange.startDate &&
      dateRange.endDate &&
      !isLoading &&
      !isFetching &&
      !workloadData &&
      !error
    ) {
      console.log('Fallback: Triggering refetch due to missing data');
      const fallbackTimeout = setTimeout(() => {
        refetch();
      }, 500);
      return () => clearTimeout(fallbackTimeout);
    }
  }, [projectId, dateRange, isLoading, isFetching, workloadData, error, refetch]);

  // Force refetch when component mounts or projectId changes (tab switching)
  useEffect(() => {
    if (projectId && dateRange.startDate && dateRange.endDate) {
      console.log('Project changed, refetching workload data for:', projectId);
      // Small delay to ensure component is fully mounted
      const timeoutId = setTimeout(() => {
        refetch();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [projectId, refetch, dateRange.startDate, dateRange.endDate]);

  // Handle page visibility change (page reload, browser tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && projectId && dateRange.startDate && dateRange.endDate) {
        console.log('Page became visible, refetching workload data');
        // Only refetch if we don't have recent data
        if (!workloadData || error) {
          refetch();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [projectId, dateRange, workloadData, error, refetch]);

  // Retry mechanism for failed loads
  const handleRetry = useCallback(() => {
    console.log('Manual retry triggered');
    refetch();
  }, [refetch]);

  // Memoize the content to prevent unnecessary re-renders
  const memoizedContent = useMemo(() => {
    if (!workloadData) return null;

    switch (localView) {
      case 'calendar':
        return <WorkloadCalendar data={workloadData} />;
      case 'table':
        return <WorkloadTable data={workloadData} />;
      case 'chart':
      default:
        return <WorkloadChart data={workloadData} />;
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

    if (!workloadData || workloadData.members?.length === 0) {
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
        <WorkloadFilters onRefresh={refetch} />
      </Flex>

      <WorkloadOverview data={workloadData} isLoading={isLoading} />

      <Card
        style={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        {renderContent()}
      </Card>
    </Flex>
  );
});

ProjectViewWorkload.displayName = 'ProjectViewWorkload';

export default ProjectViewWorkload;
