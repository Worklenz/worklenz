import { IRPTDuration } from '@/types/reporting/reporting.types';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
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
