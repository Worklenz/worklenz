import React, { useEffect } from 'react';
import { Layout, Typography, Card, Space, Alert } from 'antd';
import { useDispatch } from 'react-redux';
import TaskListBoard from '@/components/task-management/TaskListBoard';
import { AppDispatch } from '@/app/store';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

const TaskManagementDemo: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Mock project ID for demo
  const demoProjectId = 'demo-project-123';

  useEffect(() => {
    // Initialize demo data if needed
    // You might want to populate some sample tasks here for demonstration
  }, [dispatch]);

  return (
    <Layout className="min-h-screen bg-gray-50">
      <Header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <Title level={2} className="mb-0 text-gray-800">
            Enhanced Task Management System
          </Title>
        </div>
      </Header>

      <Content className="max-w-7xl mx-auto px-4 py-6 w-full">
        <Space direction="vertical" size="large" className="w-full">
          {/* Introduction */}
          <Card>
            <Title level={3}>Task Management Features</Title>
            <Paragraph>
              This enhanced task management system provides a comprehensive interface for managing tasks
              with the following key features:
            </Paragraph>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li><strong>Dynamic Grouping:</strong> Group tasks by Status, Priority, or Phase</li>
              <li><strong>Drag & Drop:</strong> Reorder tasks within groups or move between groups</li>
              <li><strong>Multi-select:</strong> Select multiple tasks for bulk operations</li>
              <li><strong>Bulk Actions:</strong> Change status, priority, assignees, or delete multiple tasks</li>
              <li><strong>Subtasks:</strong> Expandable subtask support with progress tracking</li>
              <li><strong>Real-time Updates:</strong> Live updates via WebSocket connections</li>
              <li><strong>Rich Task Display:</strong> Progress bars, assignees, labels, due dates, and more</li>
            </ul>
          </Card>

          {/* Usage Instructions */}
          <Alert
            message="Demo Instructions"
            description={
              <div>
                <p><strong>Grouping:</strong> Use the dropdown to switch between Status, Priority, and Phase grouping.</p>
                <p><strong>Drag & Drop:</strong> Click and drag tasks to reorder within groups or move between groups.</p>
                <p><strong>Selection:</strong> Click checkboxes to select tasks, then use bulk actions in the blue bar.</p>
                <p><strong>Subtasks:</strong> Click the +/- buttons next to task names to expand/collapse subtasks.</p>
              </div>
            }
            type="info"
            showIcon
            className="mb-4"
          />

          {/* Task List Board */}
          <TaskListBoard
            projectId={demoProjectId}
            className="task-management-demo"
          />
        </Space>
      </Content>
    </Layout>
  );
};

export default TaskManagementDemo; 