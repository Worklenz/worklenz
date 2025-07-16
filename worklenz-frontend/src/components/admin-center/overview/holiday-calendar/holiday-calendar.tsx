import React, { useEffect, useState } from 'react';
import { Calendar, Card, Typography, Button, Modal, Form, Input, Select, DatePicker, Switch, Space, Tag, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import { holidayApiService } from '@/api/holiday/holiday.api.service';
import {
  IHolidayType,
  IOrganizationHoliday,
  IAvailableCountry,
  ICreateHolidayRequest,
  IUpdateHolidayRequest,
} from '@/types/holiday/holiday.types';
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
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const [holidayTypes, setHolidayTypes] = useState<IHolidayType[]>([]);
  const [organizationHolidays, setOrganizationHolidays] = useState<IOrganizationHoliday[]>([]);
  const [availableCountries, setAvailableCountries] = useState<IAvailableCountry[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<IOrganizationHoliday | null>(null);
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

  const fetchOrganizationHolidays = async () => {
    setLoading(true);
    try {
      const res = await holidayApiService.getOrganizationHolidays(currentDate.year());
      if (res.done) {
        setOrganizationHolidays(res.body);
      }
    } catch (error) {
      logger.error('Error fetching organization holidays', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCountries = async () => {
    try {
      const res = await holidayApiService.getAvailableCountries();
      if (res.done) {
        setAvailableCountries(res.body);
      }
    } catch (error) {
      logger.error('Error fetching available countries', error);
    }
  };

  useEffect(() => {
    fetchHolidayTypes();
    fetchOrganizationHolidays();
    fetchAvailableCountries();
  }, [currentDate.year()]);

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
        fetchOrganizationHolidays();
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

      const res = await holidayApiService.updateOrganizationHoliday(selectedHoliday.id, holidayData);
      if (res.done) {
        message.success(t('holidayUpdated'));
        setEditModalVisible(false);
        editForm.resetFields();
        setSelectedHoliday(null);
        fetchOrganizationHolidays();
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
        fetchOrganizationHolidays();
      }
    } catch (error) {
      logger.error('Error deleting holiday', error);
      message.error(t('errorDeletingHoliday'));
    }
  };

  const handleImportCountryHolidays = async (values: any) => {
    try {
      const res = await holidayApiService.importCountryHolidays({
        country_code: values.country_code,
        year: values.year || currentDate.year(),
      });
      if (res.done) {
        message.success(t('holidaysImported', { count: res.body.imported_count }));
        setImportModalVisible(false);
        fetchOrganizationHolidays();
      }
    } catch (error) {
      logger.error('Error importing country holidays', error);
      message.error(t('errorImportingHolidays'));
    }
  };

  const handleEditHoliday = (holiday: IOrganizationHoliday) => {
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
    const holiday = organizationHolidays.find(h => dayjs(h.date).isSame(date, 'day'));
    
    if (holiday) {
      const holidayType = holidayTypes.find(ht => ht.id === holiday.holiday_type_id);
      return (
        <div className="holiday-cell">
          <Tag 
            color={holidayType?.color_code || '#f37070'}
            style={{ 
              fontSize: '10px', 
              padding: '1px 4px',
              margin: 0,
              borderRadius: '2px'
            }}
          >
            {holiday.name}
          </Tag>
        </div>
      );
    }
    return null;
  };

  const onPanelChange = (value: Dayjs) => {
    setCurrentDate(value);
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          {t('holidayCalendar')}
        </Title>
        <Space>
          <Button 
            icon={<GlobalOutlined />} 
            onClick={() => setImportModalVisible(true)}
            size="small"
          >
            {t('importCountryHolidays')}
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setModalVisible(true)}
            size="small"
          >
            {t('addHoliday')}
          </Button>
        </Space>
      </div>

      <Calendar
        value={currentDate}
        onPanelChange={onPanelChange}
        dateCellRender={getHolidayDateCellRender}
        className={`holiday-calendar ${themeMode}`}
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
                        marginRight: 8
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
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}>
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
                        marginRight: 8
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
              <Button onClick={() => {
                setEditModalVisible(false);
                editForm.resetFields();
                setSelectedHoliday(null);
              }}>
                {t('cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Country Holidays Modal */}
      <Modal
        title={t('importCountryHolidays')}
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={handleImportCountryHolidays}>
          <Form.Item
            name="country_code"
            label={t('country')}
            rules={[{ required: true, message: t('countryRequired') }]}
          >
            <Select placeholder={t('selectCountry')}>
              {availableCountries.map(country => (
                <Option key={country.code} value={country.code}>
                  {country.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="year" label={t('year')}>
            <DatePicker picker="year" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('import')}
              </Button>
              <Button onClick={() => setImportModalVisible(false)}>
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