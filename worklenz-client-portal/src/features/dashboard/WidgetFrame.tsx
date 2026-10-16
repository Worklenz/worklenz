import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  Button,
  Checkbox,
  EyeInvisibleOutlined,
  Flex,
  HolderOutlined,
  Popover,
  Radio,
  Select,
  SettingOutlined,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { ClientProjectV2, DashboardWidgetInstance, ProjectCardField, ProjectsWidgetSettings } from '@/types/v2';
import { ALL_CARD_FIELDS, WIDGET_META, WIDTH_OPTIONS } from './layoutModel';
import type { DashboardLayoutApi } from './useDashboardLayout';

interface WidgetFrameProps {
  widget: DashboardWidgetInstance;
  isEditing: boolean;
  layout: DashboardLayoutApi;
  projects: ClientProjectV2[];
  /** Briefly outlines the widget that was just added so the eye lands on it. */
  isFlashing?: boolean;
  children: React.ReactNode;
}

/**
 * Wraps one widget. Outside edit mode it is invisible; while customising it adds a drag handle, a
 * settings popover (with keyboard-friendly move and size controls) and a hide button.
 */
export const WidgetFrame = ({ widget, isEditing, layout, projects, isFlashing = false, children }: WidgetFrameProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const meta = WIDGET_META[widget.type];
  const title = t(meta.titleKey, { defaultValue: meta.defaultTitle });

  return (
    <Flex
      vertical
      style={{
        height: '100%',
        borderRadius: 8,
        outline: isFlashing ? `3px solid ${token.colorPrimary}` : isEditing ? `1px dashed ${token.colorPrimaryBorder}` : undefined,
        outlineOffset: 2,
        transition: 'outline-color 300ms ease',
      }}
    >
      {isEditing && (
        <Flex
          align="center"
          justify="space-between"
          gap={4}
          style={{ height: 36, flex: '0 0 auto', padding: '0 4px', background: token.colorFillQuaternary, borderRadius: '8px 8px 0 0' }}
        >
          <Flex className="dashboard-drag-handle" align="center" gap={4} style={{ flex: 1, minWidth: 0, cursor: 'grab' }}>
            <HolderOutlined aria-hidden style={{ color: token.colorTextTertiary }} />
            <Typography.Text ellipsis type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {title}
            </Typography.Text>
          </Flex>
          <Flex className="dashboard-no-drag" gap={2}>
            <Popover
              trigger="click"
              placement="bottomRight"
              title={t('dashboard.customize.widgetSettings', { name: title, defaultValue: '{{name}} settings' })}
              content={<WidgetSettings widget={widget} layout={layout} projects={projects} />}
            >
              <Button
                type="text"
                icon={<SettingOutlined />}
                aria-label={t('dashboard.customize.settingsFor', { name: title, defaultValue: 'Settings for {{name}}' })}
              />
            </Popover>
            <Button
              type="text"
              icon={<EyeInvisibleOutlined />}
              onClick={() => layout.hide(widget.type)}
              aria-label={t('dashboard.customize.hideWidget', { name: title, defaultValue: 'Hide {{name}}' })}
            />
          </Flex>
        </Flex>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', pointerEvents: isEditing ? 'none' : undefined }}>{children}</div>
    </Flex>
  );
};

const WIDTH_LABELS: Record<number, [string, string]> = {
  3: ['dashboard.customize.widthQuarter', 'Quarter width'],
  4: ['dashboard.customize.widthThird', 'One third'],
  6: ['dashboard.customize.widthHalf', 'Half width'],
  8: ['dashboard.customize.widthTwoThirds', 'Two thirds'],
  9: ['dashboard.customize.widthThreeQuarters', 'Three quarters'],
  12: ['dashboard.customize.widthFull', 'Full width'],
};

const FIELD_LABELS: Record<ProjectCardField, [string, string]> = {
  status: ['dashboard.customize.fieldStatus', 'Status'],
  progress: ['dashboard.customize.fieldProgress', 'Progress bar'],
  phase: ['dashboard.customize.fieldPhase', 'Current phase'],
  nextMilestone: ['dashboard.customize.fieldNextMilestone', 'Next milestone'],
  expectedCompletion: ['dashboard.customize.fieldExpectedCompletion', 'Expected completion'],
  openItems: ['dashboard.customize.fieldOpenItems', 'Open approvals and change requests'],
  sharedCounts: ['dashboard.customize.fieldSharedCounts', 'Shared milestones, tasks and files'],
};

const WidgetSettings = ({ widget, layout, projects }: { widget: DashboardWidgetInstance; layout: DashboardLayoutApi; projects: ClientProjectV2[] }) => {
  const { t } = useTranslation();
  const label = (pair: [string, string]) => t(pair[0], { defaultValue: pair[1] });
  const widthOptions = WIDTH_OPTIONS.filter(w => w >= WIDGET_META[widget.type].min.w).map(w => ({ value: w, label: label(WIDTH_LABELS[w]) }));

  return (
    <Flex vertical gap={12} style={{ width: 280 }}>
      <Flex vertical gap={4}>
        <Typography.Text strong>{t('dashboard.customize.width', { defaultValue: 'Width' })}</Typography.Text>
        <Select
         
          value={widget.w}
          options={widthOptions}
          onChange={w => layout.resize(widget.type, { w })}
          aria-label={t('dashboard.customize.width', { defaultValue: 'Width' })}
        />
      </Flex>
      <Flex gap={8}>
        <Button icon={<ArrowUpOutlined />} onClick={() => layout.move(widget.type, -1)}>
          {t('dashboard.customize.moveEarlier', { defaultValue: 'Move earlier' })}
        </Button>
        <Button icon={<ArrowDownOutlined />} onClick={() => layout.move(widget.type, 1)}>
          {t('dashboard.customize.moveLater', { defaultValue: 'Move later' })}
        </Button>
      </Flex>
      {widget.type === 'projects' && widget.settings && (
        <ProjectsSettings settings={widget.settings} projects={projects} onChange={layout.updateProjectsSettings} />
      )}
    </Flex>
  );
};

const ProjectsSettings = ({
  settings,
  projects,
  onChange,
}: {
  settings: ProjectsWidgetSettings;
  projects: ClientProjectV2[];
  onChange: (patch: Partial<ProjectsWidgetSettings>) => void;
}) => {
  const { t } = useTranslation();
  const allSelected = settings.projectIds === 'all';
  return (
    <>
      <Flex vertical gap={4}>
        <Typography.Text strong>{t('dashboard.customize.projectsShown', { defaultValue: 'Projects shown' })}</Typography.Text>
        <Radio.Group
          value={allSelected ? 'all' : 'some'}
          onChange={event => onChange({ projectIds: event.target.value === 'all' ? 'all' : projects.map(project => project.id) })}
        >
          <Flex vertical gap={4}>
            <Radio value="all">{t('dashboard.customize.allProjects', { defaultValue: 'All projects (includes new ones)' })}</Radio>
            <Radio value="some">{t('dashboard.customize.selectedProjects', { defaultValue: 'Selected projects' })}</Radio>
          </Flex>
        </Radio.Group>
        {!allSelected && (
          <Select
            mode="multiple"
           
            allowClear
            showSearch
            optionFilterProp="label"
            value={settings.projectIds as string[]}
            options={projects.map(project => ({ value: project.id, label: project.name }))}
            placeholder={t('dashboard.customize.chooseProjects', { defaultValue: 'Choose projects' })}
            onChange={projectIds => onChange({ projectIds })}
            aria-label={t('dashboard.customize.projectsShown', { defaultValue: 'Projects shown' })}
          />
        )}
      </Flex>
      <Flex vertical gap={4}>
        <Typography.Text strong>{t('dashboard.customize.cardLayout', { defaultValue: 'Card layout' })}</Typography.Text>
        <Radio.Group value={settings.view} onChange={event => onChange({ view: event.target.value as ProjectsWidgetSettings['view'] })}>
          <Radio value="cards">{t('dashboard.customize.viewCards', { defaultValue: 'Cards' })}</Radio>
          <Radio value="compact">{t('dashboard.customize.viewCompact', { defaultValue: 'Compact' })}</Radio>
        </Radio.Group>
      </Flex>
      <Flex vertical gap={4}>
        <Typography.Text strong>{t('dashboard.customize.cardFields', { defaultValue: 'Show on each card' })}</Typography.Text>
        {ALL_CARD_FIELDS.map(field => (
          <Checkbox
            key={field}
            checked={settings.cardFields.includes(field)}
            onChange={event =>
              onChange({ cardFields: event.target.checked ? [...settings.cardFields, field] : settings.cardFields.filter(item => item !== field) })
            }
          >
            {t(FIELD_LABELS[field][0], { defaultValue: FIELD_LABELS[field][1] })}
          </Checkbox>
        ))}
      </Flex>
    </>
  );
};
