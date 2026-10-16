import React from 'react';
import {
  BarChartOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  CommentOutlined,
  HistoryOutlined,
  PieChartOutlined,
  SendOutlined,
  SmileOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { HomeWidgetId } from '../home-layout/homeLayout';

/** The greeting banner is not a widget, but "Add widget" offers it once it has been removed. */
export const HOME_GREETING_ICON: React.ReactNode = <SmileOutlined />;

/** One icon per widget, for the "Add widget" menu and the ghost shown while dragging. */
export const HOME_WIDGET_ICONS: Record<HomeWidgetId, React.ReactNode> = {
  'stat-cards': <BarChartOutlined />,
  priorities: <CheckSquareOutlined />,
  'progress-donut': <PieChartOutlined />,
  continue: <HistoryOutlined />,
  'team-members': <TeamOutlined />,
  'assigned-by-me': <SendOutlined />,
  mentions: <CommentOutlined />,
  todo: <CheckCircleOutlined />,
};
