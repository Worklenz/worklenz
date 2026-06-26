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
import { PlusOutlined, DeleteOutlined } from '@/shared/antd-imports';
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

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ---------------------------------------------------------------------------
// PREDEFINED_HOLIDAY_TYPES — UI display metadata only.
//
// IMPORTANT: The `id` values here are TEMPORARY placeholders used purely so
// the dropdown renders immediately on first paint (before the API responds).
// These placeholder ids are NEVER sent to the backend.
//
// fetchHolidayTypes() replaces this list with real DB rows (which have proper
// UUIDs) as soon as the API responds. The merge logic ensures:
//   • Federal Holiday always appears first in the list.
//   • Once the DB row for Federal Holiday is loaded, its real UUID replaces
//     the placeholder — so saves work correctly with no FK violation.
//
// PREREQUISITE: Run this SQL once in pgAdmin to seed the DB row:
//
//   INSERT INTO holiday_types (id, name, description, color_code, created_at, updated_at)
//   VALUES (gen_random_uuid(), 'Federal Holiday', 'Official US Federal Holidays',
//           '#1890ff', NOW(), NOW());
// ---------------------------------------------------------------------------
const PREDEFINED_HOLIDAY_DISPLAY: Array<Omit<IHolidayType, 'id'> & { tempId: string }> = [
  {
    tempId: '__federal-holiday__',
    name: 'Federal Holiday',
    description: 'Official US Federal Holidays',
    color_code: '#1890ff',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    tempId: '__public-holiday__',
    name: 'Public Holiday',
    description: 'National public holidays',
    color_code: '#f5222d',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    tempId: '__company-holiday__',
    name: 'Company Holiday',
    description: 'Company-specific holidays',
    color_code: '#52c41a',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    tempId: '__religious-holiday__',
    name: 'Religious Holiday',
    description: 'Religious observances',
    color_code: '#faad14',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    tempId: '__personal-holiday__',
    name: 'Personal Holiday',
    description: 'Personal time off',
    color_code: '#722ed1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Convert display items to IHolidayType using tempId as the id.
// These are ONLY used for the initial render — replaced by real DB data ASAP.
const PREDEFINED_HOLIDAY_TYPES: IHolidayType[] = PREDEFINED_HOLIDAY_DISPLAY.map(item => ({
  id: item.tempId,
  name: item.name,
  description: item.description,
  color_code: item.color_code,
  created_at: item.created_at,
  updated_at: item.updated_at,
}));

// Checks whether an id is one of our temporary placeholder ids.
// Used to prevent accidental submission of placeholder ids to the backend.
const isTempId = (id: string) => id.startsWith('__') && id.endsWith('__');

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

  // Starts with predefined display types so the dropdown is never empty on
  // first render. fetchHolidayTypes() will replace these with real DB rows
  // (containing proper UUIDs) as soon as the API responds.
  const [holidayTypes, setHolidayTypes] = useState<IHolidayType[]>(PREDEFINED_HOLIDAY_TYPES);
  const [typesLoaded, setTypesLoaded] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<IHolidayCalendarEvent | null>(null);
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [isPopulatingHolidays, setIsPopulatingHolidays] = useState(false);
  const [hasAttemptedPopulation, setHasAttemptedPopulation] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // ---------------------------------------------------------------------------
  // fetchHolidayTypes
  //
  // Strategy:
  //   1. Call GET /holidays/types — returns real DB rows with proper UUIDs.
  //   2. Build the final list as: [DB rows ordered by PREDEFINED order] +
  //      [any extra DB rows not in the predefined name list].
  //
  //   This means:
  //   • The order matches the predefined order (Federal Holiday always first).
  //   • Every item in the final list has a REAL UUID from the DB.
  //   • No placeholder ids ever reach the Save handler.
  //   • If the DB is missing a predefined type (e.g. Federal Holiday was never
  //     inserted), that slot simply does not appear — the user sees a console
  //     warning and the dropdown still works for all other types.
  // ---------------------------------------------------------------------------
  const fetchHolidayTypes = async () => {
    try {
      const res = await holidayApiService.getHolidayTypes();

      if (res.done && res.body && res.body.length > 0) {
        const backendTypes: IHolidayType[] = res.body;

        // Index backend types by lowercase name for O(1) lookup
        const backendByName = new Map<string, IHolidayType>(
          backendTypes.map(t => [t.name.toLowerCase(), t])
        );

        // Walk the predefined order; substitute each slot with its real DB row.
        // If the DB row is missing for a predefined type, log a warning and skip it.
        const orderedTypes: IHolidayType[] = [];
        for (const predefined of PREDEFINED_HOLIDAY_DISPLAY) {
          const dbRow = backendByName.get(predefined.name.toLowerCase());
          if (dbRow) {
            orderedTypes.push(dbRow); // real UUID ✓
          } else {
            // DB row missing — warn the developer but don't break the UI.
            // To fix: run the INSERT SQL shown at the top of this file.
            logger.error(
              `Holiday type "${predefined.name}" not found in DB. ` +
                `Run the INSERT SQL to add it. Skipping from dropdown.`
            );
          }
        }

        // Append any backend types that are NOT in the predefined list
        const predefinedNames = new Set(PREDEFINED_HOLIDAY_DISPLAY.map(p => p.name.toLowerCase()));
        const extraTypes = backendTypes.filter(t => !predefinedNames.has(t.name.toLowerCase()));

        const mergedTypes: IHolidayType[] = [...orderedTypes, ...extraTypes];
        setHolidayTypes(mergedTypes);
        setTypesLoaded(true);
      } else {
        // API returned empty or failed — keep predefined placeholder types so
        // the dropdown is not blank, but warn the developer.
        logger.error(
          'getHolidayTypes returned empty. ' +
            'Holiday type dropdowns will use placeholder ids that cannot be saved. ' +
            'Ensure holiday_types table is seeded.'
        );
      }
    } catch (error) {
      logger.error('Error fetching holiday types — keeping predefined placeholders', error);
      // Do not call setHolidayTypes — initial state (predefined placeholders)
      // remains, which at least renders the dropdown visually.
    }
  };

  const populateHolidaysIfNeeded = async () => {
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
    if (forceRefresh) dispatch(clearHolidaysCache());
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

  useEffect(() => {
    populateHolidaysIfNeeded();
  }, [holidaySettings]);

  useEffect(() => {
    setHasAttemptedPopulation(false);
  }, [holidaySettings?.country_code]);

  const customHolidays = useMemo(() => holidays.filter(h => h.source === 'custom'), [holidays]);

  const handleCreateHoliday = async (values: any) => {
    // Guard: prevent saving if the selected type id is still a placeholder.
    if (isTempId(values.holiday_type_id)) {
      message.error(
        'Holiday types are still loading or not seeded in the database. ' +
          'Please wait a moment and try again, or contact your administrator.'
      );
      return;
    }

    // Guard: prevent duplicate date — check before even hitting the backend.
    const selectedDate = values.date.format('YYYY-MM-DD');
    const dateAlreadyTaken = holidays.some(h => h.date === selectedDate);
    if (dateAlreadyTaken) {
      message.error(
        'A holiday already exists on this date. ' +
          'Please choose a different date or delete the existing holiday first.'
      );
      return;
    }

    try {
      const holidayData: ICreateHolidayRequest = {
        name: values.name,
        description: values.description,
        date: selectedDate,
        holiday_type_id: values.holiday_type_id, // guaranteed real UUID here
        is_recurring: values.is_recurring || false,
      };

      const res = await holidayApiService.createOrganizationHoliday(holidayData);
      if (res.done) {
        message.success(t('holidayCreated'));
        setModalVisible(false);
        form.resetFields();
        fetchHolidaysForDateRange(true);
      }
    } catch (error: any) {
      // Fallback: catch duplicate date violation from the backend in case
      // the frontend check was bypassed (e.g. race condition).
      if (
        error?.response?.data?.code === '23505' ||
        error?.message?.includes('organization_holidays_organization_date_unique')
      ) {
        message.error(
          'A holiday already exists on this date. ' +
            'Please choose a different date or delete the existing holiday first.'
        );
      } else {
        message.error(t('errorCreatingHoliday'));
      }
      logger.error('Error creating holiday', error);
    }
  };

  const handleUpdateHoliday = async (values: any) => {
    if (!selectedHoliday) return;

    if (isTempId(values.holiday_type_id)) {
      message.error('Holiday types are still loading. Please wait a moment and try again.');
      return;
    }

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
        setEditModalVisible(false);
        editForm.resetFields();
        setSelectedHoliday(null);
        fetchHolidaysForDateRange(true);
      }
    } catch (error) {
      logger.error('Error deleting holiday', error);
      message.error(t('errorDeletingHoliday'));
    }
  };

  const handleEditHoliday = (holiday: IHolidayCalendarEvent) => {
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
    setTimeout(() => setIsNavigating(false), 100);
  };

  const onDateSelect = (date: Dayjs) => {
    if (isNavigating) return;
    if (!date.isSame(currentDate, 'month')) return;

    const existingCustomHoliday = holidays.find(
      h => dayjs(h.date).isSame(date, 'day') && h.source === 'custom' && h.is_editable
    );

    if (existingCustomHoliday) {
      handleEditHoliday(existingCustomHoliday);
    } else {
      form.setFieldValue('date', date);
      setModalVisible(true);
    }
  };

  // Shared dropdown options used in both Create and Edit modals.
  // Each Option value is always a real DB UUID (or a temp placeholder if the
  // API has not yet responded — the isTempId guard in handleCreate/Update
  // prevents those from ever reaching the backend).
  const holidayTypeOptions = holidayTypes.map(type => (
    <Option key={type.id} value={type.id}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: type.color_code,
            marginRight: 8,
            flexShrink: 0,
          }}
        />
        {type.name}
        {isTempId(type.id) && (
          <span style={{ marginLeft: 6, fontSize: 10, color: '#faad14' }}>(loading…)</span>
        )}
      </div>
    </Option>
  ));

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

      {/* ── Create Holiday Modal ── */}
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
            <Input placeholder="e.g., Independence Day" />
          </Form.Item>

          <Form.Item name="description" label={t('description')}>
            <TextArea rows={3} placeholder="Optional description" />
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
            <Select placeholder="Select holiday type" showSearch optionFilterProp="children">
              {holidayTypeOptions}
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

      {/* ── Edit Holiday Modal ── */}
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
            <Select showSearch optionFilterProp="children">
              {holidayTypeOptions}
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
