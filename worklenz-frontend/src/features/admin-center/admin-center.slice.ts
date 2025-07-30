import { adminCenterApiService } from '@/api/admin-center/admin-center.api.service';
import { createSelector } from '@reduxjs/toolkit';
import dayjs from 'dayjs';
import {
  IBillingAccountInfo,
  IBillingAccountStorage,
  IFreePlanSettings,
  IOrganization,
  IOrganizationAdmin,
} from '@/types/admin-center/admin-center.types';
import {
  IOrganizationHolidaySettings,
  ICountryWithStates,
  IHolidayCalendarEvent,
} from '@/types/holiday/holiday.types';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

interface adminCenterState {
  isRedeemCodeDrawerOpen: boolean;
  isUpgradeModalOpen: boolean;
  loadingBillingInfo: boolean;
  billingInfo: IBillingAccountInfo | null;
  freePlanSettings: IFreePlanSettings | null;
  storageInfo: IBillingAccountStorage | null;
  loadingStorageInfo: boolean;
  organization: IOrganization | null;
  loadingOrganization: boolean;
  organizationAdmins: IOrganizationAdmin[] | null;
  loadingOrganizationAdmins: boolean;
  holidaySettings: IOrganizationHolidaySettings | null;
  loadingHolidaySettings: boolean;
  countriesWithStates: ICountryWithStates[];
  loadingCountries: boolean;
  holidays: IHolidayCalendarEvent[];
  loadingHolidays: boolean;
  holidaysDateRange: { from: string; to: string } | null;
}

const initialState: adminCenterState = {
  isRedeemCodeDrawerOpen: false,
  isUpgradeModalOpen: false,
  loadingBillingInfo: false,
  billingInfo: null,
  freePlanSettings: null,
  storageInfo: null,
  loadingStorageInfo: false,
  organization: null,
  loadingOrganization: false,
  organizationAdmins: null,
  loadingOrganizationAdmins: false,
  holidaySettings: null,
  loadingHolidaySettings: false,
  countriesWithStates: [],
  loadingCountries: false,
  holidays: [],
  loadingHolidays: false,
  holidaysDateRange: null,
};

export const fetchBillingInfo = createAsyncThunk('adminCenter/fetchBillingInfo', async () => {
  const res = await adminCenterApiService.getBillingAccountInfo();
  return res.body;
});

export const fetchFreePlanSettings = createAsyncThunk(
  'adminCenter/fetchFreePlanSettings',
  async () => {
    const res = await adminCenterApiService.getFreePlanSettings();
    return res.body;
  }
);

export const fetchStorageInfo = createAsyncThunk('adminCenter/fetchStorageInfo', async () => {
  const res = await adminCenterApiService.getAccountStorage();
  return res.body;
});

export const fetchOrganizationDetails = createAsyncThunk(
  'adminCenter/fetchOrganizationDetails',
  async () => {
    const res = await adminCenterApiService.getOrganizationDetails();
    return res.body;
  }
);

export const fetchAdminCenterSettings = createAsyncThunk(
  'adminCenter/fetchAdminCenterSettings',
  async () => {
    const res = await adminCenterApiService.getAdminCenterSettings();
    return res.body;
  }
);

export const fetchOrganizationAdmins = createAsyncThunk(
  'adminCenter/fetchOrganizationAdmins',
  async () => {
    const res = await adminCenterApiService.getOrganizationAdmins();
    return res.body;
  }
);

export const fetchHolidaySettings = createAsyncThunk(
  'adminCenter/fetchHolidaySettings',
  async () => {
    const { holidayApiService } = await import('@/api/holiday/holiday.api.service');
    const res = await holidayApiService.getOrganizationHolidaySettings();
    return res.body;
  }
);

export const updateHolidaySettings = createAsyncThunk(
  'adminCenter/updateHolidaySettings',
  async (settings: IOrganizationHolidaySettings) => {
    const { holidayApiService } = await import('@/api/holiday/holiday.api.service');
    await holidayApiService.updateOrganizationHolidaySettings(settings);
    return settings;
  }
);

export const fetchCountriesWithStates = createAsyncThunk(
  'adminCenter/fetchCountriesWithStates',
  async () => {
    const { holidayApiService } = await import('@/api/holiday/holiday.api.service');
    const res = await holidayApiService.getCountriesWithStates();
    return res.body;
  }
);

export const fetchHolidays = createAsyncThunk(
  'adminCenter/fetchHolidays',
  async (
    params: { from_date: string; to_date: string; include_custom?: boolean; country_code?: string },
    { getState }
  ) => {
    const state = getState() as { adminCenterReducer: adminCenterState };
    const currentRange = state.adminCenterReducer.holidaysDateRange;
    
    // Get country code from holiday settings if not provided in params
    const countryCode = params.country_code || state.adminCenterReducer.holidaySettings?.country_code;

    // Check if we already have data for this range (cache hit)
    if (
      currentRange &&
      currentRange.from === params.from_date &&
      currentRange.to === params.to_date &&
      state.adminCenterReducer.holidays.length > 0
    ) {
      return { holidays: state.adminCenterReducer.holidays, dateRange: currentRange };
    }

    const { holidayApiService } = await import('@/api/holiday/holiday.api.service');
    const res = await holidayApiService.getCombinedHolidays({
      ...params,
      country_code: countryCode,
    });
    return { holidays: res.body, dateRange: { from: params.from_date, to: params.to_date } };
  }
);

const adminCenterSlice = createSlice({
  name: 'adminCenterReducer',
  initialState,
  reducers: {
    toggleRedeemCodeDrawer: state => {
      state.isRedeemCodeDrawerOpen
        ? (state.isRedeemCodeDrawerOpen = false)
        : (state.isRedeemCodeDrawerOpen = true);
    },
    toggleUpgradeModal: state => {
      state.isUpgradeModalOpen
        ? (state.isUpgradeModalOpen = false)
        : (state.isUpgradeModalOpen = true);
    },
    clearHolidaysCache: state => {
      state.holidays = [];
      state.holidaysDateRange = null;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchBillingInfo.pending, (state, action) => {
      state.loadingBillingInfo = true;
    });
    builder.addCase(fetchBillingInfo.fulfilled, (state, action) => {
      state.billingInfo = action.payload;
      state.loadingBillingInfo = false;
    });
    builder.addCase(fetchBillingInfo.rejected, (state, action) => {
      state.loadingBillingInfo = false;
    });

    builder.addCase(fetchFreePlanSettings.fulfilled, (state, action) => {
      state.freePlanSettings = action.payload;
    });

    builder.addCase(fetchStorageInfo.fulfilled, (state, action) => {
      state.storageInfo = action.payload;
    });

    builder.addCase(fetchStorageInfo.rejected, (state, action) => {
      state.loadingStorageInfo = false;
    });

    builder.addCase(fetchStorageInfo.pending, (state, action) => {
      state.loadingStorageInfo = true;
    });

    builder.addCase(fetchOrganizationDetails.pending, (state, action) => {
      state.loadingOrganization = true;
    });
    builder.addCase(fetchOrganizationDetails.fulfilled, (state, action) => {
      state.organization = action.payload;
      state.loadingOrganization = false;
    });
    builder.addCase(fetchOrganizationDetails.rejected, (state, action) => {
      state.loadingOrganization = false;
    });

    builder.addCase(fetchAdminCenterSettings.pending, (state, action) => {
      state.loadingOrganization = true;
    });
    builder.addCase(fetchAdminCenterSettings.fulfilled, (state, action) => {
      state.organization = action.payload;
      state.loadingOrganization = false;
    });
    builder.addCase(fetchAdminCenterSettings.rejected, (state, action) => {
      state.loadingOrganization = false;
    });

    builder.addCase(fetchOrganizationAdmins.pending, (state, action) => {
      state.loadingOrganizationAdmins = true;
    });
    builder.addCase(fetchOrganizationAdmins.fulfilled, (state, action) => {
      state.organizationAdmins = action.payload;
      state.loadingOrganizationAdmins = false;
    });
    builder.addCase(fetchOrganizationAdmins.rejected, (state, action) => {
      state.loadingOrganizationAdmins = false;
    });

    builder.addCase(fetchHolidaySettings.pending, (state, action) => {
      state.loadingHolidaySettings = true;
    });
    builder.addCase(fetchHolidaySettings.fulfilled, (state, action) => {
      state.holidaySettings = action.payload;
      state.loadingHolidaySettings = false;
    });
    builder.addCase(fetchHolidaySettings.rejected, (state, action) => {
      state.loadingHolidaySettings = false;
    });

    builder.addCase(updateHolidaySettings.fulfilled, (state, action) => {
      state.holidaySettings = action.payload;
      // Update organization object if it exists
      if (state.organization) {
        state.organization.country_code = action.payload.country_code;
        state.organization.state_code = action.payload.state_code;
        state.organization.auto_sync_holidays = action.payload.auto_sync_holidays;
      }
    });

    builder.addCase(fetchCountriesWithStates.pending, (state, action) => {
      state.loadingCountries = true;
    });
    builder.addCase(fetchCountriesWithStates.fulfilled, (state, action) => {
      state.countriesWithStates = action.payload;
      state.loadingCountries = false;
    });
    builder.addCase(fetchCountriesWithStates.rejected, (state, action) => {
      state.loadingCountries = false;
    });

    builder.addCase(fetchHolidays.pending, (state, action) => {
      state.loadingHolidays = true;
    });
    builder.addCase(fetchHolidays.fulfilled, (state, action) => {
      // Only update if this is new data (not a cache hit)
      if (action.payload.holidays !== state.holidays) {
        state.holidays = action.payload.holidays;
        state.holidaysDateRange = action.payload.dateRange;
      }
      state.loadingHolidays = false;
    });
    builder.addCase(fetchHolidays.rejected, (state, action) => {
      state.loadingHolidays = false;
    });
  },
});

export const { toggleRedeemCodeDrawer, toggleUpgradeModal, clearHolidaysCache } = adminCenterSlice.actions;

// Selectors for optimized access
export const selectHolidaysByDateRange = createSelector(
  [
    (state: any) => state.adminCenterReducer.holidays,
    (state: any, dateRange: { from: string; to: string }) => dateRange,
  ],
  (holidays, dateRange) => {
    if (!holidays || holidays.length === 0) return [];

    return holidays.filter((holiday: IHolidayCalendarEvent) => {
      const holidayDate = dayjs(holiday.date);
      return holidayDate.isBetween(dayjs(dateRange.from), dayjs(dateRange.to), 'day', '[]');
    });
  }
);

export const selectWorkingDaysInRange = createSelector(
  [
    (state: any) => state.adminCenterReducer.holidays,
    (state: any, params: { from: string; to: string; workingDays: string[] }) => params,
  ],
  (holidays, { from, to, workingDays }) => {
    const start = dayjs(from);
    const end = dayjs(to);
    const holidayDates = new Set(holidays.map((h: IHolidayCalendarEvent) => h.date));

    let totalWorkingDays = 0;
    let current = start;

    while (current.isSameOrBefore(end)) {
      const dayName = current.format('dddd');
      const isWorkingDay = workingDays.includes(dayName);
      const isHoliday = holidayDates.has(current.format('YYYY-MM-DD'));

      if (isWorkingDay && !isHoliday) {
        totalWorkingDays++;
      }

      current = current.add(1, 'day');
    }

    return totalWorkingDays;
  }
);

export default adminCenterSlice.reducer;
