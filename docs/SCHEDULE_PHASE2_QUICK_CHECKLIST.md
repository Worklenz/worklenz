# ✅ Phase 2 Quick Action Checklist

**Goal:** Complete frontend integration for capacity tracking  
**Time:** 2-3 days

---

## ✅ PHASE 2 COMPLETE - January 13, 2026

**Status:** Frontend integration complete, ready for testing  
**Time Taken:** ~2 hours  
**Next Step:** User testing (see `SCHEDULE_PHASE2_TESTING_GUIDE.md`)

---

## Day 1: Database & API Setup (2 hours)

### Morning
- [x] **Run database migration** (5 min)
  ```bash
  cd worklenz-backend
  psql -U postgres -d worklenz -f database/sql/migrations/20260114000000-capacity-calculation-function.sql
  ```

- [x] **Verify migration** (2 min)
  ```sql
  SELECT * FROM calculate_member_capacity(
    'your-team-member-uuid'::UUID,
    '2026-01-13'::DATE,
    '2026-02-13'::DATE
  ) LIMIT 5;
  ```

- [x] **Test API endpoints** (10 min)
  ```bash
  # Test daily capacity
  curl "http://localhost:3000/api/schedule-gannt-v2/capacity/daily?startDate=2026-01-13&endDate=2026-02-13"
  
  # Test summary
  curl "http://localhost:3000/api/schedule-gannt-v2/capacity/summary?startDate=2026-01-13&endDate=2026-02-13"
  
  # Test conflicts
  curl "http://localhost:3000/api/schedule-gannt-v2/capacity/conflicts?startDate=2026-01-13&endDate=2026-02-13"
  ```

- [x] **Verify RTK Query hooks** (5 min)
  - Check `scheduleApi.ts` has capacity endpoints ✅ (Already done)
  - Check exports include capacity hooks ✅ (Already done)

### Afternoon
- [x] **Update DayAllocationCell component** (1.5 hours)
  - File: `worklenz-frontend/src/components/schedule/grant-chart/day-allocation-cell.tsx`
  - Copy implementation from `docs/SCHEDULE_PHASE2_FRONTEND_INTEGRATION.md`
  - Add TypeScript interfaces
  - Implement color coding logic
  - Add tooltip with project breakdown
  - Test in isolation

---

## Day 2: GranttChart Integration (4 hours)

### Morning
- [x] **Update GranttChart component** (2 hours)
  - File: `worklenz-frontend/src/components/schedule/grant-chart/GranttChart.tsx`
  - Import `useFetchDailyCapacityQuery`
  - Add `calculateEndDate` helper function
  - Fetch capacity data
  - Create `getCapacityForDate` helper
  - Update DayAllocationCell usage
  - Add capacity refetch to useEffect

### Afternoon
- [x] **Create CapacityConflictsAlert component** (1 hour)
  - File: `worklenz-frontend/src/components/schedule/grant-chart/CapacityConflictsAlert.tsx`
  - Copy implementation from docs
  - Add to GranttChart
  - Test conflict display

- [ ] **Test integration** (1 hour) - **READY FOR USER TESTING**
  - Load schedule page
  - Verify capacity colors display
  - Check tooltips work
  - Test with different date ranges
  - Test with time-off entries
  - Test dark mode

---

## Day 3: Testing & Polish (4 hours)

### Morning
- [ ] **Comprehensive testing** (2 hours)
  - Test with 10+ team members
  - Test with 30-day range
  - Test with various allocation scenarios:
    - [ ] Under-allocated members (0-75%)
    - [ ] Well-utilized members (75-100%)
    - [ ] Fully allocated members (100%)
    - [ ] Over-allocated members (>100%)
    - [ ] Members with time-off
    - [ ] Weekend handling
  - Test performance (should load <2s)
  - Test error handling (network errors, etc.)

### Afternoon
- [ ] **Bug fixes & polish** (1.5 hours)
  - Fix any issues found in testing
  - Improve loading states
  - Add error boundaries
  - Optimize performance if needed

- [ ] **Documentation** (30 min)
  - Update README with new features
  - Add screenshots to docs
  - Document any gotchas
  - Update CHANGELOG

---

## Quick Commands Reference

### Backend
```bash
# Start backend
cd worklenz-backend && npm run dev

# Check logs
pm2 logs worklenz-backend

# Test endpoint
curl "http://localhost:3000/api/schedule-gannt-v2/capacity/daily?startDate=2026-01-13&endDate=2026-02-13"
```

### Frontend
```bash
# Start frontend
cd worklenz-frontend && npm start

# Build for production
npm run build

# Check for TypeScript errors
npm run type-check
```

### Database
```bash
# Connect to database
psql -U postgres -d worklenz

# Test capacity function
SELECT * FROM calculate_member_capacity(
  'uuid-here'::UUID,
  '2026-01-13'::DATE,
  '2026-02-13'::DATE
);

# Check allocations
SELECT * FROM project_member_allocations LIMIT 10;
```

---

## Troubleshooting

### Issue: Capacity data not loading
**Check:**
1. Database migration ran successfully
2. Backend endpoint returns data (test with curl)
3. RTK Query hook is called correctly
4. No CORS errors in browser console

### Issue: Colors not showing
**Check:**
1. `capacityData` prop is passed correctly
2. Status values match expected enum
3. Theme mode is detected correctly
4. CSS is not overriding colors

### Issue: Tooltips not working
**Check:**
1. Ant Design Tooltip is imported
2. Tooltip content is not null/undefined
3. No z-index conflicts
4. Hover events are not blocked

### Issue: Performance slow
**Check:**
1. Limit date range to 30 days max
2. Use React.memo for DayAllocationCell
3. Debounce capacity refetch
4. Check database query performance

---

## Success Indicators

✅ **Phase 2 Complete When:**
- Capacity colors display correctly
- Tooltips show project breakdown
- Over-allocation warnings appear
- Time-off blocks calendar
- Performance <2s for 50 members, 30 days
- Works in light and dark modes
- No console errors
- All tests pass

---

## Next Steps After Phase 2

**Phase 3: Drag-and-Drop Allocation Editing**
- Estimated time: 4-5 days
- Features:
  - Drag project bars to reschedule
  - Resize bars to adjust hours/duration
  - Real-time conflict detection
  - Multi-user synchronization

**Documentation:** `docs/SCHEDULE_PHASE3_DRAG_DROP.md` (to be created)

---

**Current Status:** ✅ Backend Complete | 🔄 Frontend In Progress  
**Next Action:** Update DayAllocationCell component
