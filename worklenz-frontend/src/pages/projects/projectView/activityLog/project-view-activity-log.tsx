import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DownloadOutlined, FilterOutlined } from '@ant-design/icons';
import { Button, Select, Spin, Typography, Empty, message } from 'antd';
import { useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import { format } from 'date-fns';

import {
  projectActivityLogsApiService,
  IProjectActivityLog,
} from '../../../../api/projects/project-activity-logs-api.service';
import VirtualActivityList from './components/virtual-activity-list';

const { Title, Text } = Typography;
const { Option } = Select;

const ProjectViewActivityLog: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const exportRef = useRef<HTMLDivElement>(null);

  // Data + paging
  const [logs, setLogs] = useState<IProjectActivityLog[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // UI state
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listHeight, setListHeight] = useState(600);

  // compute if more pages exist
  const hasNextPage = currentPage < totalPages;

  // calculate list height
  useEffect(() => {
    const calc = () => {
      const header = 200;
      setListHeight(Math.max(400, window.innerHeight - header));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  // loader callbacks
  const isItemLoaded = useCallback(
    (index: number) => index < logs.length,
    [logs.length]
  );

  const fetchPage = useCallback(
    async (page: number, filter: string, append = false) => {
      if (!projectId) return;
      append ? setLoadingMore(true) : setLoading(true);
      setError(null);

      try {
        const res = await projectActivityLogsApiService.getActivityLogsByProjectId(
          projectId,
          page,
          pageSize,
          filter
        );
        if (!res.done || !res.body) throw new Error('Invalid response');

        const { logs: newLogs, pagination } = res.body;
        setLogs(prev => (append ? [...prev, ...newLogs] : newLogs));
        setCurrentPage(pagination.current);
        setTotalPages(pagination.totalPages);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Fetch failed');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [projectId, pageSize]
  );

  const loadMoreItems = useCallback(
    async (_startIndex: number, _stopIndex: number) => {
      if (loadingMore || !hasNextPage) return;
      await fetchPage(currentPage + 1, filterType, true);
    },
    [currentPage, filterType, hasNextPage, loadingMore, fetchPage]
  );

  // initial + filter-driven load
  useEffect(() => {
    setLogs([]);
    setCurrentPage(1);
    setTotalPages(1);
    fetchPage(1, filterType, false);
  }, [projectId, filterType, fetchPage]);

  // handle filter
  const onFilterChange = (value: string) => setFilterType(value);

  // Function to fetch all logs for export (paginated)
  const fetchAllLogsForExport = async (): Promise<IProjectActivityLog[]> => {
    if (!projectId) return [];
    
    const allLogs: IProjectActivityLog[] = [];
    let page = 1;
    let totalPages = 1;
    
    message.loading('Fetching all activity logs for export...', 0);
    
    do {
      try {
        const res = await projectActivityLogsApiService.getActivityLogsByProjectId(
          projectId,
          page,
          100, // Use larger page size for export
          filterType
        );
        
        if (!res.done || !res.body) break;
        
        const { logs: pageLogs, pagination } = res.body;
        allLogs.push(...pageLogs);
        totalPages = pagination.totalPages;
        
        // Update progress message
        message.destroy();
        message.loading(`Fetching logs... Page ${page} of ${totalPages}`, 0);
        
        page++;
      } catch (error) {
        console.error('Error fetching logs for export:', error);
        break;
      }
    } while (page <= totalPages);
    
    message.destroy();
    
    return allLogs;
  };

  // Multi-page PDF export with all logs
  const exportPdfWithAllLogs = async (projectName: string, allLogs: IProjectActivityLog[]) => {
    if (allLogs.length === 0) return;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 10;
    const marginY = 30;
    const contentWidth = pageWidth - (marginX * 2);
    const contentHeight = pageHeight - marginY - 20; // Reserve space for header and footer
    
    // Constants for layout
    const itemHeight = 18; // height per activity log item in mm
    const itemsPerPage = Math.floor(contentHeight / itemHeight);
    
    // Helper function to add header to each page
    const addPageHeader = (pageNum: number, totalPages: number) => {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(
        `Activity Log - ${projectName}`,
        pageWidth / 2,
        15,
        { align: 'center' }
      );
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        `Generated on ${format(new Date(), 'yyyy-MM-dd HH:mm')}`,
        pageWidth / 2,
        20,
        { align: 'center' }
      );
      
      if (filterType !== 'all') {
        const filterLabel = projectActivityLogsApiService.getFilterOptions()
          .find(f => f.value === filterType)?.label || filterType;
        pdf.text(
          `Filter: ${filterLabel}`,
          pageWidth / 2,
          25,
          { align: 'center' }
        );
      }
      
      // Page number
      pdf.setFontSize(8);
      pdf.text(
        `Page ${pageNum} of ${totalPages}`,
        pageWidth - marginX,
        pageHeight - 5,
        { align: 'right' }
      );
    };
    
    // Helper function to convert hex color to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 24, g: 144, b: 255 }; // Default blue
    };
    
    // Helper function to add activity log item to PDF
    const addActivityItem = (activity: IProjectActivityLog, yPosition: number) => {
      const name = activity.done_by?.name || 'Unknown';
      const avatarBg = activity.done_by?.color_code || '#1890ff';
      const rgb = hexToRgb(avatarBg);
      
      // Draw avatar circle background
      pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      pdf.circle(marginX + 3, yPosition + 2, 2.5, 'F');
      
      // Add avatar text
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255); // White text
      pdf.text(
        name.charAt(0).toUpperCase(),
        marginX + 3,
        yPosition + 3,
        { align: 'center' }
      );
      
      // Reset text color
      pdf.setTextColor(0, 0, 0);
      
      // Add user name and action
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      const userText = `${name} ${activity.log_text || ''}`;
      const userLines = pdf.splitTextToSize(userText, contentWidth - 12);
      pdf.text(userLines, marginX + 8, yPosition + 1);
      
      // Add task info
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const taskText = `${activity.task_key || ''} - ${activity.task_name || ''}`;
      const taskLines = pdf.splitTextToSize(taskText, contentWidth - 12);
      pdf.text(taskLines, marginX + 8, yPosition + 4);
      
      // Add timestamp
      pdf.setFontSize(7);
      pdf.setTextColor(100, 100, 100); // Gray text
      const timeText = new Date(activity.created_at).toLocaleString();
      pdf.text(timeText, marginX + 8, yPosition + 7);
      
      // Reset text color
      pdf.setTextColor(0, 0, 0);
      
      // Add separator line
      pdf.setDrawColor(240, 240, 240);
      pdf.line(marginX, yPosition + 10, pageWidth - marginX, yPosition + 10);
    };
    
    // Calculate total pages needed
    const totalPages = Math.ceil(allLogs.length / itemsPerPage);
    
    // Process logs in chunks for each page
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      if (pageIndex > 0) {
        pdf.addPage();
      }
      
      // Add header to current page
      addPageHeader(pageIndex + 1, totalPages);
      
      // Calculate logs for current page
      const startIndex = pageIndex * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, allLogs.length);
      const pageActivityLogs = allLogs.slice(startIndex, endIndex);
      
      // Show progress message
      if (pageIndex === 0) {
        message.loading(`Generating PDF... Processing page ${pageIndex + 1} of ${totalPages}`, 0);
      } else {
        message.destroy();
        message.loading(`Generating PDF... Processing page ${pageIndex + 1} of ${totalPages}`, 0);
      }
      
      // Add activity logs to current page
      let currentY = marginY + 10;
      pageActivityLogs.forEach((activity) => {
        addActivityItem(activity, currentY);
        currentY += itemHeight;
      });
      
      // Add summary at bottom of last page
      if (pageIndex === totalPages - 1) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'italic');
        pdf.text(
          `Total Activities: ${allLogs.length}`,
          marginX,
          pageHeight - 15
        );
      }
    }
    
    message.destroy();
    message.success(`PDF generated successfully with ${totalPages} pages!`);
    
    // Save the PDF
    const fileName = `Activity-Log-${projectName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(fileName);
  };

  // Enhanced handleExportPdf function
  const handleExportPdf = async () => {
    if (!projectId) return;
    
    setExportLoading(true);
    try {
      // Fetch all activity logs for export (not just the currently loaded ones)
      const allLogs = await fetchAllLogsForExport();
      
      if (allLogs.length === 0) {
        message.warning('No activity logs to export');
        return;
      }
      
      await exportPdfWithAllLogs(projectId, allLogs);
    } catch (error) {
      console.error('PDF export failed:', error);
      message.error('PDF export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 20, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>Project Activity Log</Title>
        <div style={{ display: 'flex', gap: 12 }}>
          <Select
            value={filterType}
            onChange={onFilterChange}
            style={{ width: 200 }}
            suffixIcon={<FilterOutlined />}
            loading={loading}
          >
            {projectActivityLogsApiService.getFilterOptions().map(o => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Select>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportPdf}
            loading={exportLoading}
            disabled={logs.length === 0}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {error && (
        <div style={{ color: 'red', textAlign: 'center', marginBottom: 16 }}>
          Error: {error}
        </div>
      )}

      {logs.length === 0 && !loading ? (
        <Empty
          description={`No ${
            filterType === 'all' ? '' : filterType + ' '
          }activity logs found`}
          style={{ marginTop: 50 }}
        />
      ) : (
        <div ref={exportRef} style={{ flex: 1 }}>
          <VirtualActivityList
            logs={logs}
            hasNextPage={hasNextPage}
            isItemLoaded={isItemLoaded}
            loadMoreItems={loadMoreItems}
            height={listHeight}
          />
        </div>
      )}

      {loadingMore && (
        <div
          style={{
            textAlign: 'center',
            padding: 20,
            borderTop: '1px solid #eee',
          }}
        >
          <Spin size="small" />
          <Text type="secondary" style={{ marginLeft: 8 }}>
            Loading more…
          </Text>
        </div>
      )}
    </div>
  );
};

export default ProjectViewActivityLog;
