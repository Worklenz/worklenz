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
  IOrganizationHolidaySettings,
  ICountryWithStates,
  ICombinedHolidaysRequest,
  IHolidayDateRange,
} from '@/types/holiday/holiday.types';
import logger from '@/utils/errorLogger';
import { error } from 'console';

const rootUrl = `${API_BASE_URL}/holidays`;

export const holidayApiService = {
  // Holiday types
  getHolidayTypes: async (): Promise<IServerResponse<IHolidayType[]>> => {
    const response = await apiClient.get<IServerResponse<IHolidayType[]>>(
      `${rootUrl}/types`
    );
    return response.data;
  },

  // Organization holidays
  getOrganizationHolidays: async (
    year?: number
  ): Promise<IServerResponse<IOrganizationHoliday[]>> => {
    const params = year ? { year } : {};
    const response = await apiClient.get<IServerResponse<IOrganizationHoliday[]>>(
      `${rootUrl}/organization`,
      { params }
    );
    return response.data;
  },

  // Holiday CRUD operations
  createOrganizationHoliday: async (data: ICreateHolidayRequest): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(
      `${rootUrl}/organization`,
      data
    );
    return response.data;
  },

  updateOrganizationHoliday: async (
    id: string,
    data: IUpdateHolidayRequest
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(
      `${rootUrl}/organization/${id}`,
      data
    );
    return response.data;
  },

  deleteOrganizationHoliday: async (id: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.delete<IServerResponse<any>>(
      `${rootUrl}/organization/${id}`
    );
    return response.data;
  },

  // Country holidays - PLACEHOLDER with all date-holidays supported countries  
  getAvailableCountries: async (): Promise<IServerResponse<IAvailableCountry[]>> => {
    // Return all countries supported by date-holidays library (simplified list without states)
    const availableCountries = [
      { code: 'AD', name: 'Andorra' },
      { code: 'AE', name: 'United Arab Emirates' },
      { code: 'AG', name: 'Antigua & Barbuda' },
      { code: 'AI', name: 'Anguilla' },
      { code: 'AL', name: 'Albania' },
      { code: 'AM', name: 'Armenia' },
      { code: 'AO', name: 'Angola' },
      { code: 'AR', name: 'Argentina' },
      { code: 'AT', name: 'Austria' },
      { code: 'AU', name: 'Australia' },
      { code: 'AW', name: 'Aruba' },
      { code: 'AZ', name: 'Azerbaijan' },
      { code: 'BA', name: 'Bosnia and Herzegovina' },
      { code: 'BB', name: 'Barbados' },
      { code: 'BD', name: 'Bangladesh' },
      { code: 'BE', name: 'Belgium' },
      { code: 'BF', name: 'Burkina Faso' },
      { code: 'BG', name: 'Bulgaria' },
      { code: 'BH', name: 'Bahrain' },
      { code: 'BI', name: 'Burundi' },
      { code: 'BJ', name: 'Benin' },
      { code: 'BM', name: 'Bermuda' },
      { code: 'BN', name: 'Brunei' },
      { code: 'BO', name: 'Bolivia' },
      { code: 'BR', name: 'Brazil' },
      { code: 'BS', name: 'Bahamas' },
      { code: 'BW', name: 'Botswana' },
      { code: 'BY', name: 'Belarus' },
      { code: 'BZ', name: 'Belize' },
      { code: 'CA', name: 'Canada' },
      { code: 'CH', name: 'Switzerland' },
      { code: 'CK', name: 'Cook Islands' },
      { code: 'CL', name: 'Chile' },
      { code: 'CM', name: 'Cameroon' },
      { code: 'CN', name: 'China' },
      { code: 'CO', name: 'Colombia' },
      { code: 'CR', name: 'Costa Rica' },
      { code: 'CU', name: 'Cuba' },
      { code: 'CY', name: 'Cyprus' },
      { code: 'CZ', name: 'Czech Republic' },
      { code: 'DE', name: 'Germany' },
      { code: 'DK', name: 'Denmark' },
      { code: 'DO', name: 'Dominican Republic' },
      { code: 'EC', name: 'Ecuador' },
      { code: 'EE', name: 'Estonia' },
      { code: 'ES', name: 'Spain' },
      { code: 'ET', name: 'Ethiopia' },
      { code: 'FI', name: 'Finland' },
      { code: 'FR', name: 'France' },
      { code: 'GB', name: 'United Kingdom' },
      { code: 'GE', name: 'Georgia' },
      { code: 'GR', name: 'Greece' },
      { code: 'GT', name: 'Guatemala' },
      { code: 'HK', name: 'Hong Kong' },
      { code: 'HN', name: 'Honduras' },
      { code: 'HR', name: 'Croatia' },
      { code: 'HU', name: 'Hungary' },
      { code: 'ID', name: 'Indonesia' },
      { code: 'IE', name: 'Ireland' },
      { code: 'IL', name: 'Israel' },
      { code: 'IN', name: 'India' },
      { code: 'IR', name: 'Iran' },
      { code: 'IS', name: 'Iceland' },
      { code: 'IT', name: 'Italy' },
      { code: 'JM', name: 'Jamaica' },
      { code: 'JP', name: 'Japan' },
      { code: 'KE', name: 'Kenya' },
      { code: 'KR', name: 'South Korea' },
      { code: 'LI', name: 'Liechtenstein' },
      { code: 'LT', name: 'Lithuania' },
      { code: 'LU', name: 'Luxembourg' },
      { code: 'LV', name: 'Latvia' },
      { code: 'MA', name: 'Morocco' },
      { code: 'MC', name: 'Monaco' },
      { code: 'MD', name: 'Moldova' },
      { code: 'MK', name: 'North Macedonia' },
      { code: 'MT', name: 'Malta' },
      { code: 'MX', name: 'Mexico' },
      { code: 'MY', name: 'Malaysia' },
      { code: 'NI', name: 'Nicaragua' },
      { code: 'NL', name: 'Netherlands' },
      { code: 'NO', name: 'Norway' },
      { code: 'NZ', name: 'New Zealand' },
      { code: 'PA', name: 'Panama' },
      { code: 'PE', name: 'Peru' },
      { code: 'PH', name: 'Philippines' },
      { code: 'PL', name: 'Poland' },
      { code: 'PR', name: 'Puerto Rico' },
      { code: 'PT', name: 'Portugal' },
      { code: 'RO', name: 'Romania' },
      { code: 'RS', name: 'Serbia' },
      { code: 'RU', name: 'Russia' },
      { code: 'SA', name: 'Saudi Arabia' },
      { code: 'SE', name: 'Sweden' },
      { code: 'SG', name: 'Singapore' },
      { code: 'SI', name: 'Slovenia' },
      { code: 'SK', name: 'Slovakia' },
      { code: 'LK', name: 'Sri Lanka' },
      { code: 'TH', name: 'Thailand' },
      { code: 'TR', name: 'Turkey' },
      { code: 'UA', name: 'Ukraine' },
      { code: 'US', name: 'United States' },
      { code: 'UY', name: 'Uruguay' },
      { code: 'VE', name: 'Venezuela' },
      { code: 'VN', name: 'Vietnam' },
      { code: 'ZA', name: 'South Africa' }
    ];
    
    return {
      done: true,
      body: availableCountries,
    } as IServerResponse<IAvailableCountry[]>;
  },

  getCountryHolidays: async (
    countryCode: string,
    year?: number
  ): Promise<IServerResponse<ICountryHoliday[]>> => {
    const params: any = { country_code: countryCode };
    if (year) {
      params.year = year;
    }
    const response = await apiClient.get<IServerResponse<ICountryHoliday[]>>(
      `${rootUrl}/countries/${countryCode}`,
      { params }
    );
    return response.data;
  },

  importCountryHolidays: async (
    data: IImportCountryHolidaysRequest
  ): Promise<IServerResponse<any>> => {
    // Return success for now
    return {
      done: true,
      body: {},
    } as IServerResponse<any>;
  },

  // Calendar view - PLACEHOLDER until backend implements
  getHolidayCalendar: async (
    year: number,
    month: number
  ): Promise<IServerResponse<IHolidayCalendarEvent[]>> => {
    // Return empty array for now
    return {
      done: true,
      body: [],
    } as IServerResponse<IHolidayCalendarEvent[]>;
  },

  // Organization holiday settings
  getOrganizationHolidaySettings: async (): Promise<
    IServerResponse<IOrganizationHolidaySettings>
  > => {
    const response = await apiClient.get<IServerResponse<IOrganizationHolidaySettings>>(
      `${API_BASE_URL}/admin-center/organization/holiday-settings`
    );
    return response.data;
  },

  updateOrganizationHolidaySettings: async (
    data: IOrganizationHolidaySettings
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(
      `${API_BASE_URL}/admin-center/organization/holiday-settings`,
      data
    );
    return response.data;
  },

  // Countries with states
  getCountriesWithStates: async (): Promise<IServerResponse<ICountryWithStates[]>> => {
    try {
      const response = await apiClient.get<IServerResponse<ICountryWithStates[]>>(
        `${API_BASE_URL}/admin-center/countries-with-states`
      );
      return response.data;
    } catch (error) {
      logger.error('Error fetching countries with states from API, falling back to static data', error);
      // Fallback to static data if API fails
      const supportedCountries = [
      { code: 'AD', name: 'Andorra' },
      { code: 'AE', name: 'United Arab Emirates' },
      { code: 'AG', name: 'Antigua & Barbuda' },
      { code: 'AI', name: 'Anguilla' },
      { code: 'AL', name: 'Albania' },
      { code: 'AM', name: 'Armenia' },
      { code: 'AO', name: 'Angola' },
      { code: 'AR', name: 'Argentina' },
      { 
        code: 'AT', 
        name: 'Austria',
        states: [
          { code: '1', name: 'Burgenland' },
          { code: '2', name: 'Kärnten' },
          { code: '3', name: 'Niederösterreich' },
          { code: '4', name: 'Oberösterreich' },
          { code: '5', name: 'Salzburg' },
          { code: '6', name: 'Steiermark' },
          { code: '7', name: 'Tirol' },
          { code: '8', name: 'Vorarlberg' },
          { code: '9', name: 'Wien' }
        ]
      },
      { 
        code: 'AU', 
        name: 'Australia',
        states: [
          { code: 'act', name: 'Australian Capital Territory' },
          { code: 'nsw', name: 'New South Wales' },
          { code: 'nt', name: 'Northern Territory' },
          { code: 'qld', name: 'Queensland' },
          { code: 'sa', name: 'South Australia' },
          { code: 'tas', name: 'Tasmania' },
          { code: 'vic', name: 'Victoria' },
          { code: 'wa', name: 'Western Australia' }
        ]
      },
      { code: 'AW', name: 'Aruba' },
      { code: 'AZ', name: 'Azerbaijan' },
      { code: 'BA', name: 'Bosnia and Herzegovina' },
      { code: 'BB', name: 'Barbados' },
      { code: 'BD', name: 'Bangladesh' },
      { code: 'BE', name: 'Belgium' },
      { code: 'BF', name: 'Burkina Faso' },
      { code: 'BG', name: 'Bulgaria' },
      { code: 'BH', name: 'Bahrain' },
      { code: 'BI', name: 'Burundi' },
      { code: 'BJ', name: 'Benin' },
      { code: 'BM', name: 'Bermuda' },
      { code: 'BN', name: 'Brunei' },
      { code: 'BO', name: 'Bolivia' },
      { 
        code: 'BR', 
        name: 'Brazil',
        states: [
          { code: 'ac', name: 'Acre' },
          { code: 'al', name: 'Alagoas' },
          { code: 'ap', name: 'Amapá' },
          { code: 'am', name: 'Amazonas' },
          { code: 'ba', name: 'Bahia' },
          { code: 'ce', name: 'Ceará' },
          { code: 'df', name: 'Distrito Federal' },
          { code: 'es', name: 'Espírito Santo' },
          { code: 'go', name: 'Goiás' },
          { code: 'ma', name: 'Maranhão' },
          { code: 'mt', name: 'Mato Grosso' },
          { code: 'ms', name: 'Mato Grosso do Sul' },
          { code: 'mg', name: 'Minas Gerais' },
          { code: 'pa', name: 'Pará' },
          { code: 'pb', name: 'Paraíba' },
          { code: 'pr', name: 'Paraná' },
          { code: 'pe', name: 'Pernambuco' },
          { code: 'pi', name: 'Piauí' },
          { code: 'rj', name: 'Rio de Janeiro' },
          { code: 'rn', name: 'Rio Grande do Norte' },
          { code: 'rs', name: 'Rio Grande do Sul' },
          { code: 'ro', name: 'Rondônia' },
          { code: 'rr', name: 'Roraima' },
          { code: 'sc', name: 'Santa Catarina' },
          { code: 'sp', name: 'São Paulo' },
          { code: 'se', name: 'Sergipe' },
          { code: 'to', name: 'Tocantins' }
        ]
      },
      { code: 'BS', name: 'Bahamas' },
      { code: 'BW', name: 'Botswana' },
      { code: 'BY', name: 'Belarus' },
      { code: 'BZ', name: 'Belize' },
      { 
        code: 'CA', 
        name: 'Canada',
        states: [
          { code: 'ab', name: 'Alberta' },
          { code: 'bc', name: 'British Columbia' },
          { code: 'mb', name: 'Manitoba' },
          { code: 'nb', name: 'New Brunswick' },
          { code: 'nl', name: 'Newfoundland and Labrador' },
          { code: 'ns', name: 'Nova Scotia' },
          { code: 'nt', name: 'Northwest Territories' },
          { code: 'nu', name: 'Nunavut' },
          { code: 'on', name: 'Ontario' },
          { code: 'pe', name: 'Prince Edward Island' },
          { code: 'qc', name: 'Quebec' },
          { code: 'sk', name: 'Saskatchewan' },
          { code: 'yt', name: 'Yukon' }
        ]
      },
      { 
        code: 'CH', 
        name: 'Switzerland',
        states: [
          { code: 'ag', name: 'Aargau' },
          { code: 'ai', name: 'Appenzell Innerrhoden' },
          { code: 'ar', name: 'Appenzell Ausserrhoden' },
          { code: 'be', name: 'Bern' },
          { code: 'bl', name: 'Basel-Landschaft' },
          { code: 'bs', name: 'Basel-Stadt' },
          { code: 'fr', name: 'Fribourg' },
          { code: 'ge', name: 'Geneva' },
          { code: 'gl', name: 'Glarus' },
          { code: 'gr', name: 'Graubünden' },
          { code: 'ju', name: 'Jura' },
          { code: 'lu', name: 'Lucerne' },
          { code: 'ne', name: 'Neuchâtel' },
          { code: 'nw', name: 'Nidwalden' },
          { code: 'ow', name: 'Obwalden' },
          { code: 'sg', name: 'St. Gallen' },
          { code: 'sh', name: 'Schaffhausen' },
          { code: 'so', name: 'Solothurn' },
          { code: 'sz', name: 'Schwyz' },
          { code: 'tg', name: 'Thurgau' },
          { code: 'ti', name: 'Ticino' },
          { code: 'ur', name: 'Uri' },
          { code: 'vd', name: 'Vaud' },
          { code: 'vs', name: 'Valais' },
          { code: 'zg', name: 'Zug' },
          { code: 'zh', name: 'Zurich' }
        ]
      },
      { code: 'CK', name: 'Cook Islands' },
      { code: 'CL', name: 'Chile' },
      { code: 'CM', name: 'Cameroon' },
      { code: 'CN', name: 'China' },
      { code: 'CO', name: 'Colombia' },
      { code: 'CR', name: 'Costa Rica' },
      { code: 'CU', name: 'Cuba' },
      { code: 'CY', name: 'Cyprus' },
      { code: 'CZ', name: 'Czech Republic' },
      { 
        code: 'DE', 
        name: 'Germany',
        states: [
          { code: 'bw', name: 'Baden-Württemberg' },
          { code: 'by', name: 'Bayern' },
          { code: 'be', name: 'Berlin' },
          { code: 'bb', name: 'Brandenburg' },
          { code: 'hb', name: 'Bremen' },
          { code: 'hh', name: 'Hamburg' },
          { code: 'he', name: 'Hessen' },
          { code: 'mv', name: 'Mecklenburg-Vorpommern' },
          { code: 'ni', name: 'Niedersachsen' },
          { code: 'nw', name: 'Nordrhein-Westfalen' },
          { code: 'rp', name: 'Rheinland-Pfalz' },
          { code: 'sl', name: 'Saarland' },
          { code: 'sn', name: 'Sachsen' },
          { code: 'st', name: 'Sachsen-Anhalt' },
          { code: 'sh', name: 'Schleswig-Holstein' },
          { code: 'th', name: 'Thüringen' }
        ]
      },
      { code: 'DK', name: 'Denmark' },
      { code: 'DO', name: 'Dominican Republic' },
      { code: 'EC', name: 'Ecuador' },
      { code: 'EE', name: 'Estonia' },
      { code: 'ES', name: 'Spain' },
      { code: 'ET', name: 'Ethiopia' },
      { code: 'FI', name: 'Finland' },
      { code: 'FR', name: 'France' },
      { 
        code: 'GB', 
        name: 'United Kingdom',
        states: [
          { code: 'eng', name: 'England' },
          { code: 'nir', name: 'Northern Ireland' },
          { code: 'sct', name: 'Scotland' },
          { code: 'wls', name: 'Wales' }
        ]
      },
      { code: 'GE', name: 'Georgia' },
      { code: 'GR', name: 'Greece' },
      { code: 'GT', name: 'Guatemala' },
      { code: 'HK', name: 'Hong Kong' },
      { code: 'HN', name: 'Honduras' },
      { code: 'HR', name: 'Croatia' },
      { code: 'HU', name: 'Hungary' },
      { code: 'ID', name: 'Indonesia' },
      { code: 'IE', name: 'Ireland' },
      { code: 'IL', name: 'Israel' },
      { 
        code: 'IN', 
        name: 'India',
        states: [
          { code: 'an', name: 'Andaman and Nicobar Islands' },
          { code: 'ap', name: 'Andhra Pradesh' },
          { code: 'ar', name: 'Arunachal Pradesh' },
          { code: 'as', name: 'Assam' },
          { code: 'br', name: 'Bihar' },
          { code: 'ch', name: 'Chandigarh' },
          { code: 'ct', name: 'Chhattisgarh' },
          { code: 'dd', name: 'Daman and Diu' },
          { code: 'dl', name: 'Delhi' },
          { code: 'ga', name: 'Goa' },
          { code: 'gj', name: 'Gujarat' },
          { code: 'hr', name: 'Haryana' },
          { code: 'hp', name: 'Himachal Pradesh' },
          { code: 'jk', name: 'Jammu and Kashmir' },
          { code: 'jh', name: 'Jharkhand' },
          { code: 'ka', name: 'Karnataka' },
          { code: 'kl', name: 'Kerala' },
          { code: 'ld', name: 'Lakshadweep' },
          { code: 'mp', name: 'Madhya Pradesh' },
          { code: 'mh', name: 'Maharashtra' },
          { code: 'mn', name: 'Manipur' },
          { code: 'ml', name: 'Meghalaya' },
          { code: 'mz', name: 'Mizoram' },
          { code: 'nl', name: 'Nagaland' },
          { code: 'or', name: 'Odisha' },
          { code: 'py', name: 'Puducherry' },
          { code: 'pb', name: 'Punjab' },
          { code: 'rj', name: 'Rajasthan' },
          { code: 'sk', name: 'Sikkim' },
          { code: 'tn', name: 'Tamil Nadu' },
          { code: 'tg', name: 'Telangana' },
          { code: 'tr', name: 'Tripura' },
          { code: 'up', name: 'Uttar Pradesh' },
          { code: 'ut', name: 'Uttarakhand' },
          { code: 'wb', name: 'West Bengal' }
        ]
      },
      { code: 'IR', name: 'Iran' },
      { code: 'IS', name: 'Iceland' },
      { 
        code: 'IT', 
        name: 'Italy',
        states: [
          { code: '65', name: 'Abruzzo' },
          { code: '77', name: 'Basilicata' },
          { code: '78', name: 'Calabria' },
          { code: '72', name: 'Campania' },
          { code: '45', name: 'Emilia-Romagna' },
          { code: '36', name: 'Friuli-Venezia Giulia' },
          { code: '62', name: 'Lazio' },
          { code: '42', name: 'Liguria' },
          { code: '25', name: 'Lombardia' },
          { code: '57', name: 'Marche' },
          { code: '67', name: 'Molise' },
          { code: '21', name: 'Piemonte' },
          { code: '75', name: 'Puglia' },
          { code: '88', name: 'Sardegna' },
          { code: '82', name: 'Sicilia' },
          { code: '52', name: 'Toscana' },
          { code: '32', name: 'Trentino-Alto Adige' },
          { code: '55', name: 'Umbria' },
          { code: '23', name: "Valle d'Aosta" },
          { code: '34', name: 'Veneto' }
        ]
      },
      { code: 'JM', name: 'Jamaica' },
      { code: 'JP', name: 'Japan' },
      { code: 'KE', name: 'Kenya' },
      { code: 'KR', name: 'South Korea' },
      { code: 'LI', name: 'Liechtenstein' },
      { code: 'LT', name: 'Lithuania' },
      { code: 'LU', name: 'Luxembourg' },
      { code: 'LV', name: 'Latvia' },
      { code: 'MA', name: 'Morocco' },
      { code: 'MC', name: 'Monaco' },
      { code: 'MD', name: 'Moldova' },
      { code: 'MK', name: 'North Macedonia' },
      { code: 'MT', name: 'Malta' },
      { 
        code: 'MX', 
        name: 'Mexico',
        states: [
          { code: 'ag', name: 'Aguascalientes' },
          { code: 'bc', name: 'Baja California' },
          { code: 'bs', name: 'Baja California Sur' },
          { code: 'cm', name: 'Campeche' },
          { code: 'cs', name: 'Chiapas' },
          { code: 'ch', name: 'Chihuahua' },
          { code: 'co', name: 'Coahuila' },
          { code: 'cl', name: 'Colima' },
          { code: 'df', name: 'Mexico City' },
          { code: 'dg', name: 'Durango' },
          { code: 'gt', name: 'Guanajuato' },
          { code: 'gr', name: 'Guerrero' },
          { code: 'hg', name: 'Hidalgo' },
          { code: 'jc', name: 'Jalisco' },
          { code: 'mc', name: 'State of Mexico' },
          { code: 'mn', name: 'Michoacán' },
          { code: 'ms', name: 'Morelos' },
          { code: 'nt', name: 'Nayarit' },
          { code: 'nl', name: 'Nuevo León' },
          { code: 'oa', name: 'Oaxaca' },
          { code: 'pu', name: 'Puebla' },
          { code: 'qe', name: 'Querétaro' },
          { code: 'qr', name: 'Quintana Roo' },
          { code: 'sl', name: 'San Luis Potosí' },
          { code: 'si', name: 'Sinaloa' },
          { code: 'so', name: 'Sonora' },
          { code: 'tb', name: 'Tabasco' },
          { code: 'tm', name: 'Tamaulipas' },
          { code: 'tl', name: 'Tlaxcala' },
          { code: 've', name: 'Veracruz' },
          { code: 'yu', name: 'Yucatán' },
          { code: 'za', name: 'Zacatecas' }
        ]
      },
      { code: 'MY', name: 'Malaysia' },
      { code: 'NI', name: 'Nicaragua' },
      { 
        code: 'NL', 
        name: 'Netherlands',
        states: [
          { code: 'dr', name: 'Drenthe' },
          { code: 'fl', name: 'Flevoland' },
          { code: 'fr', name: 'Friesland' },
          { code: 'gd', name: 'Gelderland' },
          { code: 'gr', name: 'Groningen' },
          { code: 'lb', name: 'Limburg' },
          { code: 'nb', name: 'North Brabant' },
          { code: 'nh', name: 'North Holland' },
          { code: 'ov', name: 'Overijssel' },
          { code: 'ut', name: 'Utrecht' },
          { code: 'ze', name: 'Zeeland' },
          { code: 'zh', name: 'South Holland' }
        ]
      },
      { code: 'NO', name: 'Norway' },
      { code: 'NZ', name: 'New Zealand' },
      { code: 'PA', name: 'Panama' },
      { code: 'PE', name: 'Peru' },
      { code: 'PH', name: 'Philippines' },
      { code: 'PL', name: 'Poland' },
      { code: 'PR', name: 'Puerto Rico' },
      { code: 'PT', name: 'Portugal' },
      { code: 'RO', name: 'Romania' },
      { code: 'RS', name: 'Serbia' },
      { code: 'RU', name: 'Russia' },
      { code: 'SA', name: 'Saudi Arabia' },
      { code: 'SE', name: 'Sweden' },
      { code: 'SG', name: 'Singapore' },
      { code: 'SI', name: 'Slovenia' },
      { code: 'SK', name: 'Slovakia' },
      { 
        code: 'LK', 
        name: 'Sri Lanka',
        states: [
          { code: 'central', name: 'Central Province' },
          { code: 'eastern', name: 'Eastern Province' },
          { code: 'north-central', name: 'North Central Province' },
          { code: 'northern', name: 'Northern Province' },
          { code: 'north-western', name: 'North Western Province' },
          { code: 'sabaragamuwa', name: 'Sabaragamuwa Province' },
          { code: 'southern', name: 'Southern Province' },
          { code: 'uva', name: 'Uva Province' },
          { code: 'western', name: 'Western Province' }
        ]
      },
      { code: 'TH', name: 'Thailand' },
      { code: 'TR', name: 'Turkey' },
      { code: 'UA', name: 'Ukraine' },
      { 
        code: 'US', 
        name: 'United States',
        states: [
          { code: 'al', name: 'Alabama' },
          { code: 'ak', name: 'Alaska' },
          { code: 'az', name: 'Arizona' },
          { code: 'ar', name: 'Arkansas' },
          { code: 'ca', name: 'California' },
          { code: 'co', name: 'Colorado' },
          { code: 'ct', name: 'Connecticut' },
          { code: 'de', name: 'Delaware' },
          { code: 'dc', name: 'District of Columbia' },
          { code: 'fl', name: 'Florida' },
          { code: 'ga', name: 'Georgia' },
          { code: 'hi', name: 'Hawaii' },
          { code: 'id', name: 'Idaho' },
          { code: 'il', name: 'Illinois' },
          { code: 'in', name: 'Indiana' },
          { code: 'ia', name: 'Iowa' },
          { code: 'ks', name: 'Kansas' },
          { code: 'ky', name: 'Kentucky' },
          { code: 'la', name: 'Louisiana' },
          { code: 'me', name: 'Maine' },
          { code: 'md', name: 'Maryland' },
          { code: 'ma', name: 'Massachusetts' },
          { code: 'mi', name: 'Michigan' },
          { code: 'mn', name: 'Minnesota' },
          { code: 'ms', name: 'Mississippi' },
          { code: 'mo', name: 'Missouri' },
          { code: 'mt', name: 'Montana' },
          { code: 'ne', name: 'Nebraska' },
          { code: 'nv', name: 'Nevada' },
          { code: 'nh', name: 'New Hampshire' },
          { code: 'nj', name: 'New Jersey' },
          { code: 'nm', name: 'New Mexico' },
          { code: 'ny', name: 'New York' },
          { code: 'nc', name: 'North Carolina' },
          { code: 'nd', name: 'North Dakota' },
          { code: 'oh', name: 'Ohio' },
          { code: 'ok', name: 'Oklahoma' },
          { code: 'or', name: 'Oregon' },
          { code: 'pa', name: 'Pennsylvania' },
          { code: 'ri', name: 'Rhode Island' },
          { code: 'sc', name: 'South Carolina' },
          { code: 'sd', name: 'South Dakota' },
          { code: 'tn', name: 'Tennessee' },
          { code: 'tx', name: 'Texas' },
          { code: 'ut', name: 'Utah' },
          { code: 'vt', name: 'Vermont' },
          { code: 'va', name: 'Virginia' },
          { code: 'wa', name: 'Washington' },
          { code: 'wv', name: 'West Virginia' },
          { code: 'wi', name: 'Wisconsin' },
          { code: 'wy', name: 'Wyoming' }
        ]
      },
      { code: 'UY', name: 'Uruguay' },
      { code: 'VE', name: 'Venezuela' },
      { code: 'VN', name: 'Vietnam' },
      { code: 'ZA', name: 'South Africa' }
    ];

      return {
        done: true,
        body: supportedCountries,
      } as IServerResponse<ICountryWithStates[]>;
    }
  },

  // Combined holidays (official + custom) - Database-driven approach
  getCombinedHolidays: async (
    params: ICombinedHolidaysRequest & { country_code?: string }
  ): Promise<IServerResponse<IHolidayCalendarEvent[]>> => {
    try {
      console.log('🔍 getCombinedHolidays called with params:', params);
      const year = new Date(params.from_date).getFullYear();
      let allHolidays: IHolidayCalendarEvent[] = [];

      // Get official holidays - handle Sri Lanka specially, others from API
      if (params.country_code) {
        console.log(`🌐 Fetching official holidays for country: ${params.country_code}, year: ${year}`);
        
        // Handle Sri Lankan holidays from static data
        if (params.country_code === 'LK' && year === 2025) {
          try {
            console.log('🇱🇰 Loading Sri Lankan holidays from static data...');
            const { sriLankanHolidays2025 } = await import('@/data/sri-lanka-holidays-2025');
            
            const sriLankanHolidays = sriLankanHolidays2025
              .filter(h => h.date >= params.from_date && h.date <= params.to_date)
              .map(h => ({
                id: `lk-${h.date}-${h.name.replace(/\\s+/g, '-').toLowerCase()}`,
                name: h.name,
                description: h.description,
                date: h.date,
                is_recurring: h.is_recurring,
                holiday_type_name: h.type,
                color_code: h.color_code,
                source: 'official' as const,
                is_editable: false,
              }));
            
            console.log(`✅ Found ${sriLankanHolidays.length} Sri Lankan holidays`);
            allHolidays.push(...sriLankanHolidays);
          } catch (error) {
            console.error('❌ Error loading Sri Lankan holidays:', error);
          }
        } else {
          // Handle other countries from API
          try {
            const countryHolidaysRes = await holidayApiService.getCountryHolidays(params.country_code, year);
            console.log('📅 Country holidays response:', countryHolidaysRes);
            
            if (countryHolidaysRes.done && countryHolidaysRes.body) {
              const officialHolidays = countryHolidaysRes.body
                .filter((h: any) => h.date >= params.from_date && h.date <= params.to_date)
                .map((h: any) => ({
                  id: `${params.country_code}-${h.id}`,
                  name: h.name,
                  description: h.description,
                  date: h.date,
                  is_recurring: h.is_recurring,
                  holiday_type_name: 'Official Holiday',
                  color_code: h.color_code || '#1890ff',
                  source: 'official' as const,
                  is_editable: false,
                }));
              
              console.log(`✅ Found ${officialHolidays.length} official holidays from API`);
              allHolidays.push(...officialHolidays);
            } else {
              console.log('⚠️ No official holidays returned from API');
            }
          } catch (error) {
            console.error('❌ Error fetching official holidays from API:', error);
          }
        }
      } else {
        console.log('⚠️ No country code provided, skipping official holidays');
      }

      // Get organization holidays from database (includes both custom and country-specific)
      const customRes = await holidayApiService.getOrganizationHolidays(year);
      
      if (customRes.done && customRes.body) {
        const customHolidays = customRes.body
          .filter((h: any) => h.date >= params.from_date && h.date <= params.to_date)
          .map((h: any) => ({
            id: h.id,
            name: h.name,
            description: h.description,
            date: h.date,
            is_recurring: h.is_recurring,
            holiday_type_id: h.holiday_type_id,
            holiday_type_name: h.holiday_type_name || 'Custom',
            color_code: h.color_code || '#f37070',
            source: h.source || 'custom' as const,
            is_editable: h.is_editable !== false, // Default to true unless explicitly false
          }));

        // Filter out duplicates (in case official holidays are already in DB)
        const existingDates = new Set(allHolidays.map(h => h.date));
        const uniqueCustomHolidays = customHolidays.filter((h: any) => !existingDates.has(h.date));
        
        allHolidays.push(...uniqueCustomHolidays);
      }
      return {
        done: true,
        body: allHolidays,
      } as IServerResponse<IHolidayCalendarEvent[]>;
    } catch (error) {
      logger.error('Error fetching combined holidays:', error);
      return {
        done: false,
        body: [],
      } as IServerResponse<IHolidayCalendarEvent[]>;
    }
  },

  // Working days calculation - PLACEHOLDER until backend implements
  getWorkingDaysCount: async (
    params: IHolidayDateRange
  ): Promise<
    IServerResponse<{ working_days: number; total_days: number; holidays_count: number }>
  > => {
    // Simple calculation without holidays for now
    const start = new Date(params.from_date);
    const end = new Date(params.to_date);
    let workingDays = 0;
    let totalDays = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      totalDays++;
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        // Not Sunday or Saturday
        workingDays++;
      }
    }

    return {
      done: true,
      body: {
        working_days: workingDays,
        total_days: totalDays,
        holidays_count: 0,
      },
    } as IServerResponse<{ working_days: number; total_days: number; holidays_count: number }>;
  },

  // Populate holidays - Populate the database with official holidays for various countries
  populateCountryHolidays: async (): Promise<IServerResponse<any>> => {
    const response = await apiClient.post<IServerResponse<any>>(`${rootUrl}/populate`);
    return response.data;
  },
};
