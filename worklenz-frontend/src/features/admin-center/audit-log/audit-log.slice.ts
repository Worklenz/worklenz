import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import type { AuditEventCategoryId } from '@/shared/audit-log-constants';
import type { TimeLogsDatePreset } from '@/pages/reporting/time-sheets/components/time-logs/time-logs-filters';
import {
  DEFAULT_AUDIT_LOG_FILTERS,
  DEFAULT_AUDIT_LOG_PAGE_SIZE,
  IAuditLogFilterState,
} from './audit-log-filters';

interface IAuditLogState {
  filters: IAuditLogFilterState;
  page: number;
  pageSize: number;
  /** Background export being tracked on the page; cleared when the user dismisses it. */
  exportJobId: string | null;
  /** A job the user dismissed, so the "latest job" lookup does not bring it back. */
  dismissedExportJobId: string | null;
}

const initialState: IAuditLogState = {
  filters: DEFAULT_AUDIT_LOG_FILTERS,
  page: 1,
  pageSize: DEFAULT_AUDIT_LOG_PAGE_SIZE,
  exportJobId: null,
  dismissedExportJobId: null,
};

const auditLogSlice = createSlice({
  name: 'auditLog',
  initialState,
  reducers: {
    setDateFilter: (
      state,
      action: PayloadAction<{ datePreset: TimeLogsDatePreset; customRange: [string, string] | null }>
    ) => {
      state.filters.datePreset = action.payload.datePreset;
      state.filters.customRange = action.payload.customRange;
      state.page = 1;
    },
    setCategoryFilter: (state, action: PayloadAction<AuditEventCategoryId[]>) => {
      state.filters.categories = action.payload;
      state.page = 1;
    },
    setActorFilter: (state, action: PayloadAction<string[]>) => {
      state.filters.actorUserIds = action.payload;
      state.page = 1;
    },
    setSearch: (state, action: PayloadAction<string>) => {
      state.filters.search = action.payload;
      state.page = 1;
    },
    resetFilters: state => {
      state.filters = DEFAULT_AUDIT_LOG_FILTERS;
      state.page = 1;
    },
    setPagination: (state, action: PayloadAction<{ page: number; pageSize: number }>) => {
      state.page = action.payload.pageSize === state.pageSize ? action.payload.page : 1;
      state.pageSize = action.payload.pageSize;
    },
    trackExportJob: (state, action: PayloadAction<string>) => {
      state.exportJobId = action.payload;
    },
    dismissExportJob: state => {
      state.dismissedExportJobId = state.exportJobId;
      state.exportJobId = null;
    },
  },
});

export const {
  setDateFilter,
  setCategoryFilter,
  setActorFilter,
  setSearch,
  resetFilters,
  setPagination,
  trackExportJob,
  dismissExportJob,
} = auditLogSlice.actions;

export const selectAuditLogState = (state: RootState) => state.auditLogReducer;

export default auditLogSlice.reducer;
