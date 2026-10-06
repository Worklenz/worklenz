import { DownloadOutlined } from '@/shared/antd-imports';
import { Badge, Button, Checkbox, Flex } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { colors } from '@/styles/colors';
import InsightsMembers from './insights-members/insights-members';
import InsightsOverview from './insights-overview/insights-overview';
import InsightsTasks from './insights-tasks/insights-tasks';
import {
  setActiveSegment,
  setIncludeArchivedTasks,
  setProjectId,
} from '@/features/projects/insights/project-insights.slice';
import { format } from 'date-fns';
import './insights-export.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import logo from '@/assets/images/worklenz-light-mode.png';
import {
  evt_project_insights_members_visit,
  evt_project_insights_overview_visit,
  evt_project_insights_tasks_visit,
} from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';

type SegmentType = 'Overview' | 'Members' | 'Tasks';

const ProjectViewInsights = () => {
  const { projectId } = useParams();
  const { t } = useTranslation('project-view-insights');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const exportRef = useRef<HTMLDivElement>(null);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();
  const [exportLoading, setExportLoading] = useState(false);
  const { activeSegment, includeArchivedTasks } = useAppSelector(
    state => state.projectInsightsReducer
  );
  const { project: selectedProject } = useAppSelector(state => state.projectReducer);

  const handleSegmentChange = (value: SegmentType) => {
    dispatch(setActiveSegment(value));
  };

  const toggleArchivedTasks = () => {
    dispatch(setIncludeArchivedTasks(!includeArchivedTasks));
  };

  useEffect(() => {
    if (projectId) {
      dispatch(setProjectId(projectId));
    }
  }, [projectId]);

  const renderSegmentContent = () => {
    if (!projectId) return null;

    switch (activeSegment) {
      case 'Overview':
        trackMixpanelEvent(evt_project_insights_overview_visit, { project_id: projectId });
        return <InsightsOverview t={t} />;
      case 'Members':
        trackMixpanelEvent(evt_project_insights_members_visit, { project_id: projectId });
        return <InsightsMembers t={t} />;
      case 'Tasks':
        trackMixpanelEvent(evt_project_insights_tasks_visit, { project_id: projectId });
        return <InsightsTasks t={t} />;
    }
  };

  const handleExport = async () => {
    if (!projectId) return;
    try {
      setExportLoading(true);
      await dispatch(setActiveSegment(activeSegment));
      await exportPdf(selectedProject?.name || '', activeSegment);
    } catch (error) {
      console.error(error);
    } finally {
      setExportLoading(false);
    }
  };

  const exportPdf = async (projectName: string | null, activeSegment: string | '') => {
    if (!exportRef.current) return;
    const element = exportRef.current;

    // Temporarily disable overflow/height constraints so html2canvas captures the
    // full, unscrolled content (charts + tables) instead of only the visible viewport.
    const scrollables = element.querySelectorAll(
      '.overflow-y-auto, .overflow-x-auto, .overflow-y-scroll, .overflow-x-scroll, [style*="overflow"], [style*="height: calc"], [style*="max-height"]'
    );
    const originalStyles = new Map<Element, string>();
    scrollables.forEach(el => {
      originalStyles.set(el, el.getAttribute('style') || '');
      (el as HTMLElement).style.overflow = 'visible';
      (el as HTMLElement).style.height = 'auto';
      (el as HTMLElement).style.maxHeight = 'none';
    });

    let imgData = '';
    try {
      // Scope a light theme to the captured subtree only by toggling a CSS class
      // directly on the DOM node (no React re-render / remount). This avoids
      // flipping global theme state or localStorage, and never disturbs the rest
      // of the app UI.
      element.classList.add('insights-export-light');
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await new Promise<void>(resolve => setTimeout(resolve, 60));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff',
      });
      imgData = canvas.toDataURL('image/png');
    } catch (captureError) {
      console.error('exportPdf capture failed', captureError);
      return;
    } finally {
      scrollables.forEach(el => {
        const original = originalStyles.get(el);
        if (original) {
          el.setAttribute('style', original);
        } else {
          el.removeAttribute('style');
        }
      });
      element.classList.remove('insights-export-light');
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const bufferX = 5;
    const bufferY = 28;
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pageWidth - 2 * bufferX;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    const renderPdf = (logoEl?: HTMLImageElement) => {
      if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
        pdf.addImage(logoEl, 'PNG', pageWidth / 2 - 12, 5, 30, 6.5);
      }
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0, 0.85);
      pdf.text(
        [`Insights - ${projectName} - ${activeSegment}`, format(new Date(), 'yyyy-MM-dd')],
        pageWidth / 2,
        17,
        { align: 'center' }
      );

      // Split the tall image across A4 pages contiguously (no overlap/clipping).
      pdf.addImage(imgData, 'PNG', bufferX, bufferY, pdfWidth, pdfHeight);
      let heightLeft = pdfHeight - (pageHeight - bufferY);
      let position = bufferY - pageHeight;
      while (heightLeft > 0) {
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', bufferX, position, pdfWidth, pdfHeight);
        position -= pageHeight;
        heightLeft -= pageHeight;
      }

      pdf.save(`${activeSegment} ${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const logoImg = new Image();
    logoImg.src = logo;
    if (logoImg.complete) {
      renderPdf(logoImg);
    } else {
      logoImg.onload = () => renderPdf(logoImg);
      logoImg.onerror = () => renderPdf();
    }
  };

  useEffect(() => {
    if (projectId) {
      dispatch(setActiveSegment('Overview'));
    }
  }, [refreshTimestamp]);

  return (
    <Flex vertical gap={24}>
      <Flex align="center" justify="space-between">
        <PillToggle<SegmentType>
          value={activeSegment}
          onChange={handleSegmentChange}
          options={[
            { value: 'Overview', label: t('overviewTab', { defaultValue: 'Overview' }) },
            { value: 'Members', label: t('membersTab', { defaultValue: 'Members' }) },
            { value: 'Tasks', label: t('tasksTab', { defaultValue: 'Tasks' }) },
          ]}
        />

        <Flex gap={8}>
          <Flex
            gap={8}
            align="center"
            style={{
              backgroundColor: themeMode === 'dark' ? '#141414' : '#f5f5f5',
              padding: '6px 15px',
              borderRadius: 4,
            }}
          >
            <Checkbox checked={includeArchivedTasks} onClick={toggleArchivedTasks} />
            <Badge color={includeArchivedTasks ? colors.limeGreen : colors.vibrantOrange} dot>
              {t('common.includeArchivedTasks')}
            </Badge>
          </Flex>

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exportLoading}
          >
            {t('common.export')}
          </Button>
        </Flex>
      </Flex>
      <div ref={exportRef}>{renderSegmentContent()}</div>
    </Flex>
  );
};

export default ProjectViewInsights;
