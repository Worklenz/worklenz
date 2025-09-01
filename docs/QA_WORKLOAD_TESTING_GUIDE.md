# QA Testing Guide: Workload Feature Updates

## Overview
This document outlines the changes made to the Project Workload feature and provides comprehensive testing scenarios for QA validation.

## 📋 Changes Made

### 1. UI/UX Changes
- **Removed Export Button**: Export functionality has been hidden from the workload filters
- **Removed Settings Button**: Settings functionality has been hidden from the workload filters
- **Added Working Days Selection**: New checkbox controls to configure working days in the filters

### 2. Internationalization (i18n)
- **Removed All Hardcoded Text**: All user-facing strings now use translation keys
- **Added New Translation Keys**: Added support for error messages, retry buttons, and working days
- **Multi-language Support**: Updated all 6 supported languages (English, German, Spanish, Portuguese, Chinese, Albanian)

### 3. State Management
- **Enhanced Redux Store**: Added working days configuration to project workload state
- **New Actions**: Added `setWorkingDays` and `toggleWorkingDay` actions
- **Filter Integration**: Working days selection affects active filter count

---

## 🧪 Test Scenarios

### A. Visual UI Tests

#### A1. Filter Button Verification
**Objective**: Verify export and settings buttons are hidden

**Steps**:
1. Navigate to any project's Workload tab
2. Look at the filter toolbar (top right area)
3. **Expected**: Only see Date Range dropdown, Filters button, and Refresh button
4. **Expected**: Export and Settings buttons should NOT be visible

**Test Cases**:
- [ ] Export button is not visible
- [ ] Settings button is not visible  
- [ ] Refresh button is still present and functional
- [ ] Date range dropdown is still present and functional
- [ ] Filters button is still present and functional

#### A2. Working Days Filter UI
**Objective**: Test the new working days selection interface

**Steps**:
1. Navigate to project Workload tab
2. Click the "Filters" button (with badge)
3. Scroll down in the filter popup
4. Look for "Working Days" section

**Expected Results**:
- [ ] "Working Days" section is visible with label
- [ ] 7 checkboxes for each day of the week are present
- [ ] Monday-Friday should be checked by default
- [ ] Saturday-Sunday should be unchecked by default
- [ ] Each checkbox shows correct day names in current language

### B. Working Days Functionality Tests

#### B1. Individual Day Toggle
**Objective**: Test toggling individual working days

**Steps**:
1. Open Filters popup
2. Uncheck "Monday"
3. Check "Saturday" 
4. Apply filters (click outside popup)
5. Reopen filters popup

**Expected Results**:
- [ ] Monday remains unchecked
- [ ] Saturday remains checked
- [ ] Changes persist when reopening filters
- [ ] Filter badge count increases when working days differ from default

#### B2. Filter Badge Count
**Objective**: Verify filter badge reflects working days changes

**Steps**:
1. Open filters, note current badge count
2. Change any working day (e.g., uncheck Friday)
3. Close filters popup
4. Observe filter badge number

**Expected Results**:
- [ ] Badge count increases by 1 when working days change from default
- [ ] Badge count decreases by 1 when working days return to default (Mon-Fri)

#### B3. Clear All Filters
**Objective**: Test that "Clear All Filters" resets working days

**Steps**:
1. Open filters
2. Change some working days (e.g., check Saturday, uncheck Wednesday)
3. Click "Clear All Filters" button
4. Observe working days checkboxes

**Expected Results**:
- [ ] Working days reset to default (Monday-Friday checked, weekends unchecked)
- [ ] All other filters are also cleared
- [ ] Filter badge count returns to 0

### C. Internationalization Tests

#### C1. Language Switching Test
**Objective**: Test working days display in different languages

**Steps**:
1. Change application language to German
2. Open workload filters
3. Check working days section
4. Repeat for Spanish, Portuguese, Chinese, Albanian

**Expected Results**:
- [ ] **German**: Montag, Dienstag, Mittwoch, Donnerstag, Freitag, Samstag, Sonntag
- [ ] **Spanish**: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo  
- [ ] **Portuguese**: Segunda-feira, Terça-feira, Quarta-feira, Quinta-feira, Sexta-feira, Sábado, Domingo
- [ ] **Chinese**: 星期一, 星期二, 星期三, 星期四, 星期五, 星期六, 星期日
- [ ] **Albanian**: E hënë, E martë, E mërkurë, E enjte, E premte, E shtunë, E diel
- [ ] "Working Days" label is translated in each language

#### C2. Error Messages Translation
**Objective**: Test error scenarios show translated text

**Steps**:
1. Switch to different languages
2. Simulate network error or data loading failure
3. Check error messages and retry buttons

**Expected Results**:
- [ ] Error messages display in selected language
- [ ] "Retry" button text is translated
- [ ] "Refresh Data" button text is translated
- [ ] No English text appears when other languages are selected

### D. Data Integration Tests

#### D1. Workload Data Loading
**Objective**: Ensure workload data loads correctly with new changes

**Steps**:
1. Navigate to project with team members and tasks
2. Switch between Chart, Calendar, and Table views
3. Change working days and observe any impacts
4. Refresh data and verify persistence

**Expected Results**:
- [ ] All workload views (Chart, Calendar, Table) load data correctly
- [ ] Working days changes don't break data loading
- [ ] Data refresh functionality works correctly
- [ ] View switching works smoothly

#### D2. Filter Combination Testing
**Objective**: Test working days with other filters

**Steps**:
1. Apply multiple filters (e.g., show overallocated members)
2. Change working days
3. Apply date range filters
4. Test various combinations

**Expected Results**:
- [ ] Working days filter works in combination with other filters
- [ ] No filter conflicts or errors occur
- [ ] Filter badge count reflects all active filters accurately

### E. Performance & Regression Tests

#### E1. Filter Performance
**Objective**: Ensure filter performance is not degraded

**Steps**:
1. Open filters popup multiple times
2. Toggle working days rapidly
3. Apply/clear filters repeatedly
4. Monitor for slowness or memory leaks

**Expected Results**:
- [ ] Filter popup opens quickly
- [ ] Checkbox toggles are responsive
- [ ] No performance degradation observed
- [ ] No browser console errors

#### E2. Backward Compatibility
**Objective**: Test existing workload functionality still works

**Steps**:
1. Test all existing workload features:
   - Overview metrics display
   - Chart view sorting and display
   - Calendar view task display  
   - Table view expansion and actions
   - Date range selection
   - Member utilization calculations

**Expected Results**:
- [ ] All existing functionality works as before
- [ ] No regressions in workload calculations
- [ ] Charts and visualizations display correctly
- [ ] User interactions remain smooth

---

## 🐛 Common Issues to Watch For

### Critical Issues
- [ ] **Missing translations**: Any English text appearing when other languages selected
- [ ] **Broken filters**: Working days changes breaking other filter functionality  
- [ ] **Data loading errors**: New changes causing workload data to fail loading
- [ ] **UI layout issues**: Filter popup layout broken or checkboxes misaligned

### Minor Issues
- [ ] **Filter badge count**: Badge not updating correctly when working days change
- [ ] **State persistence**: Working days not remembering selection after navigation
- [ ] **Checkbox styling**: Working days checkboxes not following design system

### Browser Compatibility
Test on the following browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)  
- [ ] Edge (latest)

---

## 🎯 Acceptance Criteria

The workload feature changes are ready for production when:

✅ **All UI changes implemented correctly**:
- Export and Settings buttons are hidden
- Working days selection is functional and intuitive

✅ **Full internationalization support**:
- All 6 languages display working days correctly
- No hardcoded English text remains
- Error messages are translated

✅ **No regressions introduced**:
- Existing workload functionality works unchanged
- Performance is maintained
- Data accuracy is preserved

✅ **Cross-browser compatibility**:
- Feature works consistently across major browsers
- No JavaScript errors in browser console

---

## 📝 Test Reporting

When reporting issues, please include:
1. **Browser & Version**
2. **Language Setting** 
3. **Steps to Reproduce**
4. **Expected vs Actual Results**
5. **Screenshots** (especially for UI issues)
6. **Console Errors** (if any)

---

## 🔍 Files Modified

For reference, the following files were changed:
- `ProjectViewWorkload.tsx` - Main workload component
- `WorkloadFilters.tsx` - Filter controls and working days selection  
- `WorkloadOverview.tsx` - Fixed tooltip translation
- `projectWorkloadSlice.ts` - Redux state management
- All locale files (`en/`, `de/`, `es/`, `pt/`, `zh/`, `alb/`) - Translation updates

---

**Document Version**: 1.0  
**Last Updated**: {{date}}  
**Contact**: Development Team for technical questions