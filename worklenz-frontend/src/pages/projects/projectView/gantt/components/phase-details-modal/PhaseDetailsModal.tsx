import React, { useMemo, useState } from 'react';
import {
  Modal,
  Typography,
  Divider,
  Progress,
  Tag,
  Row,
  Col,
  Card,
  Statistic,
  theme,
  Tooltip,
  Input,
  DatePicker,
  ColorPicker,
  message,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BgColorsOutlined,
  MinusOutlined,
  PauseOutlined,
  DoubleRightOutlined,
  UserOutlined,
} from '@/shared/antd-imports';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import AvatarGroup from '@/components/AvatarGroup';
import { GanttTask } from '../../types/gantt-types';
import { useUpdatePhaseMutation } from '../../services/roadmap-api.service';

const { Title, Text } = Typography;

interface PhaseDetailsModalProps {
  open: boolean;
  onClose: () => void;
  phase: GanttTask | null;
  onPhaseUpdate?: (phase: Partial<GanttTask>) => void;
}

const PhaseDetailsModal: React.FC<PhaseDetailsModalProps> = ({
  open,
  onClose,
  phase,
  onPhaseUpdate,
}) => {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useTranslation('roadmap/phase-details-modal');
  const { token } = theme.useToken();

  // API mutation hook
  const [updatePhase, { isLoading: isUpdating }] = useUpdatePhaseMutation();

  // Inline editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<GanttTask>>({});
  
  // Local phase state for immediate UI updates
  const [localPhase, setLocalPhase] = useState<GanttTask | null>(phase);

  // Update local phase when prop changes
  React.useEffect(() => {
    setLocalPhase(phase);
  }, [phase]);

  // Calculate phase statistics
  const phaseStats = useMemo(() => {
    if (!localPhase || !localPhase.children) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        completionPercentage: 0,
      };
    }

    const totalTasks = localPhase.children.length;
    const completedTasks = localPhase.children.filter(task => task.progress === 100).length;
    const pendingTasks = totalTasks - completedTasks;

    // Calculate overdue tasks (tasks with end_date in the past and progress < 100)
    const now = new Date();
    const overdueTasks = localPhase.children.filter(
      task => task.end_date && new Date(task.end_date) < now && task.progress < 100
    ).length;

    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      completionPercentage,
    };
  }, [localPhase]);

  const formatDate = (date: Date | null) => {
    if (!date) return t('timeline.notSet');
    return dayjs(date).format('MMM DD, YYYY');
  };

  const getDateStatus = () => {
    if (!localPhase?.start_date || !localPhase?.end_date) return 'not-set';

    const now = new Date();
    const startDate = new Date(localPhase.start_date);
    const endDate = new Date(localPhase.end_date);

    if (now < startDate) return 'upcoming';
    if (now > endDate) return 'overdue';
    return 'active';
  };

  const getDateStatusColor = () => {
    const status = getDateStatus();
    switch (status) {
      case 'upcoming':
        return '#1890ff';
      case 'active':
        return '#52c41a';
      case 'overdue':
        return '#ff4d4f';
      default:
        return '#8c8c8c';
    }
  };

  const getDateStatusText = () => {
    const status = getDateStatus();
    switch (status) {
      case 'upcoming':
        return t('timeline.statusLabels.upcoming');
      case 'active':
        return t('timeline.statusLabels.active');
      case 'overdue':
        return t('timeline.statusLabels.overdue');
      default:
        return t('timeline.statusLabels.notScheduled');
    }
  };

  const getTaskStatus = (task: GanttTask) => {
    if (task.progress === 100) return 'completed';
    if (task.end_date && new Date(task.end_date) < new Date() && task.progress < 100)
      return 'overdue';
    if (task.start_date && new Date(task.start_date) > new Date()) return 'upcoming';
    return 'in-progress';
  };

  const getTaskStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'overdue':
        return 'Overdue';
      case 'upcoming':
        return 'Upcoming';
      case 'in-progress':
        return 'In Progress';
      default:
        return 'Not Started';
    }
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return token.colorSuccess;
      case 'overdue':
        return token.colorError;
      case 'upcoming':
        return token.colorPrimary;
      case 'in-progress':
        return token.colorWarning;
      default:
        return token.colorTextTertiary;
    }
  };

  const getPriorityIcon = (priority: string) => {
    const priorityLower = priority?.toLowerCase();
    switch (priorityLower) {
      case 'low':
        return <MinusOutlined className="w-3 h-3" />;
      case 'medium':
        return <PauseOutlined className="w-3 h-3" style={{ transform: 'rotate(90deg)' }} />;
      case 'high':
        return <DoubleRightOutlined className="w-3 h-3" style={{ transform: 'rotate(90deg)' }} />;
      default:
        return <MinusOutlined className="w-3 h-3" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    const priorityLower = priority?.toLowerCase();
    switch (priorityLower) {
      case 'low':
        return '#52c41a';
      case 'medium':
        return '#faad14';
      case 'high':
        return '#ff4d4f';
      default:
        return token.colorTextTertiary;
    }
  };

  const convertAssigneesToMembers = (assignees: string[] | undefined) => {
    if (!assignees || assignees.length === 0) return [];

    return assignees.map((assignee, index) => ({
      id: `assignee-${index}`,
      name: assignee,
      color_code: token.colorPrimary,
    }));
  };

  const handleFieldSave = async (field: string, value: any) => {
    if (!localPhase || !projectId) {
      message.error('Phase or project information is missing');
      return;
    }

    // Get the actual phase_id from the localPhase object
    const phaseId =
      localPhase.phase_id || (localPhase.id.startsWith('phase-') ? localPhase.id.replace('phase-', '') : localPhase.id);

    if (!phaseId || phaseId === 'unmapped') {
      message.error('Cannot edit unmapped phase');
      return;
    }

    // Update local state immediately for better UX
    const updatedPhase = { ...localPhase, [field]: value };
    setLocalPhase(updatedPhase);

    try {
      // Prepare API request based on field
      const updateData: any = {
        phase_id: phaseId,
        project_id: projectId,
      };

      // Map the field to API format
      if (field === 'name') {
        updateData.name = value;
      } else if (field === 'color') {
        updateData.color_code = value;
      } else if (field === 'start_date') {
        updateData.start_date = value ? new Date(value).toISOString() : null;
      } else if (field === 'end_date') {
        updateData.end_date = value ? new Date(value).toISOString() : null;
      }

      // Call the API
      await updatePhase(updateData).unwrap();

      // Show success message
      message.success(`Phase ${field.replace('_', ' ')} updated successfully`);

      // Call the parent handler to refresh data in Gantt chart
      if (onPhaseUpdate) {
        onPhaseUpdate({
          id: localPhase.id,
          [field]: value,
        });
      }

      // Clear editing state
      setEditingField(null);
      setEditedValues({});
    } catch (error: any) {
      console.error('Failed to update phase:', error);
      message.error(error?.data?.message || `Failed to update phase ${field.replace('_', ' ')}`);
      
      // Revert the local state on error
      setLocalPhase(phase);

      // Don't clear editing state on error so user can try again
    }
  };

  const handleFieldCancel = () => {
    setEditingField(null);
    setEditedValues({});
  };

  const startEditing = (field: string, currentValue: any) => {
    setEditingField(field);
    setEditedValues({ [field]: currentValue });
  };

  if (!localPhase) return null;

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <ColorPicker
            value={localPhase.color || token.colorPrimary}
            onChangeComplete={color => handleFieldSave('color', color.toHexString())}
            size="small"
            showText={false}
            trigger="click"
          />
          {editingField === 'name' ? (
            <Input
              value={editedValues.name || localPhase.name}
              onChange={e => setEditedValues(prev => ({ ...prev, name: e.target.value }))}
              onPressEnter={() => handleFieldSave('name', editedValues.name)}
              onBlur={() => handleFieldSave('name', editedValues.name)}
              onKeyDown={e => e.key === 'Escape' && handleFieldCancel()}
              className="font-semibold text-lg"
              style={{ border: 'none', padding: 0, background: 'transparent' }}
              autoFocus
            />
          ) : (
            <Title
              level={4}
              className="!mb-0 cursor-pointer hover:opacity-70"
              style={{ color: token.colorText }}
              onClick={() => startEditing('name', localPhase.name)}
              title="Click to edit"
            >
              {localPhase.name}
            </Title>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1000}
      centered
      className="phase-details-modal"
      confirmLoading={isUpdating}
    >
      <div className="flex gap-6">
        {/* Left Side - Phase Overview and Stats */}
        <div className="flex-1 space-y-6">
          {/* Phase Overview */}
          <Card
            size="small"
            className="shadow-sm"
            style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title={t('overview.totalTasks')}
                  value={phaseStats.totalTasks}
                  prefix={<ClockCircleOutlined style={{ color: token.colorPrimary }} />}
                  valueStyle={{ color: token.colorText }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={t('overview.completion')}
                  value={phaseStats.completionPercentage}
                  suffix="%"
                  prefix={<CheckCircleOutlined style={{ color: token.colorSuccess }} />}
                  valueStyle={{ color: token.colorText }}
                />
              </Col>
            </Row>
            <Divider className="my-4" style={{ borderColor: token.colorBorder }} />
            <Progress
              percent={phaseStats.completionPercentage}
              strokeColor={{
                '0%': localPhase.color || token.colorPrimary,
                '100%': localPhase.color || token.colorPrimary,
              }}
              trailColor={token.colorBgLayout}
              className="mb-2"
            />
          </Card>

          {/* Date Information */}
          <Card
            size="small"
            title={
              <div className="flex items-center gap-2">
                <CalendarOutlined style={{ color: token.colorPrimary }} />
                <Text strong style={{ color: token.colorText }}>
                  {t('timeline.title')}
                </Text>
              </div>
            }
            className="shadow-sm"
            style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}
          >
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Text type="secondary">{t('timeline.startDate')}</Text>
                <br />
                {editingField === 'start_date' ? (
                  <DatePicker
                    value={
                      editedValues.start_date
                        ? dayjs(editedValues.start_date)
                        : localPhase.start_date
                          ? dayjs(localPhase.start_date)
                          : null
                    }
                    onChange={date => {
                      const newDate = date?.toDate() || null;
                      setEditedValues(prev => ({ ...prev, start_date: newDate }));
                      handleFieldSave('start_date', newDate);
                    }}
                    size="small"
                    className="w-full"
                    placeholder="Select start date"
                    autoFocus
                    open={true}
                    onOpenChange={open => !open && handleFieldCancel()}
                  />
                ) : (
                  <Text
                    strong
                    className="cursor-pointer hover:opacity-70"
                    style={{ color: token.colorText }}
                    onClick={() => startEditing('start_date', localPhase.start_date)}
                    title="Click to edit"
                  >
                    {formatDate(localPhase.start_date)}
                  </Text>
                )}
              </Col>
              <Col span={8}>
                <Text type="secondary">{t('timeline.endDate')}</Text>
                <br />
                {editingField === 'end_date' ? (
                  <DatePicker
                    value={
                      editedValues.end_date
                        ? dayjs(editedValues.end_date)
                        : localPhase.end_date
                          ? dayjs(localPhase.end_date)
                          : null
                    }
                    onChange={date => {
                      const newDate = date?.toDate() || null;
                      setEditedValues(prev => ({ ...prev, end_date: newDate }));
                      handleFieldSave('end_date', newDate);
                    }}
                    size="small"
                    className="w-full"
                    placeholder="Select end date"
                    autoFocus
                    open={true}
                    onOpenChange={open => !open && handleFieldCancel()}
                  />
                ) : (
                  <Text
                    strong
                    className="cursor-pointer hover:opacity-70"
                    style={{ color: token.colorText }}
                    onClick={() => startEditing('end_date', localPhase.end_date)}
                    title="Click to edit"
                  >
                    {formatDate(localPhase.end_date)}
                  </Text>
                )}
              </Col>
              <Col span={8}>
                <Text type="secondary">{t('timeline.status')}</Text>
                <br />
                <Tag color={getDateStatusColor()}>{getDateStatusText()}</Tag>
              </Col>
            </Row>
          </Card>

          {/* Task Breakdown */}
          <Card
            size="small"
            title={
              <div className="flex items-center gap-2">
                <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                <Text strong style={{ color: token.colorText }}>
                  {t('taskBreakdown.title')}
                </Text>
              </div>
            }
            className="shadow-sm"
            style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}
          >
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500 dark:text-green-400">
                    {phaseStats.completedTasks}
                  </div>
                  <Text type="secondary">{t('taskBreakdown.completed')}</Text>
                </div>
              </Col>
              <Col span={8}>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-500 dark:text-yellow-400">
                    {phaseStats.pendingTasks}
                  </div>
                  <Text type="secondary">{t('taskBreakdown.pending')}</Text>
                </div>
              </Col>
              <Col span={8}>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500 dark:text-red-400">
                    {phaseStats.overdueTasks}
                  </div>
                  <Text type="secondary">{t('taskBreakdown.overdue')}</Text>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Color Information */}
          <Card
            size="small"
            title={
              <div className="flex items-center gap-2">
                <BgColorsOutlined style={{ color: token.colorPrimary }} />
                <Text strong style={{ color: token.colorText }}>
                  {t('phaseColor.title')}
                </Text>
              </div>
            }
            className="shadow-sm"
            style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg border"
                style={{
                  backgroundColor: localPhase.color || token.colorPrimary,
                  borderColor: token.colorBorder,
                }}
              />
              <div>
                <Text strong style={{ color: token.colorText }}>
                  {localPhase.color || token.colorPrimary}
                </Text>
                <br />
                <Text type="secondary">{t('phaseColor.description')}</Text>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side - Task List */}
        <div className="flex-1 flex flex-col">
          {localPhase.children && localPhase.children.length > 0 ? (
            <Card
              size="small"
              title={
                <Text strong style={{ color: token.colorText }}>
                  {t('tasksInPhase.title')}
                </Text>
              }
              className="shadow-sm flex-1 flex flex-col"
              style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}
              styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' } }}
            >
              <div className="space-y-3 flex-1 overflow-y-auto max-h-96">
                {localPhase.children.map(task => {
                  const taskStatus = getTaskStatus(task);
                  const taskStatusColor = getTaskStatusColor(taskStatus);

                  const assigneeMembers = convertAssigneesToMembers(task.assignees);

                  return (
                    <div
                      key={task.id}
                      className={`p-3 rounded-md border transition-colors hover:shadow-sm ${
                        task.progress === 100
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      style={{
                        backgroundColor: task.progress === 100 ? undefined : token.colorBgContainer,
                        borderColor: task.progress === 100 ? undefined : token.colorBorder,
                      }}
                    >
                      {/* Main row with task info */}
                      <div className="flex items-center justify-between gap-3 mb-2">
                        {/* Left side: Status icon, task name, and priority */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {task.progress === 100 ? (
                            <CheckCircleOutlined
                              className="flex-shrink-0"
                              style={{ color: token.colorSuccess, fontSize: '14px' }}
                            />
                          ) : taskStatus === 'overdue' ? (
                            <ClockCircleOutlined
                              className="flex-shrink-0"
                              style={{ color: token.colorError, fontSize: '14px' }}
                            />
                          ) : (
                            <ClockCircleOutlined
                              className="flex-shrink-0"
                              style={{ color: token.colorWarning, fontSize: '14px' }}
                            />
                          )}

                          <Text
                            strong
                            className="text-sm truncate flex-1"
                            style={{ color: token.colorText }}
                            title={task.name}
                          >
                            {task.name}
                          </Text>

                          {/* Priority Icon */}
                          {task.priority && (
                            <Tooltip title={`Priority: ${task.priority}`}>
                              <div
                                className="flex items-center justify-center w-5 h-5 rounded flex-shrink-0"
                                style={{
                                  backgroundColor: getPriorityColor(task.priority),
                                  color: 'white',
                                }}
                              >
                                {getPriorityIcon(task.priority)}
                              </div>
                            </Tooltip>
                          )}
                        </div>

                        {/* Right side: Status tag */}
                        <Tag color={taskStatusColor} className="text-xs font-medium flex-shrink-0">
                          {getTaskStatusText(taskStatus)}
                        </Tag>
                      </div>

                      {/* Bottom row with assignees, progress, and due date */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Assignees */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {assigneeMembers.length > 0 ? (
                            <AvatarGroup
                              members={assigneeMembers}
                              maxCount={3}
                              size={20}
                              isDarkMode={false}
                            />
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400">
                              <UserOutlined className="text-xs" />
                              <Text type="secondary" className="text-xs">
                                Unassigned
                              </Text>
                            </div>
                          )}
                        </div>

                        {/* Due Date */}
                        <div className="flex items-center justify-end flex-1">
                          {task.end_date ? (
                            <div className="flex items-center gap-1">
                              <CalendarOutlined
                                className="text-xs"
                                style={{
                                  color:
                                    taskStatus === 'overdue'
                                      ? token.colorError
                                      : token.colorTextTertiary,
                                }}
                              />
                              <Text
                                type="secondary"
                                className={`text-xs ${taskStatus === 'overdue' ? 'text-red-500 dark:text-red-400' : ''}`}
                              >
                                {dayjs(task.end_date).format('MMM DD')}
                              </Text>
                            </div>
                          ) : (
                            <Text type="secondary" className="text-xs italic">
                              No due date
                            </Text>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card
              size="small"
              className="shadow-sm flex-1 flex items-center justify-center"
              style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}
              styles={{
                body: {
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }
              }}
            >
              <div className="text-center py-8">
                <ClockCircleOutlined
                  className="text-4xl mb-3"
                  style={{ color: token.colorTextTertiary }}
                />
                <Text type="secondary" className="text-lg">
                  {t('tasksInPhase.noTasks')}
                </Text>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default PhaseDetailsModal;
