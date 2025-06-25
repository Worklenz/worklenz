/**
 * Centralized Ant Design imports for Task Management components
 * 
 * This file provides:
 * - Tree-shaking optimization by importing only used components
 * - Type safety with proper TypeScript types
 * - Performance optimization through selective imports
 * - Consistent component versions across task management
 * - Easy maintenance and updates
 */

// Core Components
export { 
  Button,
  Input,
  Select,
  Typography,
  Card,
  Spin,
  Empty,
  Space,
  Tooltip,
  Badge,
  Popconfirm,
  message,
  Checkbox,
  Dropdown,
  Menu
} from 'antd/es';

// Date & Time Components
export { 
  DatePicker,
  TimePicker 
} from 'antd/es';

// Form Components (if needed for task management)
export {
  Form,
  InputNumber
} from 'antd/es';

// Layout Components
export {
  Row,
  Col,
  Divider,
  Flex
} from 'antd/es';

// Icon Components (commonly used in task management)
export {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  MoreOutlined,
  CheckOutlined,
  CloseOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined,
  TagOutlined,
  FlagOutlined,
  BarsOutlined,
  TableOutlined,
  AppstoreOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  SearchOutlined,
  ReloadOutlined,
  SettingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CopyOutlined,
  ExportOutlined,
  ImportOutlined,
  DownOutlined,
  RightOutlined,
  LeftOutlined,
  UpOutlined,
  DragOutlined,
  HolderOutlined,
  MessageOutlined,
  PaperClipOutlined,
  GroupOutlined,
  InboxOutlined,
  TagsOutlined,
  UsergroupAddOutlined,
  UserAddOutlined,
  RetweetOutlined
} from '@ant-design/icons';

// TypeScript Types
export type {
  ButtonProps,
  InputProps,
  InputRef,
  SelectProps,
  TypographyProps,
  CardProps,
  SpinProps,
  EmptyProps,
  SpaceProps,
  TooltipProps,
  BadgeProps,
  PopconfirmProps,
  CheckboxProps,
  CheckboxChangeEvent,
  DropdownProps,
  MenuProps,
  DatePickerProps,
  TimePickerProps,
  FormProps,
  FormInstance,
  InputNumberProps,
  RowProps,
  ColProps,
  DividerProps,
  FlexProps
} from 'antd/es';

// Dayjs (used with DatePicker)
export { default as dayjs } from 'dayjs';
export type { Dayjs } from 'dayjs';

// Re-export commonly used Ant Design utilities
export { 
  ConfigProvider,
  theme 
} from 'antd';

// Custom hooks for task management (if any Ant Design specific hooks are needed)
export const useAntdBreakpoint = () => {
  // You can add custom breakpoint logic here if needed
  return {
    xs: window.innerWidth < 576,
    sm: window.innerWidth >= 576 && window.innerWidth < 768,
    md: window.innerWidth >= 768 && window.innerWidth < 992,
    lg: window.innerWidth >= 992 && window.innerWidth < 1200,
    xl: window.innerWidth >= 1200 && window.innerWidth < 1600,
    xxl: window.innerWidth >= 1600,
  };
};

// Import message separately to avoid circular dependency
import { message as antdMessage } from 'antd';

// Performance optimized message utility
export const taskMessage = {
  success: (content: string) => antdMessage.success(content),
  error: (content: string) => antdMessage.error(content),
  warning: (content: string) => antdMessage.warning(content),
  info: (content: string) => antdMessage.info(content),
  loading: (content: string) => antdMessage.loading(content),
};

// Commonly used Ant Design configurations for task management
export const taskManagementAntdConfig = {
  // DatePicker default props for consistency
  datePickerDefaults: {
    format: 'MMM DD, YYYY',
    placeholder: 'Set Date',
    suffixIcon: null,
    size: 'small' as const,
  },
  
  // Button default props for task actions
  taskButtonDefaults: {
    size: 'small' as const,
    type: 'text' as const,
  },
  
  // Input default props for task editing
  taskInputDefaults: {
    size: 'small' as const,
    variant: 'borderless' as const,
  },
  
  // Select default props for dropdowns
  taskSelectDefaults: {
    size: 'small' as const,
    variant: 'borderless' as const,
    showSearch: true,
    optionFilterProp: 'label' as const,
  },
  
  // Tooltip default props
  tooltipDefaults: {
    placement: 'top' as const,
    mouseEnterDelay: 0.5,
    mouseLeaveDelay: 0.1,
  },
  
  // Dropdown default props
  dropdownDefaults: {
    trigger: ['click'] as const,
    placement: 'bottomLeft' as const,
  },
};

// Theme tokens specifically for task management
export const taskManagementTheme = {
  light: {
    colorBgContainer: '#ffffff',
    colorBorder: '#e5e7eb',
    colorText: '#374151',
    colorTextSecondary: '#6b7280',
    colorPrimary: '#3b82f6',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorBgHover: '#f9fafb',
    colorBgSelected: '#eff6ff',
  },
  dark: {
    colorBgContainer: '#1f2937',
    colorBorder: '#374151',
    colorText: '#f9fafb',
    colorTextSecondary: '#d1d5db',
    colorPrimary: '#60a5fa',
    colorSuccess: '#34d399',
    colorWarning: '#fbbf24',
    colorError: '#f87171',
    colorBgHover: '#374151',
    colorBgSelected: '#1e40af',
  },
};

// Export default configuration object
export default {
  config: taskManagementAntdConfig,
  theme: taskManagementTheme,
  message: taskMessage,
  useBreakpoint: useAntdBreakpoint,
}; 