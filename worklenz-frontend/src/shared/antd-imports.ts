/**
 * Centralized Ant Design imports for better tree-shaking and React context sharing
 * 
 * This file provides:
 * - Consistent imports across the application
 * - Better tree-shaking through centralized management
 * - Proper React context sharing
 */

// Import React to ensure context availability
import React from 'react';

// Import Ant Design components using the standard method for better context sharing
import {
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
  Checkbox,
  Dropdown,
  Menu,
  Modal,
  Tag,
  Avatar,
  List,
  Table,
  Flex,
  Divider,
  Progress,
  Result,
  Skeleton,
  Alert,
  Tabs,
  ConfigProvider,
  DatePicker,
  TimePicker,
  Form,
  InputNumber,
  Row,
  Col,
  Layout,
  Drawer,
  message,
  notification,
  theme
} from 'antd';

// Icons - Import commonly used ones
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
  BarsOutlined,
  AppstoreOutlined,
  FilterOutlined,
  SearchOutlined,
  SettingOutlined,
  DownOutlined,
  RightOutlined,
  LeftOutlined,
  UpOutlined,
  ArrowLeftOutlined,
  BellFilled,
  BellOutlined,
  SaveOutlined,
  SyncOutlined,
  PushpinFilled,
  PushpinOutlined,
  UsergroupAddOutlined,
  ImportOutlined
} from '@ant-design/icons';

// Re-export all components with React
export {
  React,
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
  Checkbox,
  Dropdown,
  Menu,
  Modal,
  Tag,
  Avatar,
  List,
  Table,
  Flex,
  Divider,
  Progress,
  Result,
  Skeleton,
  Alert,
  Tabs,
  ConfigProvider,
  DatePicker,
  TimePicker,
  Form,
  InputNumber,
  Row,
  Col,
  Layout,
  Drawer,
  message,
  notification,
  theme
};

// TypeScript Types - Import commonly used ones
export type {
  ButtonProps,
  InputProps,
  InputRef,
  SelectProps,
  TypographyProps,
  CardProps,
  TooltipProps,
  DropdownProps,
  MenuProps,
  DatePickerProps,
  FormProps,
  FormInstance,
  FlexProps,
  TabsProps,
  TableProps,
  TableColumnsType
} from 'antd';

// Dayjs
export { default as dayjs } from 'dayjs';
export type { Dayjs } from 'dayjs';

// Optimized message utilities
export const appMessage = {
  success: (content: string) => message.success(content),
  error: (content: string) => message.error(content),
  warning: (content: string) => message.warning(content),
  info: (content: string) => message.info(content),
  loading: (content: string) => message.loading(content),
};

export const appNotification = {
  success: (config: any) => notification.success(config),
  error: (config: any) => notification.error(config),
  warning: (config: any) => notification.warning(config),
  info: (config: any) => notification.info(config),
};

// Default configurations
export const antdConfig = {
  datePickerDefaults: {
    format: 'MMM DD, YYYY',
    placeholder: 'Set Date',
    size: 'small' as const,
  },
  buttonDefaults: {
    size: 'small' as const,
  },
  inputDefaults: {
    size: 'small' as const,
  },
  selectDefaults: {
    size: 'small' as const,
    showSearch: true,
  },
};

export default {
  config: antdConfig,
  message: appMessage,
  notification: appNotification,
}; 