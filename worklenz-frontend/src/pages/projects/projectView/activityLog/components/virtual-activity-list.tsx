import React from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { Spin, Typography } from 'antd';
import { IProjectActivityLog } from '../../../../../api/projects/project-activity-logs-api.service';

const { Text } = Typography;

export interface VirtualActivityListProps {
  logs: IProjectActivityLog[];
  hasNextPage: boolean;
  isItemLoaded: (index: number) => boolean;
  loadMoreItems: (startIndex: number, stopIndex: number) => Promise<void>;
  height: number;
  itemHeight?: number;
}

const VirtualActivityList: React.FC<VirtualActivityListProps> = ({
  logs,
  hasNextPage,
  isItemLoaded,
  loadMoreItems,
  height,
  itemHeight = 80, // Reduced from 140 to 80 for tighter spacing
}) => {
  // if there's more to load, we let InfiniteLoader think the list is one item longer
  const itemCount = hasNextPage ? logs.length + 1 : logs.length;

  const renderRow = ({ index, style }: ListChildComponentProps) => {
    const isLoadingRow = hasNextPage && index === logs.length;

    if (isLoadingRow) {
      return (
        <div style={{ ...style, display: 'flex', justifyContent: 'center', alignItems: 'center',padding: '20px 0' }}>
          <Spin size="small" />
          <Text type="secondary" style={{ marginLeft: 8 }}>
            Loading…
          </Text>
        </div>
      );
    }

    const log = logs[index];
    return (
      <div
        style={{
          ...style,
          padding: '8px 16px', // Reduced from 12px to 8px
          borderBottom: '1px solid #f0f0f0',
          boxSizing: 'border-box',
          display: 'flex',
        }}
        key={log.id}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: log.done_by?.color_code || '#1890ff',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {log.done_by?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div style={{ marginLeft: 12, flex: 1 }}>
          <div style={{ fontWeight: 500, marginBottom: 2 }}> 
            {log.done_by?.name || 'Unknown'}{' '}
            <Text type="secondary">{log.log_text}</Text>
          </div>
          <div style={{ fontSize: 13, marginBottom: 3 }}> 
            <Text code>{log.task_key}</Text>{' '}
            <Text strong>{log.task_name}</Text>
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {new Date(log.created_at).toLocaleString()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={itemCount}
      loadMoreItems={loadMoreItems}
      threshold={3} // start loading when 3 items from bottom
    >
      {({ onItemsRendered, ref }) => (
        <List
          height={height}
          itemCount={itemCount}
          itemSize={itemHeight}
          onItemsRendered={onItemsRendered}
          ref={ref}
          width="100%"
        >
          {renderRow}
        </List>
      )}
    </InfiniteLoader>
  );
};

export default VirtualActivityList;