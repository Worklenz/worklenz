import React, { memo, useState } from 'react';
import { Button, Space, theme } from '@/shared/antd-imports';
import { ZoomInOutlined, ZoomOutOutlined, ExpandOutlined } from '@ant-design/icons';
import { GanttViewMode, GanttGroupingMode, PhaseSortMode } from '../../types/gantt-types';
import { useTranslation } from 'react-i18next';
import AssigneeScopeIndicator from '@/components/task-management/assignee-scope-indicator';

interface GanttToolbarProps {
  viewMode: GanttViewMode;
  groupingMode: GanttGroupingMode;
  onViewModeChange: (mode: GanttViewMode) => void;
  onGroupingModeChange: (mode: GanttGroupingMode) => void;
  phaseSortMode: PhaseSortMode;
  onPhaseSortModeChange: (mode: PhaseSortMode) => void;
  dateRange?: { start: Date; end: Date };
  onScrollToToday?: () => void;
  onToggleFullscreen?: () => void;
}

// Pill-style toggle button group — mirrors PillToggle.tsx (pages/home) and the
// zoomBtnStyle helper in PlannerScheduleView.tsx/PlannerTimelineView.tsx, duplicated
// locally per the codebase's existing convention rather than importing cross-feature.
interface PillOption<T extends string> {
  label: string;
  value: T;
}

interface PillToggleGroupProps<T extends string> {
  value: T;
  options: PillOption<T>[];
  onChange: (value: T) => void;
}

function PillToggleGroup<T extends string>({ value, options, onChange }: PillToggleGroupProps<T>) {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 7,
        overflow: 'hidden',
      }}
    >
      {options.map((opt, idx) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '5px 12px',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            borderRight: idx < options.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
            background: value === opt.value ? token.colorPrimary : 'transparent',
            color: value === opt.value ? token.colorTextLightSolid : token.colorText,
            transition: 'all .15s',
            whiteSpace: 'nowrap',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const ZOOM_ORDER: GanttViewMode[] = ['day', 'week', 'month'];

const GanttToolbar: React.FC<GanttToolbarProps> = memo(
  ({
    viewMode,
    groupingMode,
    onViewModeChange,
    onGroupingModeChange,
    phaseSortMode,
    onPhaseSortModeChange,
    onScrollToToday,
    onToggleFullscreen,
  }) => {
    const { t } = useTranslation('gantt');
    const { token } = theme.useToken();
    const [isTodaySelected, setIsTodaySelected] = useState(false);

    const zoomIndex = ZOOM_ORDER.indexOf(viewMode);

    const handleZoomIn = () => {
      if (zoomIndex > 0) {
        setIsTodaySelected(false);
        onViewModeChange(ZOOM_ORDER[zoomIndex - 1]);
      }
    };

    const handleZoomOut = () => {
      if (zoomIndex < ZOOM_ORDER.length - 1) {
        setIsTodaySelected(false);
        onViewModeChange(ZOOM_ORDER[zoomIndex + 1]);
      }
    };

    const handleTodayClick = () => {
      setIsTodaySelected(true);
      onScrollToToday?.();
    };

    return (
      <div className="p-1.5 bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-[#303030] rounded-md shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-2">
          <AssigneeScopeIndicator />
          {/* Grouping Mode Selector */}
          <span style={{ fontSize: 12, fontWeight: 500, color: token.colorTextSecondary }}>
            {t('toolbar.viewBy', { defaultValue: 'View by' })}
          </span>
          <PillToggleGroup
            value={groupingMode}
            onChange={mode => {
              setIsTodaySelected(false);
              onGroupingModeChange(mode);
            }}
            options={[
              { label: t('grouping.phase', { defaultValue: 'Phase' }), value: 'phase' },
              { label: t('grouping.status', { defaultValue: 'Status' }), value: 'status' },
              { label: t('grouping.priority', { defaultValue: 'Priority' }), value: 'priority' },
            ]}
          />

          {/* Phase sort mode — only meaningful when grouped by Phase */}
          {groupingMode === 'phase' && (
            <>
              <span style={{ fontSize: 12, fontWeight: 500, color: token.colorTextSecondary }}>
                {t('toolbar.sortBy', { defaultValue: 'Sort by' })}
              </span>
              <PillToggleGroup
                value={phaseSortMode}
                onChange={onPhaseSortModeChange}
                options={[
                  { label: t('toolbar.sortManual', { defaultValue: 'Manual' }), value: 'manual' },
                  { label: t('toolbar.sortChronological', { defaultValue: 'Chronological' }), value: 'chronological' },
                ]}
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom in/out + fullscreen — same circular icon-button style as Planner > Timeline.
              This is now the only way to switch Day/Week/Month (the separate pill toggle for
              it was removed), so it remains even though the buttons look secondary. */}
          <Space size={4}>
            <Button
              size="small"
              shape="circle"
              icon={<ZoomInOutlined />}
              onClick={handleZoomIn}
              disabled={zoomIndex === 0}
              title={t('toolbar.zoomIn', { defaultValue: 'Zoom In' })}
            />
            <Button
              size="small"
              shape="circle"
              icon={<ZoomOutOutlined />}
              onClick={handleZoomOut}
              disabled={zoomIndex === ZOOM_ORDER.length - 1}
              title={t('toolbar.zoomOut', { defaultValue: 'Zoom Out' })}
            />
            <Button
              size="small"
              shape="circle"
              icon={<ExpandOutlined />}
              onClick={onToggleFullscreen}
              title={t('toolbar.fullscreen', { defaultValue: 'Fullscreen' })}
            />
          </Space>

          {/* Today — same single-button pill as Planner > Timeline's Today button */}
          <div
            style={{
              display: 'inline-flex',
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 7,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={handleTodayClick}
              style={{
                padding: '5px 12px',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                background: isTodaySelected ? token.colorPrimary : 'transparent',
                color: isTodaySelected ? token.colorTextLightSolid : token.colorText,
                transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}
            >
              {t('toolbar.today', { defaultValue: 'Today' })}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

GanttToolbar.displayName = 'GanttToolbar';

export default GanttToolbar;
