# 🎨 Schedule Phase 2: Frontend Integration Guide

**Status:** In Progress  
**Priority:** HIGH  
**Estimated Time:** 2-3 days

---

## ✅ What's Complete

### Backend (100%)
- ✅ SQL function: `calculate_member_capacity()`
- ✅ Controller: `CapacityController` with 3 endpoints
- ✅ Routes registered in `schedule-api-v2-router.ts`
- ✅ Database migration file created

### Frontend API Layer (100%)
- ✅ RTK Query endpoints added to `scheduleApi.ts`
- ✅ Hooks exported: `useFetchDailyCapacityQuery`, `useFetchCapacitySummaryQuery`, `useFetchCapacityConflictsQuery`
- ✅ Tag invalidation configured

---

## 🎯 Next Steps: Component Integration

### Step 1: Update DayAllocationCell Component

**File:** `worklenz-frontend/src/components/schedule/grant-chart/day-allocation-cell.tsx`

**Current State:** Placeholder component with static props

**Target State:** Dynamic capacity visualization with real data

**Implementation:**

```typescript
import React from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';

interface DailyCapacityData {
  date: string;
  working_hours: number;
  allocated_hours: number;
  available_hours: number;
  utilization_percent: number;
  is_time_off: boolean;
  is_weekend: boolean;
  status: 'available' | 'normal' | 'fully-allocated' | 'overallocated' | 'unavailable';
  projects: Array<{
    project_id: string;
    project_name: string;
    allocated_hours: number;
    color_code: string;
  }>;
}

interface DayAllocationCellProps {
  capacityData: DailyCapacityData | null;
  memberName: string;
  date: string;
}

const DayAllocationCell: React.FC<DayAllocationCellProps> = ({
  capacityData,
  memberName,
  date,
}) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  if (!capacityData) {
    return (
      <div style={{
        height: '100%',
        backgroundColor: themeWiseColor('#f5f5f5', '#262626', themeMode),
      }} />
    );
  }

  const getStatusColor = () => {
    switch (capacityData.status) {
      case 'available':
        return { bg: '#f6ffed', border: '#b7eb8f', text: '#52c41a' }; // Green
      case 'normal':
        return { bg: '#e6f7ff', border: '#91d5ff', text: '#1890ff' }; // Blue
      case 'fully-allocated':
        return { bg: '#fffbe6', border: '#ffe58f', text: '#faad14' }; // Yellow
      case 'overallocated':
        return { bg: '#fff1f0', border: '#ffccc7', text: '#f5222d' }; // Red
      case 'unavailable':
        return { bg: '#fafafa', border: '#d9d9d9', text: '#8c8c8c' }; // Gray
      default:
        return { bg: '#fafafa', border: '#d9d9d9', text: '#8c8c8c' };
    }
  };

  const colors = getStatusColor();

  // Dark mode adjustments
  const bgColor = themeMode === 'dark' 
    ? capacityData.status === 'overallocated' ? 'rgba(245, 34, 45, 0.2)' 
    : capacityData.status === 'fully-allocated' ? 'rgba(250, 173, 20, 0.2)'
    : capacityData.status === 'normal' ? 'rgba(24, 144, 255, 0.2)'
    : capacityData.status === 'available' ? 'rgba(82, 196, 26, 0.2)'
    : 'rgba(140, 140, 140, 0.2)'
    : colors.bg;

  const tooltipContent = (
    <div style={{ minWidth: 200 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
        {memberName} - {date}
      </div>
      
      {capacityData.is_time_off ? (
        <div style={{ color: '#faad14' }}>🔵 Time Off</div>
      ) : capacityData.is_weekend ? (
        <div style={{ color: '#8c8c8c' }}>Weekend</div>
      ) : (
        <>
          <div style={{ marginBottom: 4 }}>
            <strong>Working Hours:</strong> {capacityData.working_hours}h
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong>Allocated:</strong> {capacityData.allocated_hours.toFixed(1)}h
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong>Available:</strong> {capacityData.available_hours.toFixed(1)}h
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Utilization:</strong> {capacityData.utilization_percent.toFixed(0)}%
          </div>

          {capacityData.projects.length > 0 && (
            <>
              <div style={{ fontWeight: 'bold', marginTop: 8, marginBottom: 4 }}>
                Projects:
              </div>
              {capacityData.projects.map(project => (
                <div key={project.project_id} style={{ marginLeft: 8, marginBottom: 2 }}>
                  <span style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: project.color_code,
                    marginRight: 6,
                  }} />
                  {project.project_name}: {project.allocated_hours.toFixed(1)}h
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <Tooltip title={tooltipContent} placement="top">
      <div
        style={{
          height: '100%',
          backgroundColor: bgColor,
          border: `1px solid ${themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 500,
          color: themeMode === 'dark' ? '#fff' : colors.text,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        className="hover:opacity-80"
      >
        {capacityData.is_time_off ? (
          <div>🔵</div>
        ) : capacityData.is_weekend ? (
          <div>-</div>
        ) : (
          <>
            <div>{capacityData.utilization_percent.toFixed(0)}%</div>
            <div style={{ fontSize: '8px', opacity: 0.7 }}>
              {capacityData.allocated_hours.toFixed(1)}/{capacityData.working_hours}h
            </div>
          </>
        )}
      </div>
    </Tooltip>
  );
};

export default DayAllocationCell;
```

---

### Step 2: Update GranttChart to Fetch Capacity

**File:** `worklenz-frontend/src/components/schedule/grant-chart/GranttChart.tsx`

**Changes Needed:**

1. **Import the capacity hook:**
```typescript
import {
  useFetchScheduleMembersQuery,
  useFetchScheduleDatesQuery,
  useLazyFetchMemberProjectsQuery,
  useFetchDailyCapacityQuery, // NEW
} from '@/api/schedule/scheduleApi';
```

2. **Calculate end date based on view type:**
```typescript
const calculateEndDate = (startDate: string, type: string): string => {
  const start = new Date(startDate);
  if (type === 'week') {
    start.setDate(start.getDate() + 14); // 2 weeks
  } else {
    start.setMonth(start.getMonth() + 1); // 1 month
  }
  return start.toISOString().split('T')[0];
};
```

3. **Fetch capacity data:**
```typescript
const {
  data: capacityResponse,
  isLoading: capacityLoading,
  refetch: refetchCapacity,
} = useFetchDailyCapacityQuery({
  startDate: formattedDate,
  endDate: calculateEndDate(formattedDate, type),
});

const capacityData = capacityResponse?.body || [];
```

4. **Create helper function to get capacity for specific date/member:**
```typescript
const getCapacityForDate = (memberId: string, date: string): DailyCapacityData | null => {
  const memberCapacity = capacityData.find(
    (m: any) => m.team_member_id === memberId
  );
  
  if (!memberCapacity) return null;
  
  return memberCapacity.daily_capacity.find(
    (d: any) => d.date === date
  ) || null;
};
```

5. **Update DayAllocationCell usage:**
```typescript
<DayAllocationCell
  capacityData={getCapacityForDate(
    memberId,
    `${date.year}-${String(date.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`
  )}
  memberName={member.name}
  date={`${date.month.substring(0, 3)} ${day.day}`}
/>
```

6. **Add capacity refetch to useEffect:**
```typescript
useEffect(() => {
  refetchTeam();
  refetchDates();
  refetchCapacity(); // NEW
}, [date, type, refetchTeam, refetchDates, refetchCapacity, formattedDate]);
```

---

### Step 3: Add Capacity Conflicts Indicator

**File:** `worklenz-frontend/src/components/schedule/grant-chart/CapacityConflictsAlert.tsx` (NEW)

```typescript
import React from 'react';
import { Alert, Badge, Collapse } from '@/shared/antd-imports';
import { WarningOutlined } from '@ant-design/icons';
import { useFetchCapacityConflictsQuery } from '@/api/schedule/scheduleApi';
import { useTranslation } from 'react-i18next';

const { Panel } = Collapse;

interface CapacityConflictsAlertProps {
  startDate: string;
  endDate: string;
}

const CapacityConflictsAlert: React.FC<CapacityConflictsAlertProps> = ({
  startDate,
  endDate,
}) => {
  const { t } = useTranslation('schedule');
  const { data: conflictsResponse } = useFetchCapacityConflictsQuery({
    startDate,
    endDate,
  });

  const conflicts = conflictsResponse?.body || [];

  if (conflicts.length === 0) return null;

  const highSeverity = conflicts.filter((c: any) => c.severity === 'high').length;
  const mediumSeverity = conflicts.filter((c: any) => c.severity === 'medium').length;

  return (
    <Alert
      message={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WarningOutlined />
          <span>
            {t('capacityConflicts', { defaultValue: 'Capacity Conflicts Detected' })}
          </span>
          <Badge count={conflicts.length} style={{ backgroundColor: '#f5222d' }} />
        </div>
      }
      description={
        <Collapse ghost>
          <Panel
            header={`${highSeverity} high, ${mediumSeverity} medium severity conflicts`}
            key="1"
          >
            {conflicts.map((conflict: any, index: number) => (
              <div
                key={index}
                style={{
                  padding: '8px 0',
                  borderBottom: index < conflicts.length - 1 ? '1px solid #f0f0f0' : 'none',
                }}
              >
                <div style={{ fontWeight: 500 }}>{conflict.member_name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {new Date(conflict.date).toLocaleDateString()} - 
                  Over-allocated by {conflict.overallocation_hours.toFixed(1)}h 
                  ({conflict.utilization_percent.toFixed(0)}% utilization)
                </div>
              </div>
            ))}
          </Panel>
        </Collapse>
      }
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
    />
  );
};

export default CapacityConflictsAlert;
```

**Add to GranttChart:**
```typescript
import CapacityConflictsAlert from './CapacityConflictsAlert';

// In render:
<CapacityConflictsAlert
  startDate={formattedDate}
  endDate={calculateEndDate(formattedDate, type)}
/>
```

---

## 📋 Testing Checklist

### Backend Testing
- [ ] Run database migration
- [ ] Test `/capacity/daily` endpoint with curl
- [ ] Test `/capacity/summary` endpoint
- [ ] Test `/capacity/conflicts` endpoint
- [ ] Verify capacity calculations are accurate
- [ ] Test with time-off entries
- [ ] Test with multiple projects per member

### Frontend Testing
- [ ] Capacity data loads in Gantt chart
- [ ] Color coding works (green/yellow/red)
- [ ] Tooltips show correct information
- [ ] Over-allocation warnings appear
- [ ] Time-off blocks show correctly
- [ ] Weekend cells show correctly
- [ ] Loading states work
- [ ] Error states handled gracefully
- [ ] Dark mode compatibility
- [ ] Performance: <2s load for 50 members, 30 days

---

## 🎨 Visual Design Reference

### Color Scheme

| Status | Light Mode | Dark Mode | Usage |
|--------|-----------|-----------|-------|
| Available (0-75%) | 🟢 #f6ffed | rgba(82,196,26,0.2) | Has capacity |
| Normal (75-100%) | 🔵 #e6f7ff | rgba(24,144,255,0.2) | Well utilized |
| Fully Allocated (100%) | 🟡 #fffbe6 | rgba(250,173,20,0.2) | At capacity |
| Over-allocated (>100%) | 🔴 #fff1f0 | rgba(245,34,45,0.2) | Over capacity |
| Unavailable | ⚪ #fafafa | rgba(140,140,140,0.2) | Time-off/weekend |

---

## 🚀 Deployment Steps

1. **Backend:**
   ```bash
   cd worklenz-backend
   psql -U postgres -d worklenz -f database/sql/migrations/20260114000000-capacity-calculation-function.sql
   npm run build
   pm2 restart worklenz-backend
   ```

2. **Frontend:**
   ```bash
   cd worklenz-frontend
   npm run build
   # Deploy to production
   ```

3. **Verification:**
   - Check capacity endpoint: `curl http://localhost:3000/api/schedule-gannt-v2/capacity/daily?startDate=2026-01-13&endDate=2026-02-13`
   - Open schedule page
   - Verify capacity colors display
   - Check tooltips work
   - Test with different date ranges

---

## 📚 Documentation References

- **API Reference:** `docs/QUICK_REFERENCE_CAPACITY_API.md`
- **Implementation Plan:** `docs/SCHEDULE_PROJECT_VIEW_IMPLEMENTATION_PLAN.md`
- **Analysis:** `docs/SCHEDULE_PROJECT_VIEW_ANALYSIS.md`
- **Setup Guide:** `docs/SCHEDULE_SETUP_GUIDE.md`

---

## ✅ Success Criteria

Phase 2 is complete when:
- [ ] Daily capacity shows real-time utilization
- [ ] Color-coded indicators work (green/yellow/red)
- [ ] Tooltips show project breakdown
- [ ] Over-allocation warnings appear
- [ ] Time-off blocks calendar automatically
- [ ] Performance meets targets (<2s load)
- [ ] Works in both light and dark modes
- [ ] No console errors
- [ ] All tests pass

---

**Next Phase:** Phase 3 - Drag-and-Drop Allocation Editing

**Estimated Completion:** 2-3 days after Phase 2
