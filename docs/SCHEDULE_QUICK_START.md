# 🚀 Schedule Feature - Quick Start Guide

**Time to Complete:** ~5 minutes  
**Status:** All code complete, just needs database setup

---

## ✅ Step 1: Run Database Migration (2 minutes)

```bash
# Navigate to backend directory
cd worklenz-backend

# Run the migration
psql -U your_postgres_user -d your_database_name -f database/sql/migrations/run_member_time_off_migration.sql
```

**Replace:**
- `your_postgres_user` with your PostgreSQL username (e.g., `postgres`)
- `your_database_name` with your Worklenz database name

**Expected Output:**
```
NOTICE:  Creating member_time_off table...
NOTICE:  member_time_off table created successfully!
           status           
----------------------------
 ✓ member_time_off table exists
```

---

## ✅ Step 2: Install Frontend Dependencies (2 minutes)

```bash
# Navigate to frontend directory
cd worklenz-frontend

# Install the Gantt chart library
npm install gantt-task-react

# Verify installation
npm list gantt-task-react
```

**Expected Output:**
```
worklenz-frontend@x.x.x
└── gantt-task-react@0.3.9
```

---

## ✅ Step 3: Start the Application (1 minute)

```bash
# Start backend (from worklenz-backend directory)
npm start
# or
npm run dev

# Start frontend (from worklenz-frontend directory)
npm start
# or
npm run dev
```

---

## ✅ Step 4: Test the Features (2 minutes)

### Test 1: Access Schedule Page
1. Navigate to: `http://localhost:3000/schedule` (or your app URL)
2. ✅ Page should load without errors
3. ✅ You should see Week/Month toggle
4. ✅ You should see Project View / Task View toggle

### Test 2: Switch to Task View
1. Click the "Task View" radio button
2. ✅ Gantt chart should appear
3. ✅ Filter bar should be visible
4. ✅ "Time-Off" button should be visible

### Test 3: Open Time-Off Management
1. Click the "Time-Off" button
2. ✅ Modal should open
3. ✅ "Add Time-Off" button should be visible
4. ✅ No database errors in console

### Test 4: Create a Time-Off Entry
1. Click "Add Time-Off"
2. Select a team member
3. Select a date range
4. Add a reason (optional)
5. Click "Create"
6. ✅ Success message should appear
7. ✅ Entry should appear in the table

---

## 🎉 Success!

If all 4 tests passed, your Schedule feature is **fully operational**!

---

## 🐛 Troubleshooting

### Error: "relation 'member_time_off' does not exist"
**Solution:** Run the database migration (Step 1)

### Error: "Cannot find module 'gantt-task-react'"
**Solution:** Install the package (Step 2)

### Error: Tasks not showing in timeline
**Cause:** Tasks need both start_date and end_date
**Solution:** Add dates to your tasks in the task management view

---

## 📚 Full Documentation

For detailed information, see:
- **Setup Guide:** `SCHEDULE_SETUP_GUIDE.md`
- **Implementation Status:** `SCHEDULE_IMPLEMENTATION_STATUS.md`
- **Verification Script:** Run `node scripts/verify-schedule-setup.js`

---

## 🎯 What You Can Do Now

✅ **View Schedule:** See team schedule in week/month format  
✅ **Task Timeline:** View and manage tasks in Gantt chart  
✅ **Drag-Drop:** Reschedule tasks by dragging  
✅ **Time-Off:** Track team member availability  
✅ **Workload:** Monitor resource utilization  
✅ **Filters:** Filter by project, member, status, priority  
✅ **Real-Time:** See updates from other users instantly  

---

## 🚀 Next Features to Explore

After basic setup, explore these advanced features:

1. **Workload Management**
   - Click on a team member in Project View
   - View utilization statistics
   - Manage project allocations

2. **Conflict Detection**
   - Try scheduling tasks during time-off periods
   - See automatic conflict warnings

3. **Real-Time Collaboration**
   - Open schedule in two browser windows
   - Make changes in one window
   - See updates appear in the other

---

**That's it! You're ready to use the Schedule feature.** 🎉
