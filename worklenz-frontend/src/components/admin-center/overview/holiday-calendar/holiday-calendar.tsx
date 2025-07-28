import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  Card,
  Typography,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Switch,
  Space,
  Tag,
  Popconfirm,
  message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import { holidayApiService } from '@/api/holiday/holiday.api.service';
import {
  IHolidayType,
  ICreateHolidayRequest,
  IUpdateHolidayRequest,
  IHolidayCalendarEvent,
} from '@/types/holiday/holiday.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { RootState } from '@/app/store';
import { fetchHolidays } from '@/features/admin-center/admin-center.slice';
import logger from '@/utils/errorLogger';
import './holiday-calendar.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface HolidayCalendarProps {
  themeMode: string;
}

const HolidayCalendar: React.FC<HolidayCalendarProps> = ({ themeMode }) => {
  const { t } = useTranslation('admin-center/overview');
  const dispatch = useAppDispatch();
  const { holidays, loadingHolidays, holidaySettings } = useAppSelector(
    (state: RootState) => state.adminCenterReducer
  );
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const [holidayTypes, setHolidayTypes] = useState<IHolidayType[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<IHolidayCalendarEvent | null>(null);
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());

  const fetchHolidayTypes = async () => {
    try {
      const res = await holidayApiService.getHolidayTypes();
      if (res.done) {
        setHolidayTypes(res.body);
      }
    } catch (error) {
      logger.error('Error fetching holiday types', error);
    }
  };

  const fetchHolidaysForDateRange = () => {
    const startOfYear = currentDate.startOf('year');
    const endOfYear = currentDate.endOf('year');

    dispatch(
      fetchHolidays({
        from_date: startOfYear.format('YYYY-MM-DD'),
        to_date: endOfYear.format('YYYY-MM-DD'),
        include_custom: true,
      })
    );
  };

  useEffect(() => {
    fetchHolidayTypes();
    fetchHolidaysForDateRange();
  }, [currentDate.year()]);

  const customHolidays = useMemo(() => {
    return holidays.filter(holiday => holiday.source === 'custom');
  }, [holidays]);

  const handleCreateHoliday = async (values: any) => {
    try {
      const holidayData: ICreateHolidayRequest = {
        name: values.name,
        description: values.description,
        date: values.date.format('YYYY-MM-DD'),
        holiday_type_id: values.holiday_type_id,
        is_recurring: values.is_recurring || false,
      };

      const res = await holidayApiService.createOrganizationHoliday(holidayData);
      if (res.done) {
        message.success(t('holidayCreated'));
        setModalVisible(false);
        form.resetFields();
        fetchHolidaysForDateRange();
      }
    } catch (error) {
      logger.error('Error creating holiday', error);
      message.error(t('errorCreatingHoliday'));
    }
  };

  const handleUpdateHoliday = async (values: any) => {
    if (!selectedHoliday) return;

    try {
      const holidayData: IUpdateHolidayRequest = {
        id: selectedHoliday.id,
        name: values.name,
        description: values.description,
        date: values.date?.format('YYYY-MM-DD'),
        holiday_type_id: values.holiday_type_id,
        is_recurring: values.is_recurring,
      };

      const res = await holidayApiService.updateOrganizationHoliday(
        selectedHoliday.id,
        holidayData
      );
      if (res.done) {
        message.success(t('holidayUpdated'));
        setEditModalVisible(false);
        editForm.resetFields();
        setSelectedHoliday(null);
        fetchHolidaysForDateRange();
      }
    } catch (error) {
      logger.error('Error updating holiday', error);
      message.error(t('errorUpdatingHoliday'));
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    try {
      const res = await holidayApiService.deleteOrganizationHoliday(holidayId);
      if (res.done) {
        message.success(t('holidayDeleted'));
        fetchHolidaysForDateRange();
      }
    } catch (error) {
      logger.error('Error deleting holiday', error);
      message.error(t('errorDeletingHoliday'));
    }
  };

  const handleEditHoliday = (holiday: IHolidayCalendarEvent) => {
    // Only allow editing custom holidays
    if (holiday.source !== 'custom' || !holiday.is_editable) {
      message.warning(t('cannotEditOfficialHoliday') || 'Cannot edit official holidays');
      return;
    }

    setSelectedHoliday(holiday);
    editForm.setFieldsValue({
      name: holiday.name,
      description: holiday.description,
      date: dayjs(holiday.date),
      holiday_type_id: holiday.holiday_type_name, // This might need adjustment based on backend
      is_recurring: holiday.is_recurring,
    });
    setEditModalVisible(true);
  };

  const getHolidayDateCellRender = (date: Dayjs) => {
    const dateHolidays = holidays.filter(h => dayjs(h.date).isSame(date, 'day'));

    if (dateHolidays.length > 0) {
      return (
        <div className="holiday-cell">
          {dateHolidays.map((holiday, index) => (
            <Tag
              key={`${holiday.id}-${index}`}
              color={holiday.color_code || (holiday.source === 'official' ? '#1890ff' : '#f37070')}
              style={{
                fontSize: '10px',
                padding: '1px 4px',
                margin: '1px 0',
                borderRadius: '2px',
                display: 'block',
                opacity: holiday.source === 'official' ? 0.8 : 1,
              }}
              title={`${holiday.name}${holiday.source === 'official' ? ' (Official)' : ' (Custom)'}`}
            >
              {holiday.name}
            </Tag>
          ))}
        </div>
      );
    }
    return null;
  };

  const onPanelChange = (value: Dayjs) => {
    setCurrentDate(value);
  };

  const onDateSelect = (date: Dayjs) => {
    // Check if there's already a custom holiday on this date
    const existingCustomHoliday = holidays.find(
      h => dayjs(h.date).isSame(date, 'day') && h.source === 'custom' && h.is_editable
    );

    if (existingCustomHoliday) {
      // If custom holiday exists, open edit modal
      handleEditHoliday(existingCustomHoliday);
    } else {
      // If no custom holiday, open create modal with pre-filled date
      form.setFieldValue('date', date);
      setModalVisible(true);
    }
  };

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          {t('holidayCalendar')}
        </Title>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
            size="small"
          >
            {t('addCustomHoliday') || 'Add Custom Holiday'}
          </Button>
          {holidaySettings?.country_code && (
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              {t('officialHolidaysFrom') || 'Official holidays from'}:{' '}
              {holidaySettings.country_code}
              {holidaySettings.state_code && ` (${holidaySettings.state_code})`}
            </Typography.Text>
          )}
        </Space>
      </div>

      <Calendar
        value={currentDate}
        onPanelChange={onPanelChange}
        onSelect={onDateSelect}
        dateCellRender={getHolidayDateCellRender}
        className={`holiday-calendar ${themeMode}`}
        loading={loadingHolidays}
      />

      {/* Create Holiday Modal */}
      <Modal
        title={t('addHoliday')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateHoliday}>
          <Form.Item
            name="name"
            label={t('holidayName')}
            rules={[{ required: true, message: t('holidayNameRequired') }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="description" label={t('description')}>
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item
            name="date"
            label={t('date')}
            rules={[{ required: true, message: t('dateRequired') }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="holiday_type_id"
            label={t('holidayType')}
            rules={[{ required: true, message: t('holidayTypeRequired') }]}
          >
            <Select>
              {holidayTypes.map(type => (
                <Option key={type.id} value={type.id}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: type.color_code,
                        marginRight: 8,
                      }}
                    />
                    {type.name}
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="is_recurring" label={t('recurring')} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('save')}
              </Button>
              <Button
                onClick={() => {
                  setModalVisible(false);
                  form.resetFields();
                }}
              >
                {t('cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Holiday Modal */}
      <Modal
        title={t('editHoliday')}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setSelectedHoliday(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateHoliday}>
          <Form.Item
            name="name"
            label={t('holidayName')}
            rules={[{ required: true, message: t('holidayNameRequired') }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="description" label={t('description')}>
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item
            name="date"
            label={t('date')}
            rules={[{ required: true, message: t('dateRequired') }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="holiday_type_id"
            label={t('holidayType')}
            rules={[{ required: true, message: t('holidayTypeRequired') }]}
          >
            <Select>
              {holidayTypes.map(type => (
                <Option key={type.id} value={type.id}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: type.color_code,
                        marginRight: 8,
                      }}
                    />
                    {type.name}
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="is_recurring" label={t('recurring')} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('update')}
              </Button>
              <Button
                onClick={() => {
                  setEditModalVisible(false);
                  editForm.resetFields();
                  setSelectedHoliday(null);
                }}
              >
                {t('cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default HolidayCalendar;
