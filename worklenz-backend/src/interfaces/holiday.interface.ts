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
  holiday_type?: IHolidayType;
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