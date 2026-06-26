export interface IHolidayType {
  id: string;
  name: string;
  description?: string;
  color_code: string;
  created_at: string;
  updated_at: string;
}

export interface IOrganizationHoliday {
  id: string;
  organization_id: string;
  holiday_type_id: string;
  name: string;
  description?: string;
  date: string;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
  holiday_type_name?: string;
  color_code?: string;
}

export interface ICountryHoliday {
  id: string;
  country_code: string;
  name: string;
  description?: string;
  date: string;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export interface IAvailableCountry {
  code: string;
  name: string;
}

export interface ICreateHolidayRequest {
  name: string;
  description?: string;
  date: string;
  holiday_type_id: string;
  is_recurring?: boolean;
}

export interface IUpdateHolidayRequest {
  id: string;
  name?: string;
  description?: string;
  date?: string;
  holiday_type_id?: string;
  is_recurring?: boolean;
}

export interface IImportCountryHolidaysRequest {
  country_code: string;
  year?: number;
}

export interface IOrganizationHolidaySettings {
  country_code?: string;
  state_code?: string;
  auto_sync_holidays?: boolean;
}

export interface ICountryState {
  code: string;
  name: string;
}

export interface ICountryWithStates {
  code: string;
  name: string;
  states?: ICountryState[];
}

export interface IHolidayDateRange {
  from_date: string;
  to_date: string;
}

export interface ICombinedHolidaysRequest extends IHolidayDateRange {
  include_custom?: boolean;
}

export interface IHolidayCalendarEvent {
  id: string;
  name: string;
  description?: string;
  date: string;
  is_recurring: boolean;
  holiday_type_id?: string;
  holiday_type_name: string;
  color_code: string;
  source: 'official' | 'custom';
  is_editable: boolean;
}
