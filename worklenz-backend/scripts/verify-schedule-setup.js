#!/usr/bin/env node

/**
 * Schedule Feature Setup Verification Script
 * 
 * This script checks if all required components for the Schedule feature are properly set up.
 * Run this after completing the setup guide to verify everything is working.
 * 
 * Usage:
 *   node scripts/verify-schedule-setup.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}`),
};

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
let warnings = 0;

function check(condition, successMsg, errorMsg) {
  totalChecks++;
  if (condition) {
    log.success(successMsg);
    passedChecks++;
    return true;
  } else {
    log.error(errorMsg);
    failedChecks++;
    return false;
  }
}

function warn(msg) {
  log.warning(msg);
  warnings++;
}

function fileExists(filePath) {
  try {
    return fs.existsSync(path.resolve(__dirname, '..', filePath));
  } catch {
    return false;
  }
}

function checkFileContent(filePath, searchString) {
  try {
    const content = fs.readFileSync(path.resolve(__dirname, '..', filePath), 'utf8');
    return content.includes(searchString);
  } catch {
    return false;
  }
}

// ============================================
// Main Verification
// ============================================

console.log(`
╔════════════════════════════════════════════════════════════╗
║   Schedule Feature Setup Verification                      ║
║   Worklenz Project Management System                       ║
╚════════════════════════════════════════════════════════════╝
`);

// ============================================
// 1. Backend Files Check
// ============================================
log.section('📁 Backend Files');

check(
  fileExists('src/controllers/schedule-v2/schedule-controller.ts'),
  'ScheduleControllerV2 exists',
  'ScheduleControllerV2 not found'
);

check(
  fileExists('src/controllers/schedule-v2/task-timeline-controller.ts'),
  'TaskTimelineController exists',
  'TaskTimelineController not found'
);

check(
  fileExists('src/controllers/schedule-v2/time-off-controller.ts'),
  'TimeOffController exists',
  'TimeOffController not found'
);

check(
  fileExists('src/routes/apis/gannt-apis/schedule-api-v2-router.ts'),
  'Schedule API router exists',
  'Schedule API router not found'
);

// ============================================
// 2. Database Migration Files
// ============================================
log.section('🗄️  Database Migration Files');

check(
  fileExists('database/sql/migrations/add_member_time_off_table.sql'),
  'member_time_off migration file exists',
  'member_time_off migration file not found'
);

check(
  fileExists('database/sql/migrations/run_member_time_off_migration.sql'),
  'Migration runner script exists',
  'Migration runner script not found'
);

// ============================================
// 3. Frontend Files Check
// ============================================
log.section('🎨 Frontend Files');

const frontendBase = '../worklenz-frontend/src';

check(
  fileExists(`${frontendBase}/pages/schedule/schedule.tsx`),
  'Schedule page component exists',
  'Schedule page component not found'
);

check(
  fileExists(`${frontendBase}/components/schedule/task-timeline/TaskTimelineView.tsx`),
  'TaskTimelineView component exists',
  'TaskTimelineView component not found'
);

check(
  fileExists(`${frontendBase}/components/schedule/task-timeline/index.tsx`),
  'Task timeline index export exists',
  'Task timeline index export not found - THIS IS CRITICAL!'
);

check(
  fileExists(`${frontendBase}/components/schedule/task-timeline/TaskTimelineFilters.tsx`),
  'TaskTimelineFilters component exists',
  'TaskTimelineFilters component not found'
);

check(
  fileExists(`${frontendBase}/components/schedule/task-timeline/TimeOffCalendar.tsx`),
  'TimeOffCalendar component exists',
  'TimeOffCalendar component not found'
);

check(
  fileExists(`${frontendBase}/components/schedule/task-timeline/taskTransformers.ts`),
  'Task transformers utility exists',
  'Task transformers utility not found'
);

check(
  fileExists(`${frontendBase}/features/schedule/WorkloadManagement.tsx`),
  'WorkloadManagement component exists',
  'WorkloadManagement component not found'
);

check(
  fileExists(`${frontendBase}/api/schedule/scheduleApi.ts`),
  'Schedule RTK Query API exists',
  'Schedule RTK Query API not found'
);

check(
  fileExists(`${frontendBase}/features/schedule/scheduleSlice.ts`),
  'Schedule Redux slice exists',
  'Schedule Redux slice not found'
);

// ============================================
// 4. Route Registration Check
// ============================================
log.section('🔌 Route Registration');

const routesRegistered = checkFileContent(
  'src/routes/apis/index.ts',
  'schedule-api-v2-router'
);

check(
  routesRegistered,
  'Schedule routes registered in main API router',
  'Schedule routes NOT registered - Add to src/routes/apis/index.ts'
);

// ============================================
// 5. Import Checks
// ============================================
log.section('📦 Import Statements');

const schedulePageImport = checkFileContent(
  `${frontendBase}/pages/schedule/schedule.tsx`,
  "from '@/components/schedule/task-timeline'"
);

check(
  schedulePageImport,
  'TaskTimelineView imported in schedule page',
  'TaskTimelineView import missing in schedule page'
);

// ============================================
// 6. Configuration Checks
// ============================================
log.section('⚙️  Configuration');

// Check if view mode toggle is uncommented
const viewModeEnabled = checkFileContent(
  `${frontendBase}/pages/schedule/schedule.tsx`,
  '<Radio.Group'
) && !checkFileContent(
  `${frontendBase}/pages/schedule/schedule.tsx`,
  '{/* <Radio.Group'
);

check(
  viewModeEnabled,
  'View mode toggle is enabled',
  'View mode toggle is commented out'
);

// ============================================
// 7. Documentation Check
// ============================================
log.section('📚 Documentation');

check(
  fileExists('SCHEDULE_SETUP_GUIDE.md'),
  'Setup guide exists',
  'Setup guide not found'
);

// ============================================
// Summary
// ============================================
log.section('📊 Verification Summary');

console.log(`
Total Checks:   ${totalChecks}
Passed:         ${colors.green}${passedChecks}${colors.reset}
Failed:         ${colors.red}${failedChecks}${colors.reset}
Warnings:       ${colors.yellow}${warnings}${colors.reset}
`);

if (failedChecks === 0) {
  console.log(`${colors.green}
╔════════════════════════════════════════════════════════════╗
║   ✓ ALL CHECKS PASSED!                                     ║
║                                                            ║
║   Your Schedule feature setup is complete.                 ║
║                                                            ║
║   Next Steps:                                              ║
║   1. Run database migration (see SCHEDULE_SETUP_GUIDE.md)  ║
║   2. Install frontend dependencies (gantt-task-react)      ║
║   3. Start the application and test features               ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);
  process.exit(0);
} else {
  console.log(`${colors.red}
╔════════════════════════════════════════════════════════════╗
║   ✗ SETUP INCOMPLETE                                       ║
║                                                            ║
║   ${failedChecks} check(s) failed. Please review the errors above.  ║
║                                                            ║
║   Refer to SCHEDULE_SETUP_GUIDE.md for detailed setup     ║
║   instructions.                                            ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);
  process.exit(1);
}
