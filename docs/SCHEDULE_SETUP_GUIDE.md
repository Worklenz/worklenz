# 🚀 Schedule Feature Setup Guide

## Overview
This guide helps you complete the setup of the Schedule feature with Task Timeline and Time-Off management.

---

## ✅ Step 1: Database Migration (CRITICAL)

### Run the Time-Off Table Migration

The `member_time_off` table is required for time-off tracking functionality.

**Option A: Using psql command line**
```bash
# Navigate to backend directory
cd worklenz-backend

# Run the migration
psql -U your_username -d your_database_name -f database/sql/migrations/run_member_time_off_migration.sql
```

**Option B: Using pgAdmin or Database GUI**
1. Open your PostgreSQL client
2. Connect to your Worklenz database
3. Open and execute: `database/sql/migrations/run_member_time_off_migration.sql`

**Option C: Using Node.js script**
```bash
# From worklenz-backend directory
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('./database/sql/migrations/run_member_time_off_migration.sql', 'utf8');
pool.query(sql).then(() => {
  console.log('✓ Migration completed');
  pool.end();
}).catch(err => {
  console.error('✗ Migration failed:', err);
  pool.end();
});
"
```

### Verify Migration Success
```sql
-- Run this query to verify the table exists
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'member_time_off'
ORDER BY ordinal_position;
```

Expected output should show 9 columns: id, team_member_id, organization_id, start_date, end_date, reason, created_by, created_at, updated_at

---

## ✅ Step 2: Install Required Dependencies

### Frontend Dependencies

Check if these packages are installed:

```bash
cd worklenz-frontend
npm list gantt-task-react
```

If not installed:
```bash
npm install gantt-task-react
npm install --save-dev @types/gantt-task-react
```

### Verify Other Dependencies
```bash
# These should already be installed
npm list dayjs
npm list @reduxjs/toolkit
npm list react-redux
```

---

## ✅ Step 3: Verify Backend Routes

Ensure the schedule routes are registered in the main API router.

**File:** `worklenz-backend/src/routes/apis/index.ts`

Should contain:
```typescript
import scheduleApiRouter from "./gannt-apis/schedule-api-v2-router";

// ... other imports

apiRouter.use("/schedule-gannt-v2", scheduleApiRouter);
```

---

## ✅ Step 4: Frontend Configuration

### Check Redux Store Configuration

**File:** `worklenz-frontend/src/store/index.ts` (or similar)

Ensure the schedule API is registered:
```typescript
import { scheduleApi } from '@/api/schedule/scheduleApi';

export const store = configureStore({
  reducer: {
    // ... other reducers
    scheduleReducer: scheduleReducer,
    [scheduleApi.reducerPath]: scheduleApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(scheduleApi.middleware),
});
```

---

## ✅ Step 5: Test the Features

### 1. Test Schedule Page Access
```
Navigate to: /schedule
```
You should see:
- Week/Month view toggle
- Project View / Task View toggle
- Settings button
- Today button

### 2. Test Task Timeline View
1. Click "Task View" radio button
2. You should see:
   - Filter bar (Project, Team Member, Status, Priority, Date Range)
   - Time-Off button
   - Gantt chart with tasks grouped by project
   - Drag-drop functionality for task dates

### 3. Test Time-Off Management
1. Click "Time-Off" button in Task Timeline view
2. Modal should open with:
   - "Add Time-Off" button
   - Table showing existing time-off entries
3. Click "Add Time-Off"
4. Fill form:
   - Select team member
   - Select date range
   - Add optional reason
5. Click "Create"
6. Verify entry appears in table

### 4. Test Workload Management
1. In Project View, click on a team member
2. Drawer should open with tabs:
   - Schedule
   - Workload Management ← Test this
   - Time Tracking (coming soon)
   - Capacity (coming soon)
3. In Workload Management tab:
   - Overview: Shows utilization stats
   - Resource Allocation: Manage project hours
   - Load Balancing: Auto-rebalance features

---

## 🐛 Troubleshooting

### Issue: "member_time_off table does not exist"
**Solution:** Run the database migration (Step 1)

### Issue: "Cannot find module 'gantt-task-react'"
**Solution:** Install the package:
```bash
cd worklenz-frontend
npm install gantt-task-react
```

### Issue: Task Timeline not showing
**Solution:** Check browser console for errors. Common causes:
1. Missing gantt-task-react package
2. Tasks have no dates (they'll be filtered out)
3. Date range filter is too narrow

### Issue: Time-Off modal not opening
**Solution:** 
1. Check if member_time_off table exists
2. Verify backend routes are registered
3. Check browser network tab for API errors

### Issue: Drag-drop not working
**Solution:**
1. Ensure tasks have both start_date and end_date
2. Check if user has permission to edit tasks
3. Verify Socket.IO connection for real-time updates

---

## 📊 Database Queries for Testing

### Check Time-Off Entries
```sql
SELECT 
    mto.*,
    u.name as member_name,
    u.email as member_email
FROM member_time_off mto
JOIN team_members tm ON mto.team_member_id = tm.id
JOIN users u ON tm.user_id = u.id
ORDER BY mto.start_date DESC;
```

### Check Tasks with Dates
```sql
SELECT 
    t.id,
    t.name,
    t.start_date,
    t.end_date,
    p.name as project_name,
    ts.name as status_name
FROM tasks t
JOIN projects p ON t.project_id = p.id
JOIN task_statuses ts ON t.status_id = ts.id
WHERE t.start_date IS NOT NULL 
  AND t.end_date IS NOT NULL
  AND t.archived = false
ORDER BY t.start_date DESC
LIMIT 20;
```

### Check Project Member Allocations
```sql
SELECT 
    pma.*,
    u.name as member_name,
    p.name as project_name,
    pma.seconds_per_day / 3600 as hours_per_day
FROM project_member_allocations pma
JOIN team_members tm ON pma.team_member_id = tm.id
JOIN users u ON tm.user_id = u.id
JOIN projects p ON pma.project_id = p.id
ORDER BY pma.allocated_from DESC
LIMIT 20;
```

---

## 🎯 Feature Checklist

Use this checklist to verify everything is working:

- [ ] Database migration completed successfully
- [ ] member_time_off table exists with proper indexes
- [ ] Frontend dependencies installed (gantt-task-react)
- [ ] Schedule page loads without errors
- [ ] Can toggle between Week/Month views
- [ ] Can toggle between Project/Task views
- [ ] Task Timeline displays tasks grouped by project
- [ ] Can filter tasks by project, member, status, priority
- [ ] Can drag-drop tasks to change dates
- [ ] Time-Off modal opens and displays entries
- [ ] Can create new time-off entries
- [ ] Can edit existing time-off entries
- [ ] Can delete time-off entries
- [ ] Workload Management drawer opens
- [ ] Can view member utilization stats
- [ ] Can manage project allocations
- [ ] Real-time updates work (Socket.IO)

---

## 📝 Next Steps (Optional Enhancements)

After completing the setup, consider these enhancements:

1. **Add Task Conflict Warnings**
   - Visual indicators for overallocated members
   - Warnings when dragging tasks during time-off periods

2. **Capacity Planning Dashboard**
   - Implement the "Capacity" tab in ScheduleDrawer
   - Show future capacity forecasts

3. **Time Tracking Integration**
   - Implement the "Time Tracking" tab
   - Compare planned vs actual hours

4. **Export/Import Schedules**
   - Export schedule to CSV/Excel
   - Import bulk time-off entries

5. **Mobile Responsiveness**
   - Optimize Gantt chart for mobile devices
   - Add touch gestures for drag-drop

---

## 🆘 Support

If you encounter issues not covered in this guide:

1. Check browser console for JavaScript errors
2. Check backend logs for API errors
3. Verify database connection and table structure
4. Review the AGENTS.md file for coding standards
5. Check Socket.IO connection status

---

## ✨ Success!

Once all checklist items are complete, your Schedule feature is fully operational! 🎉

The feature includes:
- ✅ Project-based schedule view (existing)
- ✅ Task-based timeline view (new)
- ✅ Time-off management (new)
- ✅ Workload management (new)
- ✅ Real-time collaboration
- ✅ Drag-drop date management
- ✅ Conflict detection
- ✅ Resource allocation tracking
