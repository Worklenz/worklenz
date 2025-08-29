import { IRPTDuration } from '@/types/reporting/reporting.types';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
} from '@/shared/antd-imports';
import dayjs from 'dayjs';

export const avatarNamesMap: { [x: string]: string } = {
  A: '#154c9b',
  B: '#3b7ad4',
  C: '#70a6f3',
  D: '#7781ca',
  E: '#9877ca',
  F: '#c178c9',
  G: '#ee87c5',
  H: '#ca7881',
  I: '#75c9c0',
  J: '#75c997',
  K: '#80ca79',
  L: '#aacb78',
  M: '#cbbc78',
  N: '#cb9878',
  O: '#bb774c',
  P: '#905b39',
  Q: '#903737',
  R: '#bf4949',
  S: '#f37070',
  T: '#ff9c3c',
  U: '#fbc84c',
  V: '#cbc8a1',
  W: '#a9a9a9',
  X: '#767676',
  Y: '#cb9878',
  Z: '#903737',
  '+': '#9e9e9e',
};

export const AvatarNamesMap: { [x: string]: string } = {
  A: '#154c9b',
  B: '#3b7ad4',
  C: '#70a6f3',
  D: '#7781ca',
  E: '#9877ca',
  F: '#c178c9',
  G: '#ee87c5',
  H: '#ca7881',
  I: '#75c9c0',
  J: '#75c997',
  K: '#80ca79',
  L: '#aacb78',
  M: '#cbbc78',
  N: '#cb9878',
  O: '#bb774c',
  P: '#905b39',
  Q: '#903737',
  R: '#bf4949',
  S: '#f37070',
  T: '#ff9c3c',
  U: '#fbc84c',
  V: '#cbc8a1',
  W: '#a9a9a9',
  X: '#767676',
  Y: '#cb9878',
  Z: '#903737',
  '+': '#9e9e9e',
};

export const NumbersColorMap: { [x: string]: string } = {
  '0': '#154c9b',
  '1': '#3b7ad4',
  '2': '#70a6f3',
  '3': '#7781ca',
  '4': '#9877ca',
  '5': '#c178c9',
  '6': '#ee87c5',
  '7': '#ca7881',
  '8': '#75c9c0',
  '9': '#75c997',
};

export const ProjectsDefaultColorCodes = [
  '#154c9b',
  '#3b7ad4',
  '#70a6f3',
  '#7781ca',
  '#9877ca',
  '#c178c9',
  '#ee87c5',
  '#ca7881',
  '#75c9c0',
  '#75c997',
  '#80ca79',
  '#aacb78',
  '#cbbc78',
  '#cb9878',
  '#bb774c',
  '#905b39',
  '#903737',
  '#bf4949',
  '#f37070',
  '#ff9c3c',
  '#fbc84c',
  '#cbc8a1',
  '#a9a9a9',
  '#767676',
];

export const PhaseColorCodes = [
  '#154c9b',
  '#3b7ad4',
  '#70a6f3',
  '#7781ca',
  '#9877ca',
  '#c178c9',
  '#ee87c5',
  '#ca7881',
  '#75c9c0',
  '#75c997',
  '#80ca79',
  '#aacb78',
  '#cbbc78',
  '#cb9878',
  '#bb774c',
  '#905b39',
  '#903737',
  '#bf4949',
  '#f37070',
  '#ff9c3c',
  '#fbc84c',
  '#cbc8a1',
  '#a9a9a9',
  '#767676',
  '#cb9878',
  '#903737',
  '#9e9e9e',
];

export const PriorityColorCodes: { [x: number]: string } = {
  0: '#75c997',
  1: '#fbc84c',
  2: '#f37070',
};

export const API_BASE_URL = '/api/v1';
export const AUTH_API_BASE_URL = '/secure';

export const DEFAULT_TASK_NAME = 'Untitled Task';

export const YESTERDAY = 'YESTERDAY';
export const LAST_WEEK = 'LAST_WEEK';
export const LAST_MONTH = 'LAST_MONTH';
export const LAST_QUARTER = 'LAST_QUARTER';
export const PREV_WEEK = 'PREV_WEEK';
export const PREV_MONTH = 'PREV_MONTH';
export const ALL_TIME = 'ALL_TIME';

export const PASSWORD_POLICY =
  'Minimum of 8 characters, with upper and lowercase and a number and a symbol.';

export const HTML_TAG_REGEXP = /<\/?[^>]+>/gi;
export const UNMAPPED = 'Unmapped';

export const TASK_STATUS_TODO_COLOR = '#a9a9a9';
export const TASK_STATUS_DOING_COLOR = '#70a6f3';
export const TASK_STATUS_DONE_COLOR = '#75c997';

export const TASK_PRIORITY_LOW_COLOR = '#75c997';
export const TASK_PRIORITY_MEDIUM_COLOR = '#fbc84c';
export const TASK_PRIORITY_HIGH_COLOR = '#f37070';

export const TASK_DUE_COMPLETED_COLOR = '#75c997';
export const TASK_DUE_UPCOMING_COLOR = '#70a6f3';
export const TASK_DUE_OVERDUE_COLOR = '#f37070';
export const TASK_DUE_NO_DUE_COLOR = '#a9a9a9';

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = ['5', '10', '15', '20', '50', '100'];
export const ALPHA_CHANNEL = '69';

export const FILTER_INDEX_KEY = 'worklenz.projects.filter_index';
export const DISPLAY_MODE_KEY = 'worklenz.projects.display_as';
export const WORKLENZ_REDIRECT_PROJ_KEY = 'worklenz.redirect_proj';
export const PROJECT_SORT_FIELD = 'worklenz.projects.sort_field';
export const PROJECT_SORT_ORDER = 'worklenz.projects.sort_order';
export const PROJECT_LIST_COLUMNS = 'worklenz.reporting.projects.column_list';

export const PROJECT_STATUS_ICON_MAP = {
  'check-circle': CheckCircleOutlined,
  'clock-circle': ClockCircleOutlined,
  'clock-circle-two-tone': ClockCircleOutlined,
  'close-circle': CloseCircleOutlined,
  stop: StopOutlined,
};
export const DRAWER_ANIMATION_INTERVAL = 200;

export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

export const NOTIFICATION_OPTION_UNREAD = 'Unread';
export const NOTIFICATION_OPTION_READ = 'Read';
export const NOTIFICATION_OPTIONS = [NOTIFICATION_OPTION_UNREAD, NOTIFICATION_OPTION_READ];

export const MY_DASHBOARD_ACTIVE_FILTER = 'my-dashboard-active-filter';
export const MY_DASHBOARD_DEFAULT_VIEW = 'All';

export const CELL_WIDTH = 75;

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  PASTDUE: 'past_due',
  PAUSED: 'paused',
  DELETED: 'deleted',
  TRIALING: 'trialing',
  FREE: 'free',
};

export enum IPaddlePlans {
  FREE = 'FREE',
  ANNUAL = 'ANNUAL',
  MONTHLY = 'MONTHLY',
  BUSINESS_ANNUAL = 'BUSINESS_ANNUAL',
  BUSINESS_MONTHLY = 'BUSINESS_MONTHLY',
  ENTERPRISE_ANNUAL = 'ENTERPRISE_ANNUAL',
  ENTERPRISE_MONTHLY = 'ENTERPRISE_MONTHLY',
}

export enum ISUBSCRIPTION_TYPE {
  LIFE_TIME_DEAL = 'LIFE_TIME_DEAL',
  PADDLE = 'PADDLE',
  TRIAL = 'TRIAL',
  CUSTOM = 'CUSTOM',
  FREE = 'FREE',
  CREDIT = 'CREDIT',
}

export const IconsMap: { [x: string]: string } = {
  ai: 'ai.png',
  avi: 'avi.png',
  css: 'css.png',
  csv: 'csv.png',
  doc: 'doc.png',
  docx: 'doc.png',
  exe: 'exe.png',
  html: 'html.png',
  js: 'js.png',
  jpg: 'jpg.png',
  jpeg: 'jpg.png',
  json: 'json.png',
  mp3: 'mp3.png',
  mp4: 'mp4.png',
  pdf: 'pdf.png',
  png: 'png.png',
  ppt: 'ppt.png',
  psd: 'psd.png',
  search: 'search.png',
  svg: 'svg.png',
  txt: 'txt.png',
  xls: 'xls.png',
  xml: 'xml.png',
  zip: 'zip.png',
};

export const durations: IRPTDuration[] = [
  {
    key: YESTERDAY,
    label: 'yesterdayText',
    dates: new Date(dayjs().subtract(1, 'day').format()).toString(),
  },
  {
    key: LAST_WEEK,
    label: 'lastSevenDaysText',
    dates:
      new Date(dayjs().subtract(7, 'day').format()).toString() +
      ' - ' +
      new Date(dayjs().format()).toString(),
  },
  {
    key: PREV_WEEK,
    label: 'lastWeekText',
    dates:
      new Date(dayjs().startOf('week').subtract(1, 'week').format()).toString() +
      ' - ' +
      new Date(dayjs().endOf('week').subtract(1, 'week').format()).toString(),
  },
  {
    key: LAST_MONTH,
    label: 'lastThirtyDaysText',
    dates:
      new Date(dayjs().subtract(30, 'day').format()).toString() +
      ' - ' +
      new Date(dayjs().format()).toString(),
  },
  {
    key: PREV_MONTH,
    label: 'lastMonthText',
    dates:
      new Date(dayjs().startOf('month').subtract(1, 'month').format()).toString() +
      ' - ' +
      new Date(dayjs().endOf('month').subtract(1, 'month').format()).toString(),
  },
  {
    key: LAST_QUARTER,
    label: 'lastThreeMonthsText',
    dates:
      new Date(dayjs().subtract(3, 'month').format()).toString() +
      ' - ' +
      new Date(dayjs().format()).toString(),
  },
  {
    key: ALL_TIME,
    label: 'allTimeText',
    dates: '',
  },
];

export const WorklenzColorCodes = [
  // Row 1: Slate/Gray spectrum
  '#0f172a',
  '#1e293b',
  '#334155',
  '#475569',
  '#64748b',
  '#94a3b8',
  '#cbd5e1',
  '#e2e8f0',
  '#f1f5f9',
  '#f8fafc',
  '#ffffff',
  '#000000',
  '#1a1a1a',
  '#2d2d30',
  '#3e3e42',
  '#525252',

  // Row 2: Blue spectrum - dark to light
  '#0c4a6e',
  '#075985',
  '#0369a1',
  '#0284c7',
  '#0ea5e9',
  '#38bdf8',
  '#7dd3fc',
  '#bae6fd',
  '#e0f2fe',
  '#f0f9ff',
  '#1e3a8a',
  '#1d4ed8',
  '#2563eb',
  '#3b82f6',
  '#60a5fa',
  '#93c5fd',

  // Row 3: Indigo/Violet spectrum
  '#312e81',
  '#3730a3',
  '#4338ca',
  '#4f46e5',
  '#6366f1',
  '#818cf8',
  '#a5b4fc',
  '#c7d2fe',
  '#e0e7ff',
  '#eef2ff',
  '#581c87',
  '#6b21a8',
  '#7c3aed',
  '#8b5cf6',
  '#a78bfa',
  '#c4b5fd',

  // Row 4: Purple/Fuchsia spectrum
  '#701a75',
  '#86198f',
  '#a21caf',
  '#c026d3',
  '#d946ef',
  '#e879f9',
  '#f0abfc',
  '#f3e8ff',
  '#faf5ff',
  '#fdf4ff',
  '#831843',
  '#be185d',
  '#e11d48',
  '#f43f5e',
  '#fb7185',
  '#fda4af',

  // Row 5: Pink/Rose spectrum
  '#9f1239',
  '#be123c',
  '#e11d48',
  '#f43f5e',
  '#fb7185',
  '#fda4af',
  '#fecdd3',
  '#fed7d7',
  '#fef2f2',
  '#fff1f2',
  '#450a0a',
  '#7f1d1d',
  '#991b1b',
  '#dc2626',
  '#ef4444',
  '#f87171',

  // Row 6: Red spectrum
  '#7f1d1d',
  '#991b1b',
  '#dc2626',
  '#ef4444',
  '#f87171',
  '#fca5a5',
  '#fecaca',
  '#fef2f2',
  '#fffbeb',
  '#fefce8',
  '#92400e',
  '#a16207',
  '#ca8a04',
  '#eab308',
  '#facc15',
  '#fef08a',

  // Row 7: Orange spectrum
  '#9a3412',
  '#c2410c',
  '#ea580c',
  '#f97316',
  '#fb923c',
  '#fdba74',
  '#fed7aa',
  '#ffedd5',
  '#fff7ed',
  '#fffbeb',
  '#78350f',
  '#92400e',
  '#c2410c',
  '#ea580c',
  '#f97316',
  '#fb923c',

  // Row 8: Amber/Yellow spectrum
  '#451a03',
  '#78350f',
  '#92400e',
  '#a16207',
  '#ca8a04',
  '#eab308',
  '#facc15',
  '#fef08a',
  '#fefce8',
  '#fffbeb',
  '#365314',
  '#4d7c0f',
  '#65a30d',
  '#84cc16',
  '#a3e635',
  '#bef264',

  // Row 9: Lime/Green spectrum
  '#1a2e05',
  '#365314',
  '#4d7c0f',
  '#65a30d',
  '#84cc16',
  '#a3e635',
  '#bef264',
  '#d9f99d',
  '#ecfccb',
  '#f7fee7',
  '#14532d',
  '#166534',
  '#15803d',
  '#16a34a',
  '#22c55e',
  '#4ade80',

  // Row 10: Emerald spectrum
  '#064e3b',
  '#065f46',
  '#047857',
  '#059669',
  '#10b981',
  '#34d399',
  '#6ee7b7',
  '#a7f3d0',
  '#d1fae5',
  '#ecfdf5',
  '#0f766e',
  '#0d9488',
  '#14b8a6',
  '#2dd4bf',
  '#5eead4',
  '#99f6e4',

  // Row 11: Teal/Cyan spectrum
  '#134e4a',
  '#155e75',
  '#0891b2',
  '#0e7490',
  '#0284c7',
  '#0ea5e9',
  '#22d3ee',
  '#67e8f9',
  '#a5f3fc',
  '#cffafe',
  '#164e63',
  '#0c4a6e',
  '#075985',
  '#0369a1',
  '#0284c7',
  '#0ea5e9',

  // Row 12: Sky spectrum
  '#0c4a6e',
  '#075985',
  '#0369a1',
  '#0284c7',
  '#0ea5e9',
  '#38bdf8',
  '#7dd3fc',
  '#bae6fd',
  '#e0f2fe',
  '#f0f9ff',
  '#1e40af',
  '#1d4ed8',
  '#2563eb',
  '#3b82f6',
  '#60a5fa',
  '#93c5fd',

  // Row 13: Warm grays and browns
  '#292524',
  '#44403c',
  '#57534e',
  '#78716c',
  '#a8a29e',
  '#d6d3d1',
  '#e7e5e4',
  '#f5f5f4',
  '#fafaf9',
  '#ffffff',
  '#7c2d12',
  '#9a3412',
  '#c2410c',
  '#ea580c',
  '#f97316',
  '#fb923c',

  // Row 14: Cool grays
  '#111827',
  '#1f2937',
  '#374151',
  '#4b5563',
  '#6b7280',
  '#9ca3af',
  '#d1d5db',
  '#e5e7eb',
  '#f3f4f6',
  '#f9fafb',
  '#030712',
  '#0c0a09',
  '#1c1917',
  '#292524',
  '#44403c',
  '#57534e',

  // Row 15: Neutral spectrum
  '#171717',
  '#262626',
  '#404040',
  '#525252',
  '#737373',
  '#a3a3a3',
  '#d4d4d4',
  '#e5e5e5',
  '#f5f5f5',
  '#fafafa',
  '#09090b',
  '#18181b',
  '#27272a',
  '#3f3f46',
  '#52525b',
  '#71717a',

  // Row 16: Extended colors
  '#a1a1aa',
  '#d4d4d8',
  '#e4e4e7',
  '#f4f4f5',
  '#fafafa',
  '#27272a',
  '#3f3f46',
  '#52525b',
  '#71717a',
  '#a1a1aa',
  '#d4d4d8',
  '#e4e4e7',
  '#f4f4f5',
  '#fafafa',
  '#ffffff',
  '#000000',
];
