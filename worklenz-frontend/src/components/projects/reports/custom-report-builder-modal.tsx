import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Col,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Spin,
  Typography,
  theme,
} from '@/shared/antd-imports';

import { softwareReportsApiService } from '@/api/software-reports/software-reports.api.service';
import alertService from '@/services/alerts/alertService';
import {
  CustomReportSource,
  ICustomReport,
  ICustomReportData,
  ICustomReportInput,
} from '@/types/project/softwareReports.types';
import { isAnnouncedApiError } from '@/components/projects/releases/release-utils';
import {
  CUSTOM_REPORT_FILTERS,
  CUSTOM_REPORT_NAME_MAX_LENGTH,
  CUSTOM_REPORT_SOURCES,
  CUSTOM_REPORT_SOURCE_KEYS,
  CUSTOM_REPORT_VISIBILITIES,
  CUSTOM_REPORT_VISUALIZATIONS,
  DEFAULT_CUSTOM_REPORT,
  getFilterLabel,
  getGroupLabel,
  getMetricLabel,
  getSourceLabel,
  getVisibilityLabel,
  getVisualizationLabel,
} from './custom-report-config';
import { CustomReportVisual } from './custom-report-visual';

interface CustomReportBuilderModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onSaved: (report: ICustomReport) => void;
}

/** Five-step builder for saved custom reports, with a live preview of real project data. */
export const CustomReportBuilderModal = ({
  open,
  projectId,
  onClose,
  onSaved,
}: CustomReportBuilderModalProps) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const [form] = Form.useForm<ICustomReportInput>();
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<ICustomReportData | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [hasPreviewError, setHasPreviewError] = useState(false);

  const source = Form.useWatch('source', form) ?? DEFAULT_CUSTOM_REPORT.source;
  const metric = Form.useWatch('metric', form) ?? DEFAULT_CUSTOM_REPORT.metric;
  const groupBy = Form.useWatch('group_by', form) ?? DEFAULT_CUSTOM_REPORT.group_by;
  const filter = Form.useWatch('filter', form) ?? DEFAULT_CUSTOM_REPORT.filter;
  const visualization = Form.useWatch('visualization', form) ?? DEFAULT_CUSTOM_REPORT.visualization;
  const sourceRules = CUSTOM_REPORT_SOURCES[source];
  const isDefinitionValid =
    sourceRules.metrics.includes(metric) && sourceRules.groups.includes(groupBy);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      ...DEFAULT_CUSTOM_REPORT,
      name: t('customReportDefaultName', { defaultValue: 'Delivery by assignee' }),
    });
    setPreview(null);
  }, [form, open, t]);

  useEffect(() => {
    if (!open || !isDefinitionValid) return;
    let isActive = true;
    setIsPreviewLoading(true);
    setHasPreviewError(false);

    const timer = window.setTimeout(() => {
      softwareReportsApiService
        .previewCustomReport(projectId, { source, metric, group_by: groupBy, filter })
        .then(response => {
          if (!isActive) return;
          if (response.done) setPreview(response.body);
          else setHasPreviewError(true);
        })
        .catch(() => {
          if (isActive) setHasPreviewError(true);
        })
        .finally(() => {
          if (isActive) setIsPreviewLoading(false);
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [filter, groupBy, isDefinitionValid, metric, open, projectId, source]);

  const handleSourceChange = (nextSource: CustomReportSource) => {
    const rules = CUSTOM_REPORT_SOURCES[nextSource];
    form.setFieldsValue({
      metric: rules.metrics.includes(metric) ? metric : rules.metrics[0],
      group_by: rules.groups.includes(groupBy) ? groupBy : rules.groups[0],
      filter: rules.supportsFilter ? filter : 'all',
    });
  };

  const handleSubmit = async (values: ICustomReportInput) => {
    setIsSaving(true);
    try {
      const response = await softwareReportsApiService.createCustomReport(projectId, {
        ...values,
        name: values.name.trim(),
      });
      if (response.done) {
        alertService.success(
          t('customReportSavedTitle', { defaultValue: 'Report saved' }),
          t('customReportSaved', { defaultValue: '{{name}} was added to custom reports', name: response.body.name })
        );
        onSaved(response.body);
        onClose();
      }
    } catch (error) {
      if (!isAnnouncedApiError(error)) {
        alertService.error(
          t('customReportSaveErrorTitle', { defaultValue: 'Could not save the report' }),
          t('retryLater', { defaultValue: 'Please try again.' })
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('customReportBuilderTitle', { defaultValue: 'Create custom report' })}
      onCancel={onClose}
      width={760}
      forceRender
      footer={
        <Flex justify="end" gap={8}>
          <Button onClick={onClose}>{t('cancel', { defaultValue: 'Cancel' })}</Button>
          <Button type="primary" loading={isSaving} onClick={() => form.submit()}>
            {t('customReportSave', { defaultValue: 'Save report' })}
          </Button>
        </Flex>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={DEFAULT_CUSTOM_REPORT}
        onFinish={handleSubmit}
      >
        <Form.Item
          name="name"
          label={<StepLabel step={1} label={t('customReportName', { defaultValue: 'Report name' })} />}
          rules={[
            {
              required: true,
              whitespace: true,
              message: t('customReportNameRequired', { defaultValue: 'Enter a report name' }),
            },
          ]}
        >
          <Input maxLength={CUSTOM_REPORT_NAME_MAX_LENGTH} autoFocus />
        </Form.Item>

        <Form.Item
          name="source"
          label={<StepLabel step={2} label={t('customReportSourceLabel', { defaultValue: 'Data source' })} />}
        >
          <Select
            onChange={handleSourceChange}
            options={CUSTOM_REPORT_SOURCE_KEYS.map(key => ({ value: key, label: getSourceLabel(t, key) }))}
          />
        </Form.Item>

        <StepLabel step={3} label={t('customReportMeasure', { defaultValue: 'What to measure' })} />
        <Row gutter={12} className="mt-2">
          <Col xs={24} sm={12}>
            <Form.Item name="metric" label={t('customReportMetricLabel', { defaultValue: 'Metric' })}>
              <Select
                options={sourceRules.metrics.map(key => ({
                  value: key,
                  label: getMetricLabel(t, key, source),
                }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="group_by" label={t('customReportGroupLabel', { defaultValue: 'Group by' })}>
              <Select
                disabled={sourceRules.groups.length === 1}
                options={sourceRules.groups.map(key => ({ value: key, label: getGroupLabel(t, key) }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="filter"
          label={<StepLabel step={4} label={t('customReportFilterLabel', { defaultValue: 'Filter' })} />}
          extra={
            sourceRules.supportsFilter
              ? undefined
              : t('customReportFilterUnavailable', {
                  defaultValue: 'Filters apply to work items and time logs only.',
                })
          }
        >
          <Select
            disabled={!sourceRules.supportsFilter}
            options={CUSTOM_REPORT_FILTERS.map(key => ({ value: key, label: getFilterLabel(t, key) }))}
          />
        </Form.Item>

        <StepLabel step={5} label={t('customReportDisplay', { defaultValue: 'Display and sharing' })} />
        <Row gutter={12} className="mt-2">
          <Col xs={24} sm={12}>
            <Form.Item
              name="visualization"
              label={t('customReportVisualLabel', { defaultValue: 'Visualization' })}
            >
              <Select
                options={CUSTOM_REPORT_VISUALIZATIONS.map(key => ({
                  value: key,
                  label: getVisualizationLabel(t, key),
                }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="visibility"
              label={t('customReportVisibilityLabel', { defaultValue: 'Visibility' })}
              extra={t('customReportVisibilityHint', {
                defaultValue: 'Project reports are visible to all project members.',
              })}
            >
              <Select
                options={CUSTOM_REPORT_VISIBILITIES.map(key => ({
                  value: key,
                  label: getVisibilityLabel(t, key),
                }))}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <section
        className="p-4"
        style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8 }}
        aria-label={t('customReportPreview', { defaultValue: 'Preview' })}
      >
        <Typography.Text strong className="text-sm">
          {t('customReportPreview', { defaultValue: 'Preview' })}
        </Typography.Text>
        <Typography.Text type="secondary" className="block text-xs mt-0.5 mb-3">
          {t('customReportPreviewSummary', {
            defaultValue: '{{metric}} grouped by {{group}}',
            metric: getMetricLabel(t, metric, source),
            group: getGroupLabel(t, groupBy).toLowerCase(),
          })}
        </Typography.Text>
        <Spin spinning={isPreviewLoading}>
          {hasPreviewError ? (
            <Typography.Text type="danger" className="text-xs">
              {t('customReportPreviewError', { defaultValue: 'Could not load the preview.' })}
            </Typography.Text>
          ) : preview ? (
            <CustomReportVisual
              data={preview}
              source={source}
              metric={metric}
              groupBy={groupBy}
              visualization={visualization}
            />
          ) : (
            <div className="h-[260px]" />
          )}
        </Spin>
      </section>
    </Modal>
  );
};

const StepLabel = ({ step, label }: { step: number; label: string }) => {
  const { token } = theme.useToken();

  return (
    <Flex align="center" gap={8}>
      <span
        className="inline-grid place-items-center w-5 h-5 rounded-full text-[11px] font-semibold flex-none"
        style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary }}
        aria-hidden="true"
      >
        {step}
      </span>
      <span className="font-medium">{label}</span>
    </Flex>
  );
};

const PREVIEW_DEBOUNCE_MS = 300;
