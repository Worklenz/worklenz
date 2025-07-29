import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, Progress, Alert, Space, Typography, Divider } from '@/shared/antd-imports';
import { performanceMonitor } from '@/utils/performance-monitor';

const { Title, Text } = Typography;

interface PerformanceAnalysisProps {
  projectId: string;
}

const PerformanceAnalysis: React.FC<PerformanceAnalysisProps> = ({ projectId }) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [metrics, setMetrics] = useState<any>({});
  const [report, setReport] = useState<string>('');
  const [stopMonitoring, setStopMonitoring] = useState<(() => void) | null>(null);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);

    // Start all monitoring
    const stopFrameRate = performanceMonitor.startFrameRateMonitoring();
    const stopLongTasks = performanceMonitor.startLongTaskMonitoring();
    const stopLayoutThrashing = performanceMonitor.startLayoutThrashingMonitoring();

    // Set up periodic memory monitoring
    const memoryInterval = setInterval(() => {
      performanceMonitor.monitorMemory();
    }, 1000);

    // Set up periodic metrics update
    const metricsInterval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics());
    }, 2000);

    const cleanup = () => {
      stopFrameRate();
      stopLongTasks();
      stopLayoutThrashing();
      clearInterval(memoryInterval);
      clearInterval(metricsInterval);
    };

    setStopMonitoring(() => cleanup);
  }, []);

  // Stop monitoring
  const handleStopMonitoring = useCallback(() => {
    if (stopMonitoring) {
      stopMonitoring();
      setStopMonitoring(null);
    }
    setIsMonitoring(false);

    // Generate final report
    const finalReport = performanceMonitor.generateReport();
    setReport(finalReport);
  }, [stopMonitoring]);

  // Clear metrics
  const clearMetrics = useCallback(() => {
    performanceMonitor.clear();
    setMetrics({});
    setReport('');
  }, []);

  // Download report
  const downloadReport = useCallback(() => {
    if (report) {
      const blob = new Blob([report], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-report-${projectId}-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [report, projectId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopMonitoring) {
        stopMonitoring();
      }
    };
  }, [stopMonitoring]);

  // Prepare table data
  const tableData = Object.entries(metrics).map(([key, value]: [string, any]) => ({
    key,
    metric: key,
    average: value.average.toFixed(2),
    count: value.count,
    min: value.min.toFixed(2),
    max: value.max.toFixed(2),
    status: getMetricStatus(key, value.average),
  }));

  function getMetricStatus(metric: string, average: number): 'good' | 'warning' | 'error' {
    if (metric.includes('render-time')) {
      return average > 16 ? 'error' : average > 8 ? 'warning' : 'good';
    }
    if (metric === 'fps') {
      return average < 30 ? 'error' : average < 55 ? 'warning' : 'good';
    }
    if (metric.includes('memory-used') && metric.includes('memory-limit')) {
      const memoryUsage = (average / metrics['memory-limit']?.average) * 100;
      return memoryUsage > 80 ? 'error' : memoryUsage > 50 ? 'warning' : 'good';
    }
    return 'good';
  }

  const columns = [
    {
      title: 'Metric',
      dataIndex: 'metric',
      key: 'metric',
      render: (text: string) => (
        <Text code style={{ fontSize: '12px' }}>
          {text}
        </Text>
      ),
    },
    {
      title: 'Average',
      dataIndex: 'average',
      key: 'average',
      render: (text: string, record: any) => {
        const color =
          record.status === 'error'
            ? '#ff4d4f'
            : record.status === 'warning'
              ? '#faad14'
              : '#52c41a';
        return <Text style={{ color, fontWeight: 500 }}>{text}</Text>;
      },
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
    },
    {
      title: 'Min',
      dataIndex: 'min',
      key: 'min',
    },
    {
      title: 'Max',
      dataIndex: 'max',
      key: 'max',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'error' ? '#ff4d4f' : status === 'warning' ? '#faad14' : '#52c41a';
        const text = status === 'error' ? 'Poor' : status === 'warning' ? 'Fair' : 'Good';
        return <Text style={{ color, fontWeight: 500 }}>{text}</Text>;
      },
    },
  ];

  return (
    <Card
      title="Performance Analysis"
      style={{ marginBottom: 16 }}
      extra={
        <Space>
          {!isMonitoring ? (
            <Button type="primary" onClick={startMonitoring}>
              Start Monitoring
            </Button>
          ) : (
            <Button danger onClick={handleStopMonitoring}>
              Stop Monitoring
            </Button>
          )}
          <Button onClick={clearMetrics}>Clear</Button>
          {report && <Button onClick={downloadReport}>Download Report</Button>}
        </Space>
      }
    >
      {isMonitoring && (
        <Alert
          message="Performance monitoring is active"
          description="Collecting metrics for component renders, Redux operations, memory usage, and frame rate."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {Object.keys(metrics).length > 0 && (
        <>
          <Title level={5}>Performance Metrics</Title>
          <Table
            dataSource={tableData}
            columns={columns}
            pagination={false}
            size="small"
            style={{ marginBottom: 16 }}
          />

          <Divider />

          <Title level={5}>Key Performance Indicators</Title>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            {metrics.fps && (
              <Card size="small">
                <Text>Frame Rate</Text>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color:
                      getMetricStatus('fps', metrics.fps.average) === 'error'
                        ? '#ff4d4f'
                        : '#52c41a',
                  }}
                >
                  {metrics.fps.average.toFixed(1)} FPS
                </div>
                <Progress
                  percent={Math.min((metrics.fps.average / 60) * 100, 100)}
                  size="small"
                  status={
                    getMetricStatus('fps', metrics.fps.average) === 'error' ? 'exception' : 'active'
                  }
                />
              </Card>
            )}

            {metrics['memory-used'] && metrics['memory-limit'] && (
              <Card size="small">
                <Text>Memory Usage</Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {(
                    (metrics['memory-used'].average / metrics['memory-limit'].average) *
                    100
                  ).toFixed(1)}
                  %
                </div>
                <Progress
                  percent={(metrics['memory-used'].average / metrics['memory-limit'].average) * 100}
                  size="small"
                  status={
                    (metrics['memory-used'].average / metrics['memory-limit'].average) * 100 > 80
                      ? 'exception'
                      : 'active'
                  }
                />
              </Card>
            )}

            {metrics['layout-thrashing-count'] && (
              <Card size="small">
                <Text>Layout Thrashing</Text>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: metrics['layout-thrashing-count'].count > 10 ? '#ff4d4f' : '#52c41a',
                  }}
                >
                  {metrics['layout-thrashing-count'].count}
                </div>
                <Text type="secondary">Detected instances</Text>
              </Card>
            )}

            {metrics['long-task-duration'] && (
              <Card size="small">
                <Text>Long Tasks</Text>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: metrics['long-task-duration'].count > 0 ? '#ff4d4f' : '#52c41a',
                  }}
                >
                  {metrics['long-task-duration'].count}
                </div>
                <Text type="secondary">Tasks &gt; 50ms</Text>
              </Card>
            )}
          </div>
        </>
      )}

      {report && (
        <>
          <Divider />
          <Title level={5}>Performance Report</Title>
          <pre
            style={{
              backgroundColor: '#f5f5f5',
              padding: 16,
              borderRadius: 4,
              fontSize: '12px',
              maxHeight: '300px',
              overflow: 'auto',
            }}
          >
            {report}
          </pre>
        </>
      )}
    </Card>
  );
};

export default PerformanceAnalysis;
