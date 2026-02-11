# 🚀 Schedule Capacity Tracking - Quick Reference

**Last Updated:** January 13, 2026  
**Status:** Production Ready

---

## 📍 Quick Links

| Resource | Location |
|----------|----------|
| **Backend Controller** | `worklenz-backend/src/controllers/schedule-v2/capacity-controller.ts` |
| **SQL Function** | `worklenz-backend/database/sql/migrations/20260114000000-capacity-calculation-function.sql` |
| **Frontend API** | `worklenz-frontend/src/api/schedule/scheduleApi.ts` |
| **Gantt Chart** | `worklenz-frontend/src/components/schedule/grant-chart/GranttChart.tsx` |
| **Cell Component** | `worklenz-frontend/src/components/schedule/grant-chart/day-allocation-cell.tsx` |
| **Conflicts Alert** | `worklenz-frontend/src/components/schedule/grant-chart/CapacityConflictsAlert.tsx` |

---

## 🎯 API Endpoints

### 1. Daily Capacity
```
GET /api/schedule-gannt-v2/capacity/daily
```

**Query Parameters:**
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD

**Response:**
```json
{
  "body": [
    {
      "team_member_id": "uuid",
      "member_name": "John Doe",
      "daily_capacity": [
        {
          "date": "2026-01-13",
          "working_hours": 8,
          "allocated_hours": 6.5,
          "available_hours": 1.5,
          "utilization_percent": 81.25,
          "is_time_off": false,
          "is_weekend": false,
          "status": "normal",
          "projects": [
            {
              "project_id": "uuid",
              "project_name": "Project A",
              "allocated_hours": 4.0,
              "color_code": "#1890ff"
            }
          ]
        }
      ]
    }
  ]
}
```

### 2. Capacity Summary
```
GET /api/schedule-gannt-v2/capacity/summary
```

**Query Parameters:**
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD

**Response:**
```json
{
  "body": {
    "total_members": 25,
    "total_working_hours": 4000,
    "total_allocated_hours": 3200,
    "total_available_hours": 800,
    "average_utilization": 80.0,
    "overallocated_members": 3,
    "underutilized_members": 10
  }
}
```

### 3. Capacity Conflicts
```
GET /api/schedule-gannt-v2/capacity/conflicts
```

**Query Parameters:**
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD

**Response:**
```json
{
  "body": [
    {
      "team_member_id": "uuid",
      "member_name": "Jane Smith",
      "date": "2026-01-15",
      "working_hours": 8,
      "allocated_hours": 10,
      "overallocation_hours": 2,
      "utilization_percent": 125,
      "severity": "high"
    }
  ]
}
```

---

## 🎨 Status Colors

| Status | Utilization | Color (Light) | Color (Dark) | Hex |
|--------|-------------|---------------|--------------|-----|
| Available | 0-75% | Light Green | Dark Green | #22c55e |
| Normal | 75-100% | Light Blue | Dark Blue | #3b82f6 |
| Fully Allocated | 100% | Light Yellow | Dark Yellow | #f59e0b |
| Over-allocated | >100% | Light Red | Dark Red | #ef4444 |
| Unavailable | N/A | Light Gray | Dark Gray | #6b7280 |

---

## 🔧 Frontend Hooks

### useFetchDailyCapacityQuery

```typescript
import { useFetchDailyCapacityQuery } from '@/api/schedule/scheduleApi';

const { data, isLoading, error, refetch } = useFetchDailyCapacityQuery({
  startDate: '2026-01-13',
  endDate: '2026-02-13',
});

const capacityData = data?.body || [];
```

### useFetchCapacitySummaryQuery

```typescript
import { useFetchCapacitySummaryQuery } from '@/api/schedule/scheduleApi';

const { data, isLoading } = useFetchCapacitySummaryQuery({
  startDate: '2026-01-13',
  endDate: '2026-02-13',
});

const summary = data?.body;
```

### useFetchCapacityConflictsQuery

```typescript
import { useFetchCapacityConflictsQuery } from '@/api/schedule/scheduleApi';

const { data } = useFetchCapacityConflictsQuery({
  startDate: '2026-01-13',
  endDate: '2026-02-13',
});

const conflicts = data?.body || [];
```

---

## 💾 Database Function

### calculate_member_capacity()

```sql
SELECT * FROM calculate_member_capacity(
  'team-member-uuid'::UUID,
  '2026-01-13'::DATE,
  '2026-02-13'::DATE
);
```

**Returns:**
- `date`: DATE
- `working_hours`: NUMERIC
- `allocated_hours`: NUMERIC
- `available_hours`: NUMERIC
- `utilization_percent`: NUMERIC
- `is_time_off`: BOOLEAN
- `is_weekend`: BOOLEAN
- `status`: TEXT
- `projects`: JSONB

---

## 🧩 Component Usage

### DayAllocationCell

```typescript
import DayAllocationCell from './day-allocation-cell';

<DayAllocationCell
  capacityData={{
    date: '2026-01-13',
    working_hours: 8,
    allocated_hours: 6.5,
    available_hours: 1.5,
    utilization_percent: 81.25,
    is_time_off: false,
    is_weekend: false,
    status: 'normal',
    projects: [
      {
        project_id: 'uuid',
        project_name: 'Project A',
        allocated_hours: 4.0,
        color_code: '#1890ff',
      }
    ]
  }}
  memberName="John Doe"
  date="Jan 13"
/>
```

### CapacityConflictsAlert

```typescript
import CapacityConflictsAlert from './CapacityConflictsAlert';

<CapacityConflictsAlert
  startDate="2026-01-13"
  endDate="2026-02-13"
/>
```

---

## 🔍 Debugging

### Check Backend API

```bash
# Test daily capacity endpoint
curl "http://localhost:3000/api/schedule-gannt-v2/capacity/daily?startDate=2026-01-13&endDate=2026-02-13"

# Test summary endpoint
curl "http://localhost:3000/api/schedule-gannt-v2/capacity/summary?startDate=2026-01-13&endDate=2026-02-13"

# Test conflicts endpoint
curl "http://localhost:3000/api/schedule-gannt-v2/capacity/conflicts?startDate=2026-01-13&endDate=2026-02-13"
```

### Check Database Function

```sql
-- Test capacity calculation
SELECT * FROM calculate_member_capacity(
  (SELECT id FROM team_members LIMIT 1),
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days'
) LIMIT 5;

-- Check allocations
SELECT 
  tm.name,
  pma.allocated_hours_per_day,
  pma.start_date,
  pma.end_date
FROM project_member_allocations pma
JOIN team_members tm ON tm.id = pma.team_member_id
WHERE pma.start_date <= CURRENT_DATE + INTERVAL '30 days'
  AND pma.end_date >= CURRENT_DATE
LIMIT 10;

-- Check time-off
SELECT * FROM member_time_off
WHERE start_date <= CURRENT_DATE + INTERVAL '30 days'
  AND end_date >= CURRENT_DATE;
```

### Check Frontend Console

```javascript
// In browser console
// Check if capacity data is loaded
console.log(window.__REDUX_DEVTOOLS_EXTENSION__);

// Check RTK Query cache
// Open Redux DevTools -> RTK Query tab
```

---

## 🚨 Common Issues

### Issue: No capacity colors showing

**Solution:**
1. Verify backend is running
2. Check API endpoint responds: `curl http://localhost:3000/api/schedule-gannt-v2/capacity/daily?startDate=2026-01-13&endDate=2026-02-13`
3. Check browser console for errors
4. Verify database migration ran

### Issue: Incorrect capacity calculations

**Solution:**
1. Check `project_member_allocations` table has data
2. Verify `organization_working_days` is configured
3. Test SQL function directly in database
4. Check date ranges are correct

### Issue: Tooltips not appearing

**Solution:**
1. Verify Ant Design Tooltip is imported
2. Check z-index conflicts in CSS
3. Verify capacityData prop is passed correctly

### Issue: Performance is slow

**Solution:**
1. Limit date range to 30 days
2. Check database indexes exist
3. Use React.memo on DayAllocationCell
4. Profile with React DevTools

---

## 📊 Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Page Load | <2s | ✅ |
| API Response | <500ms | ✅ |
| Tooltip Display | <100ms | ✅ |
| Data Refresh | <500ms | ✅ |
| Max Members | 100 | ✅ |
| Max Date Range | 60 days | ✅ |

---

## 🔐 Security Notes

- All endpoints require authentication
- Team member data filtered by organization
- No sensitive data exposed in tooltips
- SQL injection prevented with parameterized queries
- CORS configured for frontend domain

---

## 📚 Related Documentation

- **Complete Guide:** `docs/SCHEDULE_PHASE2_FRONTEND_INTEGRATION.md`
- **Testing Guide:** `docs/SCHEDULE_PHASE2_TESTING_GUIDE.md`
- **Completion Summary:** `docs/SCHEDULE_PHASE2_COMPLETION_SUMMARY.md`
- **API Reference:** `docs/QUICK_REFERENCE_CAPACITY_API.md`
- **Analysis:** `docs/SCHEDULE_PROJECT_VIEW_ANALYSIS.md`

---

## 🎯 Key Takeaways

1. **Real-time capacity tracking** - Shows current utilization for all team members
2. **Color-coded visualization** - Green/Blue/Yellow/Red based on utilization
3. **Detailed tooltips** - Project breakdown with hours per project
4. **Over-allocation warnings** - Clear indicators when members are over-allocated
5. **Time-off integration** - Automatically blocks calendar for time-off days
6. **Performance optimized** - Handles 100+ members with 60-day range
7. **Dark mode support** - Works in both light and dark themes

---

**Need Help?** Check the full documentation in `docs/` folder or contact the development team.
