import React, { useState } from 'react';
import {
  Modal,
  Tabs,
  Progress,
  Tag,
  List,
  Avatar,
  Badge,
  Space,
  Button,
  Statistic,
  Row,
  Col,
  Timeline,
  Input,
  Form,
  DatePicker,
  Select,
  Typography,
} from '@/shared/antd-imports';
import {
  CalendarOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FlagOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import {
  PhaseModalData,
  ProjectPhase,
  PhaseTask,
  PhaseMilestone,
} from '../../types/project-roadmap.types';
import { useAppSelector } from '../../hooks/useAppSelector';
import { themeWiseColor } from '../../utils/themeWiseColor';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { TextArea } = Input;

interface PhaseModalProps {
  visible: boolean;
  phase: PhaseModalData | null;
  onClose: () => void;
  onUpdate?: (updates: Partial<ProjectPhase>) => void;
}

const PhaseModal: React.FC<PhaseModalProps> = ({ visible, phase, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();

  // Theme support
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  if (!phase) return null;

  const handleEdit = () => {
    setIsEditing(true);
    form.setFieldsValue({
      name: phase.name,
      description: phase.description,
      startDate: dayjs(phase.startDate),
      endDate: dayjs(phase.endDate),
      status: phase.status,
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const updates: Partial<ProjectPhase> = {
        name: values.name,
        description: values.description,
        startDate: values.startDate.toDate(),
        endDate: values.endDate.toDate(),
        status: values.status,
      };

      onUpdate?.(updates);
      setIsEditing(false);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    form.resetFields();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-progress':
        return 'processing';
      case 'on-hold':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'green';
      default:
        return 'default';
    }
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'in-progress':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return <ExclamationCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  return (
    <Modal
      title={
        <div className="flex justify-between items-center">
          <Space>
            <Badge status={getStatusColor(phase.status)} />
            {isEditing ? (
              <Form.Item name="name" className="mb-0">
                <Input className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
              </Form.Item>
            ) : (
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-0">
                {phase.name}
              </h4>
            )}
          </Space>
          <Space>
            {isEditing ? (
              <>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} size="small">
                  Save
                </Button>
                <Button
                  icon={<CloseOutlined />}
                  onClick={handleCancel}
                  size="small"
                  className="dark:border-gray-600 dark:text-gray-300"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={handleEdit}
                size="small"
                className="dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Edit
              </Button>
            )}
          </Space>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
      className="dark:bg-gray-800"
    >
      <Form form={form} layout="vertical">
        <div className="mb-4">
          {isEditing ? (
            <Form.Item
              name="description"
              label={<span className="text-gray-700 dark:text-gray-300">Description</span>}
            >
              <TextArea
                rows={2}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </Form.Item>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">{phase.description}</p>
          )}
        </div>

        {/* Phase Statistics */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <Statistic
                title={<span className="text-gray-600 dark:text-gray-400">Progress</span>}
                value={phase.progress}
                suffix="%"
                valueStyle={{ color: themeWiseColor('#1890ff', '#40a9ff', themeMode) }}
              />
              <Progress
                percent={phase.progress}
                showInfo={false}
                size="small"
                strokeColor={themeWiseColor('#1890ff', '#40a9ff', themeMode)}
                trailColor={themeWiseColor('#f0f0f0', '#4b5563', themeMode)}
              />
            </div>
          </Col>
          <Col span={6}>
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <Statistic
                title={<span className="text-gray-600 dark:text-gray-400">Tasks</span>}
                value={phase.completedTaskCount}
                suffix={`/ ${phase.taskCount}`}
                valueStyle={{ color: themeWiseColor('#52c41a', '#34d399', themeMode) }}
              />
            </div>
          </Col>
          <Col span={6}>
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <Statistic
                title={<span className="text-gray-600 dark:text-gray-400">Milestones</span>}
                value={phase.completedMilestoneCount}
                suffix={`/ ${phase.milestoneCount}`}
                valueStyle={{ color: themeWiseColor('#722ed1', '#9f7aea', themeMode) }}
              />
            </div>
          </Col>
          <Col span={6}>
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <Statistic
                title={<span className="text-gray-600 dark:text-gray-400">Team</span>}
                value={phase.teamMembers.length}
                suffix="members"
                valueStyle={{ color: themeWiseColor('#fa8c16', '#fbbf24', themeMode) }}
              />
            </div>
          </Col>
        </Row>

        {/* Timeline */}
        <Row gutter={16} className="mb-6">
          <Col span={12}>
            {isEditing ? (
              <Form.Item
                name="startDate"
                label={<span className="text-gray-700 dark:text-gray-300">Start Date</span>}
              >
                <DatePicker className="w-full dark:bg-gray-700 dark:border-gray-600" />
              </Form.Item>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CalendarOutlined className="text-gray-600 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Start:</span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {phase.startDate.toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
          </Col>
          <Col span={12}>
            {isEditing ? (
              <Form.Item
                name="endDate"
                label={<span className="text-gray-700 dark:text-gray-300">End Date</span>}
              >
                <DatePicker className="w-full dark:bg-gray-700 dark:border-gray-600" />
              </Form.Item>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CalendarOutlined className="text-gray-600 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">End:</span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {phase.endDate.toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
          </Col>
        </Row>

        {isEditing && (
          <Row gutter={16} className="mb-6">
            <Col span={12}>
              <Form.Item
                name="status"
                label={<span className="text-gray-700 dark:text-gray-300">Status</span>}
              >
                <Select className="dark:bg-gray-700 dark:border-gray-600">
                  <Select.Option value="not-started">Not Started</Select.Option>
                  <Select.Option value="in-progress">In Progress</Select.Option>
                  <Select.Option value="completed">Completed</Select.Option>
                  <Select.Option value="on-hold">On Hold</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        )}

        <Tabs
          defaultActiveKey="tasks"
          className="dark:bg-gray-800"
          tabBarStyle={{
            borderBottom: `1px solid ${themeWiseColor('#f0f0f0', '#4b5563', themeMode)}`,
          }}
        >
          <TabPane tab={`Tasks (${phase.taskCount})`} key="tasks">
            <List
              dataSource={phase.tasks}
              renderItem={(task: PhaseTask) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={getTaskStatusIcon(task.status)}
                    title={
                      <div className="flex justify-between items-center">
                        <Typography.Text strong>{task.name}</Typography.Text>
                        <Space>
                          <Tag color={getPriorityColor(task.priority)}>{task.priority}</Tag>
                          <Progress percent={task.progress} size="small" style={{ width: 100 }} />
                        </Space>
                      </div>
                    }
                    description={
                      <div>
                        <Typography.Text type="secondary">{task.description}</Typography.Text>
                        <div className="mt-2 flex justify-between items-center">
                          <Space>
                            <CalendarOutlined />
                            <Typography.Text type="secondary">
                              {task.startDate.toLocaleDateString()} -{' '}
                              {task.endDate.toLocaleDateString()}
                            </Typography.Text>
                          </Space>
                          {task.assigneeName && (
                            <Space>
                              <TeamOutlined />
                              <Typography.Text type="secondary">
                                {task.assigneeName}
                              </Typography.Text>
                            </Space>
                          )}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </TabPane>

          <TabPane tab={`Milestones (${phase.milestoneCount})`} key="milestones">
            <Timeline>
              {phase.milestones.map((milestone: PhaseMilestone) => (
                <Timeline.Item
                  key={milestone.id}
                  color={milestone.isCompleted ? 'green' : milestone.criticalPath ? 'red' : 'blue'}
                  dot={milestone.isCompleted ? <CheckCircleOutlined /> : <FlagOutlined />}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <Typography.Text strong>{milestone.name}</Typography.Text>
                      {milestone.criticalPath && (
                        <Tag color="red" className="ml-2">
                          Critical Path
                        </Tag>
                      )}
                      {milestone.description && (
                        <div className="mt-1">
                          <Typography.Text type="secondary">
                            {milestone.description}
                          </Typography.Text>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div>
                        <CalendarOutlined />
                        <span className="ml-1">{milestone.dueDate.toLocaleDateString()}</span>
                      </div>
                      <Badge
                        status={milestone.isCompleted ? 'success' : 'processing'}
                        text={milestone.isCompleted ? 'Completed' : 'Pending'}
                      />
                    </div>
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
          </TabPane>

          <TabPane tab={`Team (${phase.teamMembers.length})`} key="team">
            <List
              dataSource={phase.teamMembers}
              renderItem={(member: string) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar>{member.charAt(0).toUpperCase()}</Avatar>}
                    title={member}
                    description={
                      <Typography.Text type="secondary">
                        {phase.tasks.filter(task => task.assigneeName === member).length} tasks
                        assigned
                      </Typography.Text>
                    }
                  />
                </List.Item>
              )}
            />
          </TabPane>
        </Tabs>
      </Form>
    </Modal>
  );
};

export default PhaseModal;
