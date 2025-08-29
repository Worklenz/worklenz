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
} from '@/shared/antd-imports';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@/shared/antd-imports';
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
import { fetchHolidays, clearHolidaysCache } from '@/features/admin-center/admin-center.slice';
import logger from '@/utils/errorLogger';
import './holiday-calendar.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface HolidayCalendarProps {
  themeMode: string;
  workingDays?: string[];
}

const HolidayCalendar: React.FC<HolidayCalendarProps> = ({ themeMode, workingDays = [] }) => {
  const { t } = useTranslation('admin-center/overview');
  const dispatch = useAppDispatch();
  const { holidays, holidaySettings } = useAppSelector(
    (state: RootState) => state.adminCenterReducer
  );
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const [holidayTypes, setHolidayTypes] = useState<IHolidayType[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<IHolidayCalendarEvent | null>(null);
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [isPopulatingHolidays, setIsPopulatingHolidays] = useState(false);
  const [hasAttemptedPopulation, setHasAttemptedPopulation] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

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

  const populateHolidaysIfNeeded = async () => {
    // Check if we have holiday settings with a country code but no holidays
    // Also check if we haven't already attempted population and we're not currently populating
    if (
      holidaySettings?.country_code &&
      holidays.length === 0 &&
      !hasAttemptedPopulation &&
      !isPopulatingHolidays
    ) {
      try {
        setIsPopulatingHolidays(true);
        setHasAttemptedPopulation(true);

        const populateRes = await holidayApiService.populateCountryHolidays();
        if (populateRes.done) {
          // Refresh holidays after population
          fetchHolidaysForDateRange(true);
        }
      } catch (error) {
        logger.error('populateHolidaysIfNeeded', error);
      } finally {
        setIsPopulatingHolidays(false);
      }
    }
  };

  const fetchHolidaysForDateRange = (forceRefresh = false) => {
    const startOfYear = currentDate.startOf('year');
    const endOfYear = currentDate.endOf('year');

    // If forceRefresh is true, clear the cached holidays first
    if (forceRefresh) {
      dispatch(clearHolidaysCache());
    }

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

  // Check if we need to populate holidays when holiday settings are loaded
  useEffect(() => {
    populateHolidaysIfNeeded();
  }, [holidaySettings]);

  // Reset population attempt state when holiday settings change
  useEffect(() => {
    setHasAttemptedPopulation(false);
  }, [holidaySettings?.country_code]);

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
        fetchHolidaysForDateRange(true);
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
        fetchHolidaysForDateRange(true);
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
        // Close the edit modal and reset form
        setEditModalVisible(false);
        editForm.resetFields();
        setSelectedHoliday(null);
        // Refresh holidays data
        fetchHolidaysForDateRange(true);
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
      holiday_type_id: holiday.holiday_type_id,
      is_recurring: holiday.is_recurring,
    });
    setEditModalVisible(true);
  };

  const getHolidayDateCellRender = (date: Dayjs) => {
    const dateHolidays = holidays.filter(h => dayjs(h.date).isSame(date, 'day'));
    const dayName = date.format('dddd');
    // Check if this day is in the working days array from API response
    const isWorkingDay =
      workingDays && workingDays.length > 0 ? workingDays.includes(dayName) : false;
    const isToday = date.isSame(dayjs(), 'day');
    const isCurrentMonth = date.isSame(currentDate, 'month');

    return (
      <div
        className={`calendar-cell ${isWorkingDay ? 'working-day' : 'non-working-day'} ${isToday ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}`}
      >
        {dateHolidays.length > 0 && (
          <div className="holiday-cell">
            {dateHolidays.map((holiday, index) => {
              const isOfficial = holiday.source === 'official';
              const isCustom = holiday.source === 'custom';
              return (
                <Tag
                  key={`${holiday.id}-${index}`}
                  color={holiday.color_code || (isOfficial ? '#1890ff' : '#52c41a')}
                  className={`holiday-tag ${isOfficial ? 'official-holiday' : 'custom-holiday'}`}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    margin: '1px 0',
                    borderRadius: '4px',
                    display: 'block',
                    fontWeight: isCustom ? 600 : 500,
                    border: isCustom
                      ? '1px solid rgba(82, 196, 26, 0.6)'
                      : '1px solid rgba(24, 144, 255, 0.4)',
                    position: 'relative',
                  }}
                  title={`${holiday.name}${isOfficial ? ' (Official Holiday)' : ' (Custom Holiday)'}`}
                >
                  {isCustom && (
                    <span className="custom-holiday-icon" style={{ marginRight: '2px' }}>
                      ⭐
                    </span>
                  )}
                  {isOfficial && (
                    <span className="official-holiday-icon" style={{ marginRight: '2px' }}>
                      🏛️
                    </span>
                  )}
                  {holiday.name}
                </Tag>
              );
            })}
          </div>
        )}
        {isWorkingDay && (
          <div className="working-day-indicator" title={`${dayName} - Working Day`}>
            <div className="working-day-badge">W</div>
          </div>
        )}
      </div>
    );
  };

  const onPanelChange = (value: Dayjs) => {
    setIsNavigating(true);
    setCurrentDate(value);
    // Reset navigation flag after a short delay to allow the onSelect event to check it
    setTimeout(() => setIsNavigating(false), 100);
  };

  const onDateSelect = (date: Dayjs) => {
    // Prevent modal from opening during navigation (month/year changes)
    if (isNavigating) {
      return;
    }

    // Prevent modal from opening if the date is from a different month (navigation click)
    if (!date.isSame(currentDate, 'month')) {
      return;
    }

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
          alignItems: 'flex-start',
          marginBottom: 18,
          padding: '4px 0',
        }}
      >
        <div>
          <Title level={4} style={{ margin: '0 0 4px 0', fontWeight: 600 }}>
            {t('holidayCalendar')}
          </Title>
          {holidaySettings?.country_code && (
            <Typography.Text type="secondary" style={{ fontSize: '13px', fontWeight: 500 }}>
              {t('officialHolidaysFrom') || 'Official holidays from'}:{' '}
              <span style={{ color: themeMode === 'dark' ? '#40a9ff' : '#1890ff' }}>
                {holidaySettings.country_code}
                {holidaySettings.state_code && ` (${holidaySettings.state_code})`}
              </span>
              {isPopulatingHolidays && (
                <span style={{ marginLeft: 8, color: '#faad14' }}>
                  🔄 Populating official holidays...
                </span>
              )}
            </Typography.Text>
          )}
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
          style={{
            borderRadius: '8px',
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(24, 144, 255, 0.2)';
          }}
        >
          {t('addCustomHoliday') || 'Add Custom Holiday'}
        </Button>
      </div>

      <div className={`calendar-container holiday-calendar ${themeMode}`}>
        <Calendar
          value={currentDate}
          onPanelChange={onPanelChange}
          onSelect={onDateSelect}
          dateCellRender={getHolidayDateCellRender}
          className={`holiday-calendar ${themeMode}`}
        />

        {/* Calendar Legend */}
        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-badge working-day-badge">W</div>
            <span>{t('workingDay') || 'Working Day'}</span>
          </div>
          <div className="legend-item">
            <div className="legend-tag custom-holiday-legend">
              <span className="custom-holiday-icon">⭐</span>
              <span className="legend-tag-text">Custom</span>
            </div>
            <span>{t('customHoliday') || 'Custom Holiday'}</span>
          </div>
          <div className="legend-item">
            <div className="legend-tag official-holiday-legend">
              <span className="official-holiday-icon">🏛️</span>
              <span className="legend-tag-text">Official</span>
            </div>
            <span>{t('officialHoliday') || 'Official Holiday'}</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot today-dot"></div>
            <span>{t('today') || 'Today'}</span>
          </div>
        </div>
      </div>

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
        destroyOnHidden
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
              {selectedHoliday &&
                selectedHoliday.source === 'custom' &&
                selectedHoliday.is_editable && (
                  <Popconfirm
                    title={
                      t('deleteHolidayConfirm') || 'Are you sure you want to delete this holiday?'
                    }
                    onConfirm={() => handleDeleteHoliday(selectedHoliday.id)}
                    okText={t('yes') || 'Yes'}
                    cancelText={t('no') || 'No'}
                  >
                    <Button type="primary" danger icon={<DeleteOutlined />}>
                      {t('delete') || 'Delete'}
                    </Button>
                  </Popconfirm>
                )}
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default HolidayCalendar;
