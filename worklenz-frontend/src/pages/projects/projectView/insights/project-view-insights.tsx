import { DownloadOutlined } from '@/shared/antd-imports';
import { Badge, Button, Checkbox, Flex, Segmented } from '@/shared/antd-imports';
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
        trackMixpanelEvent(evt_project_insights_overview_visit);
        return <InsightsOverview t={t} />;
      case 'Members':
        trackMixpanelEvent(evt_project_insights_members_visit);
        return <InsightsMembers t={t} />;
      case 'Tasks':
        trackMixpanelEvent(evt_project_insights_tasks_visit);
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
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const bufferX = 5;
    const bufferY = 28;
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth() - 2 * bufferX;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    const logoImg = new Image();
    logoImg.src = logo;
    logoImg.onload = () => {
      pdf.addImage(logoImg, 'PNG', pdf.internal.pageSize.getWidth() / 2 - 12, 5, 30, 6.5);

      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0, 0.85);
      pdf.text(
        [`Insights - ${projectName} - ${activeSegment}`, format(new Date(), 'yyyy-MM-dd')],
        pdf.internal.pageSize.getWidth() / 2,
        17,
        { align: 'center' }
      );

      pdf.addImage(imgData, 'PNG', bufferX, bufferY, pdfWidth, pdfHeight);
      pdf.save(`${activeSegment} ${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    logoImg.onerror = error => {
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0, 0.85);
      pdf.text(
        [`Insights - ${projectName} - ${activeSegment}`, format(new Date(), 'yyyy-MM-dd')],
        pdf.internal.pageSize.getWidth() / 2,
        17,
        { align: 'center' }
      );
      pdf.addImage(imgData, 'PNG', bufferX, bufferY, pdfWidth, pdfHeight);
      pdf.save(`${activeSegment} ${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };
  };

  useEffect(() => {
    if (projectId) {
      dispatch(setActiveSegment('Overview'));
    }
  }, [refreshTimestamp]);

  return (
    <Flex vertical gap={24}>
      <Flex align="center" justify="space-between">
        <Segmented
          options={['Overview', 'Members', 'Tasks']}
          defaultValue={activeSegment}
          value={activeSegment}
          onChange={handleSegmentChange}
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
