import {
  Button,
  Col,
  Flex,
  Form,
  Popconfirm,
  Row,
  Select,
  Table,
  TableProps,
  Tag,
  Typography,
} from '@/shared/antd-imports';
import React, { useState, useEffect } from 'react';
import { DeleteOutlined, ExclamationCircleFilled } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateTaskCounts } from '@/features/task-management/task-management.slice';
import { colors } from '@/styles/colors';
import { TFunction } from 'i18next';
import { IDependencyType, ITaskDependency } from '@/types/tasks/task-dependency.types';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { taskDependenciesApiService } from '@/api/tasks/task-dependencies.api.service';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import './dependencies-table.css';

interface DependenciesTableProps {
  task: ITaskViewModel;
  t: TFunction;
  taskDependencies: ITaskDependency[];
  loadingTaskDependencies: boolean;
  refreshTaskDependencies: () => void;
}

const DependenciesTable = ({
  task,
  t,
  taskDependencies,
  loadingTaskDependencies,
  refreshTaskDependencies,
}: DependenciesTableProps) => {
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [isDependencyInputShow, setIsDependencyInputShow] = useState(false);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const dispatch = useAppDispatch();
  const [taskList, setTaskList] = useState<{ label: string; value: string }[]>([]);
  const [loadingTaskList, setLoadingTaskList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddDependency = async (taskId: string) => {
    console.log('taskId', taskId);
    if (!task.id) return;

    try {
      const body: ITaskDependency = {
        dependency_type: IDependencyType.BLOCKED_BY,
        task_id: task.id,
        related_task_id: taskId,
      };
      const res = await taskDependenciesApiService.createTaskDependency(body);
      if (res.done) {
        refreshTaskDependencies();
        setIsDependencyInputShow(false);
        setTaskList([]);
        setSearchTerm('');
        
        // Update Redux state with dependency status
        dispatch(updateTaskCounts({
          taskId: task.id,
          counts: {
            has_dependencies: true
          }
        }));
      }
    } catch (error) {
      console.error('Error adding dependency:', error);
    }
  };

  const handleSearchTask = async (value: string) => {
    if (!task.id || !projectId) return;
    setSearchTerm(value);

    try {
      setLoadingTaskList(true);
      const res = await tasksApiService.searchTask(task.id, projectId, value);
      if (res.done) {
        setTaskList(res.body);
      }
    } catch (error) {
      console.error('Error searching tasks:', error);
    } finally {
      setLoadingTaskList(false);
    }
  };

  const handleDeleteDependency = async (dependencyId: string | undefined) => {
    if (!dependencyId) return;
    try {
      const res = await taskDependenciesApiService.deleteTaskDependency(dependencyId);
      if (res.done) {
        refreshTaskDependencies();
        
        // Update Redux state with dependency status
        // Check if there are any remaining dependencies
        const remainingDependencies = taskDependencies.filter(dep => dep.id !== dependencyId);
        dispatch(updateTaskCounts({
          taskId: task.id,
          counts: {
            has_dependencies: remainingDependencies.length > 0
          }
        }));
      }
    } catch (error) {
      console.error('Error deleting dependency:', error);
    }
  };

  const columns: TableProps<ITaskDependency>['columns'] = [
    {
      key: 'name',
      render: (record: ITaskDependency) => (
        <Flex align="center" gap={8}>
          <Typography.Text ellipsis={{ tooltip: record.task_name }}>
            {record.task_name}
          </Typography.Text>
          <Tag>{record.task_key}</Tag>
        </Flex>
      ),
    },
    {
      key: 'blockedBy',
      render: record => (
        <Select
          value={record.dependency_type}
          options={[
            {
              key: IDependencyType.BLOCKED_BY,
              value: IDependencyType.BLOCKED_BY,
              label: 'Blocked By',
            },
          ]}
          size="small"
        />
      ),
    },
    {
      key: 'actionBtns',
      width: 60,
      render: (record: ITaskDependency) => (
        <div className="dependency-actions">
          <Popconfirm
            title={t('taskInfoTab.dependencies.confirmDeleteDependency')}
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            onConfirm={() => handleDeleteDependency(record.id)}
          >
            <Button shape="default" icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      {taskDependencies.length > 0 && (
        <Table
          className="custom-two-colors-row-table"
          showHeader={false}
          dataSource={taskDependencies}
          columns={columns}
          rowKey="id"
          pagination={false}
          loading={loadingTaskDependencies}
        />
      )}

      {isDependencyInputShow ? (
        <Form layout="inline">
          <Row gutter={8} style={{ width: '100%' }}>
            <Col span={14}>
              <Form.Item name="taskName" style={{ marginBottom: 0 }}>
                <Select
                  placeholder={t('taskInfoTab.dependencies.searchTask')}
                  size="small"
                  showSearch
                  value={searchTerm}
                  onSearch={handleSearchTask}
                  options={taskList}
                  loading={loadingTaskList}
                  onSelect={handleAddDependency}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleAddDependency;
                    }
                  }}
                  filterOption={false}
                  notFoundContent={t('taskInfoTab.dependencies.noTasksFound')}
                />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item name="blockedBy" style={{ marginBottom: 0 }}>
                <Select
                  options={[
                    {
                      key: IDependencyType.BLOCKED_BY,
                      value: IDependencyType.BLOCKED_BY,
                      label: 'Blocked By',
                    },
                  ]}
                  size="small"
                  disabled
                />
              </Form.Item>
            </Col>

            <Col span={4}>
              <Button
                icon={<DeleteOutlined />}
                size="small"
                onClick={() => {
                  setIsDependencyInputShow(false);
                  setTaskList([]);
                  setSearchTerm('');
                }}
              />
            </Col>
          </Row>
        </Form>
      ) : (
        <Button
          type="text"
          style={{
            width: 'fit-content',
            color: colors.skyBlue,
            padding: 0,
          }}
          onClick={() => setIsDependencyInputShow(true)}
        >
          {t('taskInfoTab.dependencies.addDependency')}
        </Button>
      )}
    </Flex>
  );
};

export default DependenciesTable;
