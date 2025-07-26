import { API_BASE_URL } from '@/shared/constants';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';
import {
  IHolidayType,
  IOrganizationHoliday,
  ICountryHoliday,
  IAvailableCountry,
  ICreateHolidayRequest,
  IUpdateHolidayRequest,
  IImportCountryHolidaysRequest,
  IHolidayCalendarEvent,
} from '@/types/holiday/holiday.types';

const rootUrl = `${API_BASE_URL}/holidays`;

export const holidayApiService = {
  // Holiday types
  getHolidayTypes: async (): Promise<IServerResponse<IHolidayType[]>> => {
    const response = await apiClient.get<IServerResponse<IHolidayType[]>>(`${rootUrl}/types`);
    return response.data;
  },

  // Organization holidays
  getOrganizationHolidays: async (year?: number): Promise<IServerResponse<IOrganizationHoliday[]>> => {
    const params = year ? `?year=${year}` : '';
    const response = await apiClient.get<IServerResponse<IOrganizationHoliday[]>>(`${rootUrl}/organization${params}`);
    return response.data;
  },

  createOrganizationHoliday: async (data: ICreateHolidayRequest): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/organization`, data);
    return response.data;
  },

  updateOrganizationHoliday: async (id: string, data: IUpdateHolidayRequest): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/organization/${id}`, data);
    return response.data;
  },

  deleteOrganizationHoliday: async (id: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.delete<IServerResponse<any>>(`${rootUrl}/organization/${id}`);
    return response.data;
  },

  // Country holidays
  getAvailableCountries: async (): Promise<IServerResponse<IAvailableCountry[]>> => {
    const response = await apiClient.get<IServerResponse<IAvailableCountry[]>>(`${rootUrl}/countries`);
    return response.data;
  },

  getCountryHolidays: async (countryCode: string, year?: number): Promise<IServerResponse<ICountryHoliday[]>> => {
    const params = year ? `?year=${year}` : '';
    const response = await apiClient.get<IServerResponse<ICountryHoliday[]>>(`${rootUrl}/countries/${countryCode}${params}`);
    return response.data;
  },

  importCountryHolidays: async (data: IImportCountryHolidaysRequest): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/import`, data);
    return response.data;
  },

  // Calendar view
  getHolidayCalendar: async (year: number, month: number): Promise<IServerResponse<IHolidayCalendarEvent[]>> => {
    const response = await apiClient.get<IServerResponse<IHolidayCalendarEvent[]>>(`${rootUrl}/calendar?year=${year}&month=${month}`);
    return response.data;
  },

  // Populate holidays
  populateCountryHolidays: async (): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/populate`);
    return response.data;
  },
}; 