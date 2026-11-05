import React, { useMemo } from 'react';
import { theme } from '@/shared/antd-imports';
import './report-card-preview.css';

export type ReportPreviewKind =
  | 'project-health'
  | 'planned-vs-actual-tasks'
  | 'planned-vs-actual-milestones'
  | 'utilization'
  | 'time-report'
  | 'budget-tracking'
  | 'velocity'
  | 'cumulative-flow'
  | 'time-in-status'
  | 'sla';

interface ReportCardPreviewProps {
  kind: string;
  /** Optional live series (0–100) used when the prototype accepts bars/points. */
  series?: number[];
  muted?: boolean;
}

interface PreviewPalette {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  track: string;
  text: string;
}

const FALLBACK_SERIES = [38, 52, 44, 68, 56, 72, 48, 80, 60, 74];

const clampSeries = (series: number[] | undefined, count: number): number[] => {
  const source = series && series.length > 0 ? series : FALLBACK_SERIES;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = source[i % source.length] ?? 40;
    out.push(Math.max(8, Math.min(100, Math.round(raw))));
  }
  return out;
};

const BarPreview: React.FC<{
  values: number[];
  colors: string[];
  width?: number;
  height?: number;
  gap?: number;
}> = ({ values, colors, width = 200, height = 72, gap = 4 }) => {
  const barWidth = (width - gap * (values.length - 1)) / values.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="report-card-preview__svg" aria-hidden>
      {values.map((value, index) => {
        const barHeight = (value / 100) * (height - 4);
        const x = index * (barWidth + gap);
        const y = height - barHeight;
        return (
          <rect
            key={`bar-${index}`}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={2}
            fill={colors[index % colors.length]}
            opacity={0.9}
          />
        );
      })}
    </svg>
  );
};

const DualBarPreview: React.FC<{
  left: number[];
  right: number[];
  leftColor: string;
  rightColor: string;
}> = ({ left, right, leftColor, rightColor }) => {
  const width = 200;
  const height = 72;
  const groups = Math.min(left.length, right.length, 6);
  const groupGap = 8;
  const groupWidth = (width - groupGap * (groups - 1)) / groups;
  const barGap = 2;
  const barWidth = (groupWidth - barGap) / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="report-card-preview__svg" aria-hidden>
      {Array.from({ length: groups }).map((_, index) => {
        const lx = index * (groupWidth + groupGap);
        const rx = lx + barWidth + barGap;
        const lh = (left[index]! / 100) * (height - 4);
        const rh = (right[index]! / 100) * (height - 4);
        return (
          <g key={`dual-${index}`}>
            <rect x={lx} y={height - lh} width={barWidth} height={lh} rx={2} fill={leftColor} opacity={0.55} />
            <rect x={rx} y={height - rh} width={barWidth} height={rh} rx={2} fill={rightColor} opacity={0.95} />
          </g>
        );
      })}
    </svg>
  );
};

const LinePreview: React.FC<{
  values: number[];
  color: string;
  fill?: string;
}> = ({ values, color, fill }) => {
  const width = 200;
  const height = 72;
  const pad = 4;
  const points = values.map((value, index) => {
    const x = pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - (value / 100) * (height - pad * 2);
    return `${x},${y}`;
  });
  const polyline = points.join(' ');
  const area = `${pad},${height - pad} ${polyline} ${width - pad},${height - pad}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="report-card-preview__svg" aria-hidden>
      {fill && <polygon points={area} fill={fill} opacity={0.2} />}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((value, index) => {
        const x = pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
        const y = height - pad - (value / 100) * (height - pad * 2);
        return <circle key={`pt-${index}`} cx={x} cy={y} r={2.2} fill={color} />;
      })}
    </svg>
  );
};

const StackedAreaPreview: React.FC<{ palette: PreviewPalette }> = ({ palette }) => {
  const width = 200;
  const height = 72;
  const layers = [
    { color: palette.primary, tops: [28, 34, 40, 46, 52, 58, 62, 68, 72, 78] },
    { color: palette.secondary, tops: [18, 22, 26, 30, 34, 38, 40, 44, 46, 50] },
    { color: palette.success, tops: [10, 12, 14, 16, 18, 20, 22, 24, 26, 28] },
  ];

  const toPoints = (tops: number[]) =>
    tops
      .map((top, index) => {
        const x = (index / Math.max(tops.length - 1, 1)) * width;
        const y = height - (top / 100) * height;
        return `${x},${y}`;
      })
      .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="report-card-preview__svg" aria-hidden>
      {layers.map((layer, index) => {
        const top = toPoints(layer.tops);
        const bottom = `0,${height} ${width},${height}`;
        return (
          <polygon
            key={`layer-${index}`}
            points={`${top} ${bottom}`}
            fill={layer.color}
            opacity={0.35 + index * 0.12}
          />
        );
      })}
    </svg>
  );
};

const HorizontalBarsPreview: React.FC<{
  values: number[];
  colors: string[];
  track: string;
}> = ({ values, colors, track }) => {
  const width = 200;
  const height = 72;
  const rowGap = 6;
  const rowHeight = (height - rowGap * (values.length - 1)) / values.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="report-card-preview__svg" aria-hidden>
      {values.map((value, index) => {
        const y = index * (rowHeight + rowGap);
        const barWidth = (value / 100) * width;
        return (
          <g key={`h-${index}`}>
            <rect x={0} y={y} width={width} height={rowHeight} rx={3} fill={track} />
            <rect
              x={0}
              y={y}
              width={barWidth}
              height={rowHeight}
              rx={3}
              fill={colors[index % colors.length]}
              opacity={0.9}
            />
          </g>
        );
      })}
    </svg>
  );
};

/** Mirrors Project Health chart: Progress % + Budget used % grouped bars. */
const HealthPreview: React.FC<{ palette: PreviewPalette; series: number[] }> = ({
  palette,
  series,
}) => {
  const width = 200;
  const height = 72;
  const progressColor = palette.primary;
  const budgetColor = palette.warning;
  const progress = clampSeries(
    series.map((v, i) => (i % 2 === 0 ? v : Math.max(20, v - 14))),
    5
  );
  const budget = clampSeries(
    series.map((v, i) => (i % 2 === 0 ? Math.max(18, v - 10) : v)),
    5
  );
  const groups = 5;
  const groupGap = 10;
  const groupWidth = (width - groupGap * (groups - 1)) / groups;
  const barGap = 2;
  const barWidth = (groupWidth - barGap) / 2;
  const chartTop = 4;
  const chartHeight = height - chartTop - 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="report-card-preview__svg" aria-hidden>
      <line
        x1={0}
        y1={height - 1}
        x2={width}
        y2={height - 1}
        stroke={palette.track}
        strokeWidth={1}
      />
      {Array.from({ length: groups }).map((_, index) => {
        const gx = index * (groupWidth + groupGap);
        const ph = (progress[index]! / 100) * chartHeight;
        const bh = (budget[index]! / 100) * chartHeight;
        return (
          <g key={`health-${index}`}>
            <rect
              x={gx}
              y={chartTop + chartHeight - ph}
              width={barWidth}
              height={ph}
              rx={2}
              fill={progressColor}
              opacity={0.95}
            />
            <rect
              x={gx + barWidth + barGap}
              y={chartTop + chartHeight - bh}
              width={barWidth}
              height={bh}
              rx={2}
              fill={budgetColor}
              opacity={0.9}
            />
          </g>
        );
      })}
    </svg>
  );
};

/** Mirrors Budget Tracking chart: Budget (blue) vs Spent (magenta) grouped bars. */
const BudgetPreview: React.FC<{ palette: PreviewPalette; series: number[] }> = ({
  palette,
  series,
}) => {
  const width = 200;
  const height = 72;
  const budgetColor = palette.primary;
  const spentColor = '#eb2f96';
  const budget = clampSeries(
    series.map((v, i) => Math.min(100, Math.max(45, v + (i % 3) * 6))),
    5
  );
  const spent = clampSeries(
    series.map((v, i) => Math.max(18, Math.min(budget[i % budget.length]! - 8, v - (i % 2) * 8))),
    5
  );
  const groups = 5;
  const groupGap = 10;
  const groupWidth = (width - groupGap * (groups - 1)) / groups;
  const barGap = 2;
  const barWidth = (groupWidth - barGap) / 2;
  const chartTop = 4;
  const chartHeight = height - chartTop - 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="report-card-preview__svg" aria-hidden>
      <line
        x1={0}
        y1={height - 1}
        x2={width}
        y2={height - 1}
        stroke={palette.track}
        strokeWidth={1}
      />
      {Array.from({ length: groups }).map((_, index) => {
        const gx = index * (groupWidth + groupGap);
        const bh = (budget[index]! / 100) * chartHeight;
        const sh = (spent[index]! / 100) * chartHeight;
        return (
          <g key={`budget-${index}`}>
            <rect
              x={gx}
              y={chartTop + chartHeight - bh}
              width={barWidth}
              height={bh}
              rx={2}
              fill={budgetColor}
              opacity={0.95}
            />
            <rect
              x={gx + barWidth + barGap}
              y={chartTop + chartHeight - sh}
              width={barWidth}
              height={sh}
              rx={2}
              fill={spentColor}
              opacity={0.92}
            />
          </g>
        );
      })}
    </svg>
  );
};

/**
 * Mirrors Planned vs Actual: Milestones chart — “Days late” bars from baseline.
 * Positive = late (orange), negative/early = muted success below the axis.
 */
const VariancePreview: React.FC<{ palette: PreviewPalette; series: number[] }> = ({
  palette,
  series,
}) => {
  const width = 200;
  const height = 72;
  const mid = 40;
  const values = [12, -6, 22, 4, -10, 18, -3, 9].map((v, i) => {
    const live = series[i];
    if (live == null) return v;
    // Map live 0–100 spark into a signed variance-ish preview.
    return live >= 55 ? Math.round((live - 55) / 2) : -Math.round((55 - live) / 3);
  });
  const gap = 5;
  const barWidth = (width - gap * (values.length - 1)) / values.length;
  const maxMag = Math.max(...values.map(v => Math.abs(v)), 8);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="report-card-preview__svg" aria-hidden>
      {/* Planned baseline */}
      <line
        x1={0}
        y1={mid}
        x2={width}
        y2={mid}
        stroke={palette.text}
        strokeWidth={1.25}
        strokeDasharray="3 3"
        opacity={0.45}
      />
      {/* Soft planned date ticks */}
      {values.map((_, index) => {
        const x = index * (barWidth + gap) + barWidth / 2;
        return (
          <line
            key={`tick-${index}`}
            x1={x}
            y1={mid - 3}
            x2={x}
            y2={mid + 3}
            stroke={palette.text}
            strokeWidth={1}
            opacity={0.35}
          />
        );
      })}
      {values.map((value, index) => {
        const mag = Math.abs(value);
        const barHeight = Math.max(4, (mag / maxMag) * (mid - 8));
        const x = index * (barWidth + gap);
        const late = value >= 0;
        const y = late ? mid - barHeight : mid;
        return (
          <g key={`ms-${index}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={2}
              fill={late ? palette.warning : palette.success}
              opacity={late ? 0.95 : 0.7}
            />
            {/* Milestone flag tip */}
            <circle
              cx={x + barWidth / 2}
              cy={late ? y : y + barHeight}
              r={2}
              fill={late ? palette.warning : palette.success}
            />
          </g>
        );
      })}
    </svg>
  );
};

const SlaPreview: React.FC<{ palette: PreviewPalette }> = ({ palette }) => {
  const rings = [
    { r: 28, pct: 0.92, color: palette.success },
    { r: 20, pct: 0.78, color: palette.primary },
    { r: 12, pct: 0.64, color: palette.warning },
  ];

  return (
    <svg viewBox="0 0 200 72" className="report-card-preview__svg" aria-hidden>
      {rings.map((ring, index) => {
        const c = 2 * Math.PI * ring.r;
        const dash = c * ring.pct;
        return (
          <circle
            key={`ring-${index}`}
            cx={100}
            cy={36}
            r={ring.r}
            fill="none"
            stroke={ring.color}
            strokeWidth={5}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 100 36)"
            opacity={0.9}
          />
        );
      })}
    </svg>
  );
};

const resolveKind = (kind: string): ReportPreviewKind => {
  if (
    kind === 'project-health' ||
    kind === 'planned-vs-actual-tasks' ||
    kind === 'planned-vs-actual-milestones' ||
    kind === 'utilization' ||
    kind === 'time-report' ||
    kind === 'budget-tracking' ||
    kind === 'velocity' ||
    kind === 'cumulative-flow' ||
    kind === 'time-in-status' ||
    kind === 'sla'
  ) {
    return kind;
  }
  return 'time-report';
};

/**
 * Inline SVG chart prototypes for All Reports cards.
 * No image assets — works for cloud and self-hosted without extra files.
 */
export const ReportCardPreview: React.FC<ReportCardPreviewProps> = ({
  kind,
  series,
  muted = false,
}) => {
  const { token } = theme.useToken();
  const previewKind = resolveKind(kind);
  const values = useMemo(() => clampSeries(series, 10), [series]);

  const palette: PreviewPalette = {
    primary: token.colorPrimary,
    secondary: '#69b1ff',
    success: token.colorSuccess,
    warning: token.colorWarning,
    danger: token.colorError,
    track: token.colorFillSecondary,
    text: token.colorTextSecondary,
  };

  let chart: React.ReactNode;
  switch (previewKind) {
    case 'project-health':
      chart = <HealthPreview palette={palette} series={values} />;
      break;
    case 'planned-vs-actual-tasks':
      chart = (
        <DualBarPreview
          left={clampSeries(
            values.map(v => Math.max(30, v * 0.85)),
            6
          )}
          right={clampSeries(values, 6)}
          leftColor={palette.track}
          rightColor={palette.primary}
        />
      );
      break;
    case 'planned-vs-actual-milestones':
      chart = <VariancePreview palette={palette} series={values} />;
      break;
    case 'utilization':
      chart = (
        <DualBarPreview
          left={clampSeries(
            values.map(() => 100),
            6
          )}
          right={clampSeries(values, 6)}
          leftColor={palette.track}
          rightColor={palette.primary}
        />
      );
      break;
    case 'time-report':
      chart = (
        <BarPreview values={clampSeries(values, 8)} colors={[palette.primary, palette.secondary]} />
      );
      break;
    case 'budget-tracking':
      chart = <BudgetPreview palette={palette} series={values} />;
      break;
    case 'velocity':
      chart = (
        <DualBarPreview
          left={clampSeries(
            values.map(v => Math.min(100, v + 12)),
            6
          )}
          right={clampSeries(values, 6)}
          leftColor={palette.secondary}
          rightColor={palette.primary}
        />
      );
      break;
    case 'cumulative-flow':
      chart = <StackedAreaPreview palette={palette} />;
      break;
    case 'time-in-status':
      chart = (
        <HorizontalBarsPreview
          values={clampSeries(values, 4)}
          colors={[palette.primary, palette.secondary, palette.warning, palette.success]}
          track={palette.track}
        />
      );
      break;
    case 'sla':
      chart = <SlaPreview palette={palette} />;
      break;
    default:
      chart = (
        <LinePreview
          values={clampSeries(values, 8)}
          color={palette.primary}
          fill={palette.primary}
        />
      );
  }

  return (
    <div className={`report-card-preview${muted ? ' is-muted' : ''}`} aria-hidden>
      {chart}
    </div>
  );
};

export default ReportCardPreview;
