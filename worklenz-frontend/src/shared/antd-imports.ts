/**
 * Optimized Ant Design imports for maximum tree-shaking
 * 
 * This file provides:
 * - Granular imports from antd/es for better tree-shaking
 * - Only commonly used components to reduce bundle size
 * - Separate icon imports to avoid loading entire icon set
 */

// Core Components - Import as default exports for better tree-shaking
import Button from 'antd/es/button';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Typography from 'antd/es/typography';
import Card from 'antd/es/card';
import Spin from 'antd/es/spin';
import Empty from 'antd/es/empty';
import Space from 'antd/es/space';
import Tooltip from 'antd/es/tooltip';
import Badge from 'antd/es/badge';
import Popconfirm from 'antd/es/popconfirm';
import Checkbox from 'antd/es/checkbox';
import Dropdown from 'antd/es/dropdown';
import Menu from 'antd/es/menu';
import Modal from 'antd/es/modal';
import Tag from 'antd/es/tag';
import Avatar from 'antd/es/avatar';
import List from 'antd/es/list';
import Table from 'antd/es/table';
import Flex from 'antd/es/flex';
import Divider from 'antd/es/divider';
import Progress from 'antd/es/progress';
import Result from 'antd/es/result';
import Skeleton from 'antd/es/skeleton';
import Alert from 'antd/es/alert';
import Tabs from 'antd/es/tabs';
import ConfigProvider from 'antd/es/config-provider';

// Date & Time Components
import DatePicker from 'antd/es/date-picker';
import TimePicker from 'antd/es/time-picker';

// Form Components
import Form from 'antd/es/form';
import InputNumber from 'antd/es/input-number';

// Layout Components
import Row from 'antd/es/row';
import Col from 'antd/es/col';
import Layout from 'antd/es/layout';
import Drawer from 'antd/es/drawer';

// Message and Notification - Import separately
import message from 'antd/es/message';
import notification from 'antd/es/notification';

// Theme
import theme from 'antd/es/theme';

// Re-export all components
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

// Icons - Import only commonly used ones
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

// TypeScript Types - Import only commonly used ones
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