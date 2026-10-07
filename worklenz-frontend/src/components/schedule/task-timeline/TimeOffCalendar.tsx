import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  Radio,
  InputNumber,
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
  TimeOffEntry,
} from '@/api/schedule/scheduleApi';

const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Option } = Select;

export interface TimeOffCalendarMember {
  id: string;
  name: string;
  email?: string;
}

export interface EditableTimeOffEntry {
  id: string;
  team_member_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  is_full_day: boolean;
  hours_off: number | null;
  timezone: string | null;
  type: 'vacation' | 'sick' | 'personal' | 'other' | null;
}

interface TimeOffCalendarProps {
  members: TimeOffCalendarMember[];
  visible: boolean;
  onClose: () => void;
  dateRange?: [string, string];
  preselectedMemberId?: string | null;
  showEntriesTable?: boolean;
  initialEditingEntry?: EditableTimeOffEntry | null;
}

interface TimeOffFormValues {
  team_member_id: string;
  dateRange: [Dayjs, Dayjs];
  reason?: string;
  is_full_day?: boolean;
  hours_off?: number;
  type?: 'vacation' | 'sick' | 'personal' | 'other';
  timezone?: string;
}

const TimeOffCalendar: React.FC<TimeOffCalendarProps> = ({
  members,
  visible,
  onClose,
  dateRange,
  preselectedMemberId,
  showEntriesTable = true,
  initialEditingEntry = null,
}) => {
  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [form] = Form.useForm();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // RTK Query hooks
  const { data: timeOffData, isLoading, refetch } = useFetchTimeOffQuery(
    {
      teamMemberId: preselectedMemberId || undefined,
      startDate: dateRange?.[0],
      endDate: dateRange?.[1],
    },
    {
      skip: !visible,
      refetchOnMountOrArgChange: true,
    }
  );
  const [createTimeOff, { isLoading: isCreating }] = useCreateTimeOffMutation();
  const [updateTimeOff, { isLoading: isUpdating }] = useUpdateTimeOffMutation();
  const [deleteTimeOff, { isLoading: isDeleting }] = useDeleteTimeOffMutation();

  const timeOffEntries = timeOffData?.body || [];

  useEffect(() => {
    if (!visible) return;

    if (initialEditingEntry) {
      setEditingId(initialEditingEntry.id);
      form.setFieldsValue({
        team_member_id: initialEditingEntry.team_member_id,
        dateRange: [dayjs(initialEditingEntry.start_date), dayjs(initialEditingEntry.end_date)],
        reason: initialEditingEntry.reason,
        is_full_day: initialEditingEntry.is_full_day !== false,
        hours_off: initialEditingEntry.hours_off || undefined,
        type: initialEditingEntry.type || undefined,
        timezone: initialEditingEntry.timezone || undefined,
      });
      setIsFormVisible(true);
      return;
    }

    if (preselectedMemberId) {
      form.setFieldsValue({
        team_member_id: preselectedMemberId,
        is_full_day: true,
      });
      setIsFormVisible(true);
    } else {
      form.setFieldsValue({ is_full_day: true });
    }
  }, [visible, preselectedMemberId, initialEditingEntry, form]);

  const handleSubmit = async (values: TimeOffFormValues) => {
    try {
      const payload = {
        team_member_id: values.team_member_id,
        start_date: values.dateRange[0].format('YYYY-MM-DD'),
        end_date: values.dateRange[1].format('YYYY-MM-DD'),
        reason: values.reason,
        is_full_day: values.is_full_day !== false,
        hours_off: values.is_full_day === false ? values.hours_off : null,
        type: values.type || null,
        timezone: values.timezone || null,
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
      message.error(error?.data?.message || t('timeOffError', { defaultValue: 'Failed to save time-off' }));
    }
  };

  const handleEdit = (record: TimeOffEntry) => {
    setEditingId(record.id);
    form.setFieldsValue({
      team_member_id: record.team_member_id,
      dateRange: [dayjs(record.start_date), dayjs(record.end_date)],
      reason: record.reason,
      is_full_day: record.is_full_day !== false,
      hours_off: record.hours_off || undefined,
      type: record.type || undefined,
      timezone: record.timezone || undefined,
    });
    setIsFormVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTimeOff(id).unwrap();
      message.success(t('timeOffDeleted', { defaultValue: 'Time-off deleted successfully' }));
      refetch();
    } catch (error: any) {
      message.error(error?.data?.message || t('timeOffDeleteError', { defaultValue: 'Failed to delete time-off' }));
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setIsFormVisible(false);
    setEditingId(null);
  };

  const handleModalClose = () => {
    handleCancel();
    onClose();
  };

  const columns = [
    {
      title: t('teamMember', { defaultValue: 'Team Member' }),
      dataIndex: 'member_name',
      key: 'member_name',
      render: (name: string, record: TimeOffEntry) => (
        <Flex align="center" gap={8} style={{ minWidth: 160 }}>
          <span style={{ wordBreak: 'break-word', fontWeight: 500 }}>{name}</span>
          {record.member_email && (
            <span
              style={{
                color: themeWiseColor('#999', '#666', themeMode),
                fontSize: 12,
                wordBreak: 'break-word',
              }}
            >
              ({record.member_email})
            </span>
          )}
        </Flex>
      ),
    },
    {
      title: t('dateRange', { defaultValue: 'Date Range' }),
      key: 'dateRange',
      render: (_: unknown, record: TimeOffEntry) => (
        <Tag icon={<CalendarOutlined />} color="blue">
          {dayjs(record.start_date).format('MMM D, YYYY')} - {dayjs(record.end_date).format('MMM D, YYYY')}
        </Tag>
      ),
    },
    {
      title: t('duration', { defaultValue: 'Duration' }),
      key: 'duration',
      render: (_: unknown, record: TimeOffEntry) =>
        record.is_full_day ? (
          <Tag color="purple">{t('allDay', { defaultValue: 'All day' })}</Tag>
        ) : (
          <Tag color="cyan">
            {record.hours_off}h {t('partialDay', { defaultValue: 'Partial day' })}
          </Tag>
        ),
    },
    {
      title: t('type', { defaultValue: 'Type' }),
      key: 'type',
      dataIndex: 'type',
      render: (value: string | null) => {
        if (!value) return '-';
        const colorMap: Record<string, string> = {
          vacation: 'gold',
          sick: 'red',
          personal: 'geekblue',
          other: 'default',
        };
        return (
          <Tag color={colorMap[value] || 'default'}>
            {t(`timeOffType${value.charAt(0).toUpperCase() + value.slice(1)}`, { defaultValue: value.charAt(0).toUpperCase() + value.slice(1) })}
          </Tag>
        );
      },
    },
    {
      title: t('reason', { defaultValue: 'Reason' }),
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string | null) => reason || '-',
    },
    {
      title: t('actions', { defaultValue: 'Actions' }),
      key: 'actions',
      width: 100,
      render: (_: unknown, record: TimeOffEntry) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            aria-label={t('edit', { defaultValue: 'Edit' })}
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
              aria-label={t('delete', { defaultValue: 'Delete' })}
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
      onCancel={handleModalClose}
      width="min(960px, 92vw)"
      styles={{ body: { overflowX: 'auto' } }}
      footer={null}
      destroyOnClose
    >
      {/* Add Time-Off Button */}
      {!isFormVisible && (
        <Flex justify="flex-end" style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsFormVisible(true)}
          >
            {t('addTimeOff', { defaultValue: 'Add Time-Off' })}
          </Button>
        </Flex>
      )}

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
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Flex gap={16} wrap="wrap">
              <Form.Item
                name="team_member_id"
                label={t('teamMember', { defaultValue: 'Team Member' })}
                rules={[{ required: true, message: t('selectMember', { defaultValue: 'Please select a team member' }) }]}
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
                rules={[{ required: true, message: t('selectDateRange', { defaultValue: 'Please select date range' }) }]}
                style={{ flex: 1, minWidth: 280 }}
              >
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Flex>

            <Flex gap={16} wrap="wrap">
              <Form.Item
                name="is_full_day"
                label={t('durationType', { defaultValue: 'Duration Type' })}
                initialValue={true}
                style={{ minWidth: 260 }}
              >
                <Radio.Group>
                  <Radio value={true}>{t('allDay', { defaultValue: 'All day' })}</Radio>
                  <Radio value={false}>{t('partialDay', { defaultValue: 'Partial day' })}</Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.is_full_day !== currentValues.is_full_day}
              >
                {({ getFieldValue }) =>
                  getFieldValue('is_full_day') === false ? (
                    <Form.Item
                      name="hours_off"
                      label={t('hoursOff', { defaultValue: 'Hours Off' })}
                      rules={[
                        { required: true, message: t('hoursOffRequired', { defaultValue: 'Please enter hours off' }) },
                      ]}
                      style={{ minWidth: 180 }}
                    >
                      <InputNumber
                        min={0.5}
                        max={24}
                        step={0.5}
                        precision={1}
                        style={{ width: '100%' }}
                        placeholder={t('hoursOffPlaceholder', { defaultValue: 'e.g. 3.5' })}
                      />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>

              <Form.Item
                name="type"
                label={t('timeOffType', { defaultValue: 'Type' })}
                style={{ minWidth: 180 }}
              >
                <Select allowClear placeholder={t('selectType', { defaultValue: 'Select type' })}>
                  <Option value="vacation">{t('timeOffTypeVacation', { defaultValue: 'Vacation' })}</Option>
                  <Option value="sick">{t('timeOffTypeSick', { defaultValue: 'Sick' })}</Option>
                  <Option value="personal">{t('timeOffTypePersonal', { defaultValue: 'Personal' })}</Option>
                  <Option value="other">{t('timeOffTypeOther', { defaultValue: 'Other' })}</Option>
                </Select>
              </Form.Item>
            </Flex>

            <Form.Item
              name="reason"
              label={t('reason', { defaultValue: 'Reason (Optional)' })}
            >
              <TextArea
                rows={2}
                placeholder={t('reasonPlaceholder', { defaultValue: 'e.g., Vacation, Sick leave, Personal day' })}
              />
            </Form.Item>

            <Flex justify="flex-end" gap={8}>
              <Button onClick={handleCancel}>
                {t('cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={isCreating || isUpdating}
              >
                {editingId
                  ? t('update', { defaultValue: 'Update' })
                  : t('create', { defaultValue: 'Create' })}
              </Button>
            </Flex>
          </Form>
        </div>
      )}

      {/* Time-Off List */}
      {showEntriesTable && (
        <Table
          columns={columns}
          dataSource={timeOffEntries}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <Empty
                description={t('noTimeOff', { defaultValue: 'No time-off entries' })}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      )}
    </Modal>
  );
};

export default TimeOffCalendar;
