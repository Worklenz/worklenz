# 🧪 Schedule Phase 2: Testing Guide

**Purpose:** Verify that capacity tracking frontend integration works correctly  
**Time Required:** 30-45 minutes  
**Prerequisites:** Backend migration completed, frontend built

---

## 🚀 Quick Start

### 1. Start the Application

```bash
# Terminal 1: Start Backend
cd worklenz-backend
npm run dev

# Terminal 2: Start Frontend
cd worklenz-frontend
npm start
```

### 2. Navigate to Schedule Page

Open browser: `http://localhost:3000/schedule`

---

## ✅ Test Scenarios

### Test 1: Basic Capacity Display

**Goal:** Verify capacity colors display correctly

**Steps:**
1. Open schedule page
2. Look at the Gantt chart cells
3. Verify cells show different colors based on utilization

**Expected Results:**
- 🟢 Green cells: Members with <75% utilization (available)
- 🔵 Blue cells: Members with 75-100% utilization (normal)
- 🟡 Yellow cells: Members with exactly 100% utilization (fully allocated)
- 🔴 Red cells: Members with >100% utilization (over-allocated)
- ⚪ Gray cells: Weekends or time-off days

**Pass Criteria:** ✅ Colors display correctly based on utilization

---

### Test 2: Tooltip Information

**Goal:** Verify tooltips show detailed capacity information

**Steps:**
1. Hover over any colored cell
2. Wait for tooltip to appear
3. Check tooltip content

**Expected Results:**
Tooltip should show:
- Member name and date
- Working hours (e.g., "8h")
- Allocated hours (e.g., "6.5h")
- Available hours (e.g., "1.5h")
- Utilization percentage (e.g., "81%")
- Status (e.g., "NORMAL")
- Project breakdown (if allocated):
  - Project name with color dot
  - Hours allocated per project

**Pass Criteria:** ✅ All information displays correctly and is accurate

---

### Test 3: Over-Allocation Warning

**Goal:** Verify over-allocation indicators work

**Steps:**
1. Find a member with >100% utilization (red cell)
2. Check for visual warning indicators
3. Hover to see tooltip

**Expected Results:**
- Red/yellow striped bar at top of cell
- Bold red text for utilization percentage
- Red status indicator dot in bottom-right
- Tooltip shows "OVERALLOCATED" status
- Tooltip shows over-allocation amount

**Pass Criteria:** ✅ Over-allocation is clearly visible and detailed

---

### Test 4: Conflicts Alert

**Goal:** Verify conflicts alert appears when members are over-allocated

**Steps:**
1. Look at top of schedule page
2. Check for warning alert banner
3. Click to expand conflict details

**Expected Results:**
- Yellow warning alert appears if conflicts exist
- Shows count of conflicts with red badge
- Expandable panel shows:
  - Number of high/medium severity conflicts
  - List of over-allocated members
  - Date and over-allocation hours for each

**Pass Criteria:** ✅ Alert appears and shows accurate conflict information

---

### Test 5: Weekend Handling

**Goal:** Verify weekends display correctly

**Steps:**
1. Find weekend columns (Saturday/Sunday)
2. Check cell appearance
3. Hover to see tooltip

**Expected Results:**
- Gray background color
- Dash "-" symbol in center
- Tooltip shows "Weekend"
- No capacity percentage shown

**Pass Criteria:** ✅ Weekends are clearly distinguished from workdays

---

### Test 6: Time-Off Handling

**Goal:** Verify time-off days display correctly

**Steps:**
1. Add a time-off entry for a member (if not already present)
2. Find the time-off day in schedule
3. Check cell appearance

**Expected Results:**
- Gray background color
- Blue circle "🔵" emoji indicator
- Tooltip shows "Time Off"
- No capacity percentage shown

**Pass Criteria:** ✅ Time-off days are clearly marked

---

### Test 7: Date Range Changes

**Goal:** Verify capacity updates when changing date range

**Steps:**
1. Note current capacity colors
2. Click "Week" or "Month" view toggle
3. Change date using date picker
4. Verify capacity data updates

**Expected Results:**
- Capacity colors update immediately
- No loading errors
- Data matches new date range
- Tooltips show correct dates

**Pass Criteria:** ✅ Capacity data refreshes correctly on date changes

---

### Test 8: Dark Mode Compatibility

**Goal:** Verify capacity display works in dark mode

**Steps:**
1. Toggle dark mode (if available)
2. Check capacity cell colors
3. Check tooltip readability
4. Check conflicts alert appearance

**Expected Results:**
- Colors are visible and distinguishable in dark mode
- Tooltips have proper contrast
- Text is readable
- Alert banner is visible

**Pass Criteria:** ✅ All elements are visible and readable in dark mode

---

### Test 9: Performance Test

**Goal:** Verify performance with realistic data

**Steps:**
1. Load schedule with 20+ team members
2. Set date range to 30 days (month view)
3. Measure page load time
4. Scroll through timeline
5. Hover over multiple cells

**Expected Results:**
- Initial load: <2 seconds
- Smooth scrolling (no lag)
- Tooltips appear instantly (<100ms)
- No browser console errors
- No memory leaks (check DevTools)

**Pass Criteria:** ✅ Performance meets targets, no lag or errors

---

### Test 10: Error Handling

**Goal:** Verify graceful error handling

**Steps:**
1. Stop backend server
2. Refresh schedule page
3. Check error display
4. Restart backend
5. Verify recovery

**Expected Results:**
- No crashes or blank screens
- Friendly error message (if any)
- Graceful fallback to empty state
- Automatic recovery when backend returns

**Pass Criteria:** ✅ Errors handled gracefully, no crashes

---

## 🐛 Common Issues & Solutions

### Issue: No capacity colors showing

**Possible Causes:**
- Backend migration not run
- API endpoint not responding
- CORS errors

**Solutions:**
1. Check browser console for errors
2. Verify backend is running: `curl http://localhost:3000/api/schedule-gannt-v2/capacity/daily?startDate=2026-01-13&endDate=2026-02-13`
3. Run migration: `psql -U postgres -d worklenz -f worklenz-backend/database/sql/migrations/20260114000000-capacity-calculation-function.sql`

---

### Issue: Tooltips not appearing

**Possible Causes:**
- Ant Design Tooltip not imported
- Z-index conflicts
- Hover events blocked

**Solutions:**
1. Check browser console for errors
2. Verify Tooltip import in day-allocation-cell.tsx
3. Check CSS for z-index conflicts

---

### Issue: Conflicts alert not showing

**Possible Causes:**
- No over-allocated members in current date range
- API endpoint not responding
- Component not imported

**Solutions:**
1. Verify over-allocated members exist: `curl http://localhost:3000/api/schedule-gannt-v2/capacity/conflicts?startDate=2026-01-13&endDate=2026-02-13`
2. Check CapacityConflictsAlert is imported in GranttChart.tsx
3. Check browser console for errors

---

### Issue: Performance is slow

**Possible Causes:**
- Too many team members (>100)
- Date range too large (>60 days)
- Database query slow

**Solutions:**
1. Limit date range to 30 days
2. Check database indexes exist
3. Use React DevTools Profiler to identify bottlenecks
4. Verify React.memo is applied to DayAllocationCell

---

## 📊 Test Results Template

Copy this template to document your test results:

```markdown
## Test Results - [Date]

### Environment
- Browser: [Chrome/Firefox/Safari]
- OS: [Windows/Mac/Linux]
- Backend Version: [version]
- Frontend Version: [version]

### Test Results

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Basic Capacity Display | ✅ PASS | Colors display correctly |
| 2 | Tooltip Information | ✅ PASS | All data accurate |
| 3 | Over-Allocation Warning | ✅ PASS | Indicators clear |
| 4 | Conflicts Alert | ✅ PASS | Alert appears correctly |
| 5 | Weekend Handling | ✅ PASS | Weekends marked properly |
| 6 | Time-Off Handling | ✅ PASS | Time-off visible |
| 7 | Date Range Changes | ✅ PASS | Data refreshes correctly |
| 8 | Dark Mode | ✅ PASS | All elements visible |
| 9 | Performance | ✅ PASS | Load time <2s |
| 10 | Error Handling | ✅ PASS | No crashes |

### Issues Found
- [List any issues discovered]

### Overall Status
- [ ] All tests passed - Ready for production
- [ ] Some tests failed - Needs fixes
- [ ] Major issues found - Needs rework

### Tester
- Name: [Your name]
- Date: [Test date]
```

---

## ✅ Sign-Off Checklist

Before marking Phase 2 as complete:

- [ ] All 10 test scenarios passed
- [ ] No console errors in browser
- [ ] No TypeScript compilation errors
- [ ] Performance meets targets (<2s load)
- [ ] Dark mode works correctly
- [ ] Tooltips are accurate and helpful
- [ ] Over-allocation warnings are clear
- [ ] Conflicts alert works properly
- [ ] Date range changes work smoothly
- [ ] Error handling is graceful

---

## 🎯 Next Steps After Testing

### If All Tests Pass:
1. Mark Phase 2 as complete ✅
2. Deploy to staging environment
3. Begin Phase 3 planning (Drag-and-Drop)
4. Update project documentation

### If Tests Fail:
1. Document issues in test results template
2. Create bug tickets for each issue
3. Prioritize fixes (critical/high/medium/low)
4. Fix issues and re-test
5. Repeat until all tests pass

---

**Happy Testing! 🚀**

For questions or issues, refer to:
- `docs/SCHEDULE_PHASE2_COMPLETION_SUMMARY.md`
- `docs/QUICK_REFERENCE_CAPACITY_API.md`
- `docs/SCHEDULE_PHASE2_FRONTEND_INTEGRATION.md`
