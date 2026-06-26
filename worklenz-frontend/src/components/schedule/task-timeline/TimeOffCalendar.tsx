import React, { useState } from 'react';
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  Button,
  Table,
  Space,
  Popconfirm,
  message,
  Tag,
  Flex,
  Empty,
} from '@/shared/antd-imports';
import { PlusOutlined, DeleteOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import dayjs, { Dayjs } from 'dayjs';
import {
  useFetchTimeOffQuery,
  useCreateTimeOffMutation,
  useUpdateTimeOffMutation,
  useDeleteTimeOffMutation,
} from '@/api/schedule/scheduleApi';

const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Option } = Select;

interface Member {
  id: string;
  name: string;
  email?: string;
}

interface TimeOffCalendarProps {
  members: Member[];
  visible: boolean;
  onClose: () => void;
  dateRange?: [string, string];
}

interface TimeOffFormValues {
  team_member_id: string;
  dateRange: [Dayjs, Dayjs];
  reason?: string;
}

const TimeOffCalendar: React.FC<TimeOffCalendarProps> = ({
  members,
  visible,
  onClose,
  dateRange,
}) => {
  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [form] = Form.useForm();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // RTK Query hooks
  const {
    data: timeOffData,
    isLoading,
    refetch,
  } = useFetchTimeOffQuery({
    startDate: dateRange?.[0],
    endDate: dateRange?.[1],
  });
  const [createTimeOff, { isLoading: isCreating }] = useCreateTimeOffMutation();
  const [updateTimeOff, { isLoading: isUpdating }] = useUpdateTimeOffMutation();
  const [deleteTimeOff, { isLoading: isDeleting }] = useDeleteTimeOffMutation();

  const timeOffEntries = timeOffData?.body || [];

  const handleSubmit = async (values: TimeOffFormValues) => {
    try {
      const payload = {
        team_member_id: values.team_member_id,
        start_date: values.dateRange[0].format('YYYY-MM-DD'),
        end_date: values.dateRange[1].format('YYYY-MM-DD'),
        reason: values.reason,
      };

      if (editingId) {
        await updateTimeOff({ id: editingId, ...payload }).unwrap();
        message.success(t('timeOffUpdated', { defaultValue: 'Time-off updated successfully' }));
      } else {
        await createTimeOff(payload).unwrap();
        message.success(t('timeOffCreated', { defaultValue: 'Time-off created successfully' }));
      }

      form.resetFields();
      setIsFormVisible(false);
      setEditingId(null);
      refetch();
    } catch (error: any) {
      message.error(
        error?.data?.message || t('timeOffError', { defaultValue: 'Failed to save time-off' })
      );
    }
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      team_member_id: record.team_member_id,
      dateRange: [dayjs(record.start_date), dayjs(record.end_date)],
      reason: record.reason,
    });
    setIsFormVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTimeOff(id).unwrap();
      message.success(t('timeOffDeleted', { defaultValue: 'Time-off deleted successfully' }));
      refetch();
    } catch (error: any) {
      message.error(
        error?.data?.message ||
          t('timeOffDeleteError', { defaultValue: 'Failed to delete time-off' })
      );
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setIsFormVisible(false);
    setEditingId(null);
  };

  const columns = [
    {
      title: t('teamMember', { defaultValue: 'Team Member' }),
      dataIndex: 'member_name',
      key: 'member_name',
      render: (name: string, record: any) => (
        <Flex align="center" gap={8}>
          <span>{name}</span>
          {record.member_email && (
            <span style={{ color: themeWiseColor('#999', '#666', themeMode), fontSize: 12 }}>
              ({record.member_email})
            </span>
          )}
        </Flex>
      ),
    },
    {
      title: t('dateRange', { defaultValue: 'Date Range' }),
      key: 'dateRange',
      render: (_: any, record: any) => (
        <Tag icon={<CalendarOutlined />} color="blue">
          {dayjs(record.start_date).format('MMM D, YYYY')} -{' '}
          {dayjs(record.end_date).format('MMM D, YYYY')}
        </Tag>
      ),
    },
    {
      title: t('reason', { defaultValue: 'Reason' }),
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => reason || '-',
    },
    {
      title: t('actions', { defaultValue: 'Actions' }),
      key: 'actions',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title={t('deleteTimeOffConfirm', { defaultValue: 'Delete this time-off entry?' })}
            onConfirm={() => handleDelete(record.id)}
            okText={t('yes', { defaultValue: 'Yes' })}
            cancelText={t('no', { defaultValue: 'No' })}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={isDeleting}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Flex align="center" gap={8}>
          <CalendarOutlined />
          {t('timeOffManagement', { defaultValue: 'Time-Off Management' })}
        </Flex>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      {/* Add Time-Off Button */}
      <Flex justify="flex-end" style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsFormVisible(true)}>
          {t('addTimeOff', { defaultValue: 'Add Time-Off' })}
        </Button>
      </Flex>

      {/* Time-Off Form */}
      {isFormVisible && (
        <div
          style={{
            padding: 16,
            marginBottom: 16,
            backgroundColor: themeWiseColor('#fafafa', '#1f1f1f', themeMode),
            borderRadius: 8,
          }}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Flex gap={16} wrap="wrap">
              <Form.Item
                name="team_member_id"
                label={t('teamMember', { defaultValue: 'Team Member' })}
                rules={[
                  {
                    required: true,
                    message: t('selectMember', { defaultValue: 'Please select a team member' }),
                  },
                ]}
                style={{ flex: 1, minWidth: 200 }}
              >
                <Select
                  placeholder={t('selectMember', { defaultValue: 'Select team member' })}
                  showSearch
                  optionFilterProp="children"
                >
                  {members.map(member => (
                    <Option key={member.id} value={member.id}>
                      {member.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="dateRange"
                label={t('dateRange', { defaultValue: 'Date Range' })}
                rules={[
                  {
                    required: true,
                    message: t('selectDateRange', { defaultValue: 'Please select date range' }),
                  },
                ]}
                style={{ flex: 1, minWidth: 280 }}
              >
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Flex>

            <Form.Item name="reason" label={t('reason', { defaultValue: 'Reason (Optional)' })}>
              <TextArea
                rows={2}
                placeholder={t('reasonPlaceholder', {
                  defaultValue: 'e.g., Vacation, Sick leave, Personal day',
                })}
              />
            </Form.Item>

            <Flex justify="flex-end" gap={8}>
              <Button onClick={handleCancel}>{t('cancel', { defaultValue: 'Cancel' })}</Button>
              <Button type="primary" htmlType="submit" loading={isCreating || isUpdating}>
                {editingId
                  ? t('update', { defaultValue: 'Update' })
                  : t('create', { defaultValue: 'Create' })}
              </Button>
            </Flex>
          </Form>
        </div>
      )}

      {/* Time-Off List */}
      <Table
        columns={columns}
        dataSource={timeOffEntries}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: (
            <Empty
              description={t('noTimeOff', { defaultValue: 'No time-off entries' })}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
      />
    </Modal>
  );
};

export default TimeOffCalendar;
