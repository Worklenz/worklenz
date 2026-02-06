# 🎯 Schedule Project View - Next Development Steps

**Status:** Analysis Complete | Ready for Implementation  
**Priority:** 2 Most Important Features Identified

---

## 📊 Current State Summary

### ✅ What's Complete
- Task Timeline View (100%)
- Time-Off Management Backend (100%)
- Basic Project View UI (70%)
- Database schema for allocations (80%)

### ❌ What's Missing in Project View
- Real-time capacity calculations
- Live utilization indicators
- Drag-and-drop allocation editing
- Time-off integration with capacity
- Budget/cost tracking
- Conflict detection warnings

---

## 🎯 TOP 2 MOST IMPORTANT FEATURES TO IMPLEMENT

Based on Hello Bonsai analysis and current gaps:

### **1. LIVE CAPACITY TRACKING & VISUALIZATION** 🔴 CRITICAL

**Why It's Critical:**
- Core feature of resource management
- Users need to see over/under-allocation instantly
- Prevents scheduling conflicts
- Most requested feature in project management tools

**What to Build:**

#### Backend: Capacity Calculation API
**File:** `worklenz-backend/src/controllers/schedule-v2/capacity-controller.ts`

```typescript
// New endpoint: GET /api/schedule-gannt-v2/capacity/daily
// Returns daily capacity for all members in date range
interface DailyCapacity {
  date: string;
  team_member_id: string;
  working_hours: number;
  allocated_hours: number;
  available_hours: number;
  utilization_percent: number;
  status: 'available' | 'normal' | 'fully-allocated' | 'overallocated';
  is_time_off: boolean;
  is_weekend: boolean;
  projects: Array<{
    project_id: string;
    project_name: string;
    allocated_hours: number;
  }>;
}
```

#### Frontend: Enhanced DayAllocationCell
**File:** `worklenz-frontend/src/components/schedule/grant-chart/day-allocation-cell.tsx`

**Current:** Placeholder with static data  
**New:** Dynamic capacity visualization

```tsx
interface DayAllocationCellProps {
  date: string;
  memberId: string;
  workingHours: number;
  allocatedHours: number;
  availableHours: number;
  utilizationPercent: number;
  isTimeOff: boolean;
  isWeekend: boolean;
  projects: ProjectAllocation[];
}

// Visual indicators:
// - Green: 0-75% utilization
// - Yellow: 75-100% utilization
// - Red: >100% over-allocated
// - Gray: Time-off/weekend
// - Tooltip: Detailed breakdown
```

**Implementation Steps:**
1. Create database function `calculate_member_capacity()` (SQL)
2. Create `CapacityController` with daily capacity endpoint
3. Add RTK Query hook `useFetchDailyCapacityQuery()`
4. Update `DayAllocationCell` component with real data
5. Add color-coded capacity bars
6. Add hover tooltips with project breakdown

**Estimated Time:** 3-4 days

---

### **2. DRAG-AND-DROP ALLOCATION EDITING** 🔴 CRITICAL

**Why It's Critical:**
- Intuitive UX (industry standard)
- Saves time vs manual date entry
- Real-time visual feedback
- Matches Hello Bonsai's core feature

**What to Build:**

#### Backend: Update Allocation API
**File:** `worklenz-backend/src/controllers/schedule-v2/allocation-controller.ts`

```typescript
// New endpoints:
PUT  /api/schedule-gannt-v2/allocations/:id/dates
// Update allocation dates (drag-drop)
// Body: { allocated_from, allocated_to }

PUT  /api/schedule-gannt-v2/allocations/:id/hours
// Update hours per day (resize)
// Body: { seconds_per_day }

POST /api/schedule-gannt-v2/allocations/:id/split
// Split allocation into multiple periods
// Body: { split_date }
```

#### Frontend: Draggable ProjectTimelineBar
**File:** `worklenz-frontend/src/components/schedule/grant-chart/project-timeline-bar.tsx`

**Current:** Static bar, click opens modal  
**New:** Draggable, resizable bar with real-time updates

```tsx
// Use react-dnd or similar library
// Features:
// - Drag to move dates
// - Resize handles to adjust duration
// - Resize width to adjust hours/day
// - Real-time capacity validation
// - Optimistic updates with rollback
// - Socket.IO for multi-user sync
```

**Implementation Steps:**
1. Install `react-dnd` or `@dnd-kit/core`
2. Create allocation update endpoints
3. Add drag-drop handlers to `ProjectTimelineBar`
4. Add resize handles (left/right edges)
5. Implement optimistic updates
6. Add conflict detection (check capacity before save)
7. Emit Socket.IO events for real-time sync
8. Add undo/redo functionality

**Estimated Time:** 4-5 days

---

## 📋 Implementation Priority Order

### Week 1: Live Capacity Tracking
- [ ] Day 1-2: Database function + Capacity API
- [ ] Day 3-4: Frontend integration + DayAllocationCell
- [ ] Day 5: Testing + bug fixes

### Week 2: Drag-and-Drop Editing
- [ ] Day 1-2: Backend allocation update APIs
- [ ] Day 3-4: Drag-drop implementation
- [ ] Day 5: Conflict detection + validation

### Week 3: Polish & Integration
- [ ] Time-off integration with capacity
- [ ] Real-time Socket.IO updates
- [ ] Performance optimization
- [ ] User testing

---

## 🗂️ Files to Create/Modify

### Backend (Create)
1. `worklenz-backend/src/controllers/schedule-v2/capacity-controller.ts`
2. `worklenz-backend/src/controllers/schedule-v2/allocation-controller.ts`
3. `worklenz-backend/database/sql/migrations/20260114000000-capacity-function.sql`

### Backend (Modify)
4. `worklenz-backend/src/routes/apis/gannt-apis/schedule-api-v2-router.ts`
5. `worklenz-backend/src/controllers/schedule-v2/schedule-controller.ts`

### Frontend (Modify)
6. `worklenz-frontend/src/components/schedule/grant-chart/day-allocation-cell.tsx`
7. `worklenz-frontend/src/components/schedule/grant-chart/project-timeline-bar.tsx`
8. `worklenz-frontend/src/components/schedule/grant-chart/GranttChart.tsx`
9. `worklenz-frontend/src/api/schedule/scheduleApi.ts`

---

## 🎨 UI/UX Mockup (Capacity Visualization)

```
┌─────────────────────────────────────────────────────────┐
│ Team Member    │ Mon 13 │ Tue 14 │ Wed 15 │ Thu 16 │... │
├─────────────────────────────────────────────────────────┤
│ John Doe       │ ████░░ │ ██████ │ ░░░░░░ │ ████░░ │... │
│                │  6/8h  │  8/8h  │ Time   │  6/8h  │    │
│                │  75%   │ 100%   │  Off   │  75%   │    │
│                │ 🟢     │ 🟡     │ 🔵     │ 🟢     │    │
├─────────────────────────────────────────────────────────┤
│ Jane Smith     │ ████████│████████│████████│██████░░│... │
│                │ 10/8h  │ 10/8h  │  9/8h  │  8/8h  │    │
│                │ 125%   │ 125%   │ 113%   │ 100%   │    │
│                │ 🔴     │ 🔴     │ 🔴     │ 🟡     │    │
└─────────────────────────────────────────────────────────┘

Legend:
🟢 Available (0-75%)
🟡 Fully Allocated (75-100%)
🔴 Over-Allocated (>100%)
🔵 Time-Off/Weekend
```

---

## 📚 Reference Documentation

**Created Documents:**
- `SCHEDULE_PROJECT_VIEW_ANALYSIS.md` - Complete analysis
- `SCHEDULE_PROJECT_VIEW_IMPLEMENTATION_PLAN.md` - Detailed plan
- `SCHEDULE_IMPLEMENTATION_STATUS.md` - Overall status
- `SCHEDULE_SETUP_GUIDE.md` - Setup instructions

**Database Schema:**
- `worklenz-backend/database/sql/1_tables.sql` - All tables
- `worklenz-backend/database/sql/4_functions.sql` - Functions

**Hello Bonsai Research:**
- [Resource Management](https://www.hellobonsai.com/resource-management)
- Features: Drag-drop, live capacity, time-off, budget tracking

---

## ✅ Success Criteria

Project View is complete when:
- [ ] Daily capacity shows real-time utilization
- [ ] Color-coded indicators (green/yellow/red)
- [ ] Drag-drop to reschedule allocations
- [ ] Resize to adjust hours/duration
- [ ] Time-off blocks calendar automatically
- [ ] Over-allocation warnings appear
- [ ] Real-time updates across users
- [ ] Performance: <2s load for 50 members, 30 days

---

## 🚀 Quick Start Command

```bash
# 1. Create capacity calculation function
psql -U postgres -d worklenz -f worklenz-backend/database/sql/migrations/20260114000000-capacity-function.sql

# 2. Start development
cd worklenz-backend && npm run dev
cd worklenz-frontend && npm run dev

# 3. Test capacity endpoint
curl http://localhost:3000/api/schedule-gannt-v2/capacity/daily?startDate=2026-01-13&endDate=2026-02-13
```

---

**Next Action:** Start with Feature #1 (Live Capacity Tracking) - highest impact, foundational for other features.
