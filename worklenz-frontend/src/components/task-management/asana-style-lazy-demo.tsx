import React, { useState, useCallback, Suspense } from 'react';
import { Card, Typography, Space, Button, Divider } from 'antd';
import { 
  UserAddOutlined, 
  CalendarOutlined, 
  FlagOutlined,
  TagOutlined,
  LoadingOutlined 
} from '@ant-design/icons';

const { Title, Text } = Typography;

// Simulate heavy components that would normally load immediately
const HeavyAssigneeSelector = React.lazy(() => 
  new Promise<{ default: React.ComponentType }>((resolve) => 
    setTimeout(() => resolve({
      default: () => (
        <div className="p-4 border rounded-sm bg-blue-50">
          <Text strong>🚀 Heavy Assignee Selector Loaded!</Text>
          <br />
          <Text type="secondary">This component contains:</Text>
          <ul className="mt-2 text-sm">
            <li>Team member search logic</li>
            <li>Avatar rendering</li>
            <li>Permission checking</li>
            <li>Socket connections</li>
            <li>Optimistic updates</li>
          </ul>
        </div>
      )
    }), 1000) // Simulate 1s load time
  )
);

const HeavyDatePicker = React.lazy(() => 
  new Promise<{ default: React.ComponentType }>((resolve) => 
    setTimeout(() => resolve({
      default: () => (
        <div className="p-4 border rounded-sm bg-green-50">
          <Text strong>📅 Heavy Date Picker Loaded!</Text>
          <br />
          <Text type="secondary">This component contains:</Text>
          <ul className="mt-2 text-sm">
            <li>Calendar rendering logic</li>
            <li>Date validation</li>
            <li>Timezone handling</li>
            <li>Locale support</li>
            <li>Accessibility features</li>
          </ul>
        </div>
      )
    }), 800) // Simulate 0.8s load time
  )
);

const HeavyPrioritySelector = React.lazy(() => 
  new Promise<{ default: React.ComponentType }>((resolve) => 
    setTimeout(() => resolve({
      default: () => (
        <div className="p-4 border rounded-sm bg-orange-50">
          <Text strong>🔥 Heavy Priority Selector Loaded!</Text>
          <br />
          <Text type="secondary">This component contains:</Text>
          <ul className="mt-2 text-sm">
            <li>Priority level logic</li>
            <li>Color calculations</li>
            <li>Business rules</li>
            <li>Validation</li>
            <li>State management</li>
          </ul>
        </div>
      )
    }), 600) // Simulate 0.6s load time
  )
);

const HeavyLabelsSelector = React.lazy(() => 
  new Promise<{ default: React.ComponentType }>((resolve) => 
    setTimeout(() => resolve({
      default: () => (
        <div className="p-4 border rounded-sm bg-purple-50">
          <Text strong>🏷️ Heavy Labels Selector Loaded!</Text>
          <br />
          <Text type="secondary">This component contains:</Text>
          <ul className="mt-2 text-sm">
            <li>Label management</li>
            <li>Color picker</li>
            <li>Search functionality</li>
            <li>CRUD operations</li>
            <li>Drag & drop</li>
          </ul>
        </div>
      )
    }), 700) // Simulate 0.7s load time
  )
);

// Lightweight placeholder buttons (what loads immediately)
const PlaceholderButton: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void;
  loaded?: boolean;
}> = ({ icon, label, onClick, loaded = false }) => (
  <Button
    size="small"
    icon={loaded ? <LoadingOutlined spin /> : icon}
    onClick={onClick}
    className={`${loaded ? 'border-blue-500 bg-blue-50' : ''}`}
  >
    {loaded ? 'Loading...' : label}
  </Button>
);

const AsanaStyleLazyDemo: React.FC = () => {
  const [loadedComponents, setLoadedComponents] = useState<{
    assignee: boolean;
    date: boolean;
    priority: boolean;
    labels: boolean;
  }>({
    assignee: false,
    date: false,
    priority: false,
    labels: false,
  });

  const [showComponents, setShowComponents] = useState<{
    assignee: boolean;
    date: boolean;
    priority: boolean;
    labels: boolean;
  }>({
    assignee: false,
    date: false,
    priority: false,
    labels: false,
  });

  const handleLoad = useCallback((component: keyof typeof loadedComponents) => {
    setLoadedComponents(prev => ({ ...prev, [component]: true }));
    setTimeout(() => {
      setShowComponents(prev => ({ ...prev, [component]: true }));
    }, 100);
  }, []);

  const resetDemo = useCallback(() => {
    setLoadedComponents({
      assignee: false,
      date: false,
      priority: false,
      labels: false,
    });
    setShowComponents({
      assignee: false,
      date: false,
      priority: false,
      labels: false,
    });
  }, []);

  return (
    <Card className="max-w-4xl mx-auto">
      <Title level={3}>🎯 Asana-Style Lazy Loading Demo</Title>
      
      <div className="mb-4 p-4 bg-gray-50 rounded-sm">
        <Text strong>Performance Benefits:</Text>
        <ul className="mt-2 text-sm">
          <li>✅ <strong>Faster Initial Load:</strong> Only lightweight placeholders load initially</li>
          <li>✅ <strong>Reduced Bundle Size:</strong> Heavy components split into separate chunks</li>
          <li>✅ <strong>Better UX:</strong> Instant visual feedback, components load on demand</li>
          <li>✅ <strong>Memory Efficient:</strong> Components only consume memory when needed</li>
          <li>✅ <strong>Network Optimized:</strong> Parallel loading of components as user interacts</li>
        </ul>
      </div>

      <Divider />

      <div className="space-y-4">
        <div>
          <Text strong>Task Management Components (Click to Load):</Text>
          <div className="mt-2 flex gap-2 flex-wrap">
            <PlaceholderButton
              icon={<UserAddOutlined />}
              label="Add Assignee"
              onClick={() => handleLoad('assignee')}
              loaded={loadedComponents.assignee && !showComponents.assignee}
            />
            <PlaceholderButton
              icon={<CalendarOutlined />}
              label="Set Date"
              onClick={() => handleLoad('date')}
              loaded={loadedComponents.date && !showComponents.date}
            />
            <PlaceholderButton
              icon={<FlagOutlined />}
              label="Set Priority"
              onClick={() => handleLoad('priority')}
              loaded={loadedComponents.priority && !showComponents.priority}
            />
            <PlaceholderButton
              icon={<TagOutlined />}
              label="Add Labels"
              onClick={() => handleLoad('labels')}
              loaded={loadedComponents.labels && !showComponents.labels}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={resetDemo} size="small">
            Reset Demo
          </Button>
          <Text type="secondary" className="self-center">
            Components loaded: {Object.values(showComponents).filter(Boolean).length}/4
          </Text>
        </div>

        <Divider />

        <div className="space-y-4">
          {showComponents.assignee && (
            <Suspense fallback={<div className="p-4 border rounded-sm bg-gray-100">Loading assignee selector...</div>}>
              <HeavyAssigneeSelector />
            </Suspense>
          )}

          {showComponents.date && (
            <Suspense fallback={<div className="p-4 border rounded-sm bg-gray-100">Loading date picker...</div>}>
              <HeavyDatePicker />
            </Suspense>
          )}

          {showComponents.priority && (
            <Suspense fallback={<div className="p-4 border rounded-sm bg-gray-100">Loading priority selector...</div>}>
              <HeavyPrioritySelector />
            </Suspense>
          )}

          {showComponents.labels && (
            <Suspense fallback={<div className="p-4 border rounded-sm bg-gray-100">Loading labels selector...</div>}>
              <HeavyLabelsSelector />
            </Suspense>
          )}
        </div>
      </div>

      <Divider />

      <div className="text-sm text-gray-600">
        <Text strong>How it works:</Text>
        <ol className="mt-2 space-y-1">
          <li>1. Page loads instantly with lightweight placeholder buttons</li>
          <li>2. User clicks a button to interact with a feature</li>
          <li>3. Heavy component starts loading in the background</li>
          <li>4. Loading state shows immediate feedback</li>
          <li>5. Full component renders when ready</li>
          <li>6. Subsequent interactions are instant (component cached)</li>
        </ol>
      </div>
    </Card>
  );
};

export default AsanaStyleLazyDemo; 