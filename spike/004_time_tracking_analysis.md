# Kill-Shot Spike 1f: Time Tracking 15-Min Increment Analysis

## Worklenz Current Implementation

**Storage:** `task_work_log.time_spent` — NUMERIC type, stores **seconds**

**Input methods:**
1. **Timer-based** — Socket.IO start/stop, logs exact seconds elapsed
2. **Manual entry** — User enters hours/minutes, converted to seconds via `toSeconds()` util

**Key finding:** Worklenz stores raw seconds with no increment enforcement. The NUMERIC type
supports decimal values. There is NO built-in rounding or increment validation.

## PPM Requirement

PPM needs 15-minute (900 second) increments for retainer billing:
- 0:15, 0:30, 0:45, 1:00, 1:15, etc.
- Display as "Xh XXm" format
- Retainer rollup must sum in 15-min increments

## Assessment: Extension Needed (but small)

**Timer-based logging:** Timer captures exact seconds. PPM extension rounds UP to nearest
15-min increment when logging. This is a validation wrapper, not a core change.

**Manual entry:** PPM form uses a dropdown/stepper for 15-min increments instead of free-text
minutes input. Frontend-only change in PPM components.

**Implementation plan (ppm_ extension, no core changes):**

1. **Backend validation middleware** (`src/ppm/middleware/time-increment-validator.ts`):
   ```typescript
   // Round seconds_spent up to nearest 900 (15 min)
   const rounded = Math.ceil(seconds_spent / 900) * 900;
   ```

2. **PPM time log wrapper** (`src/ppm/routes/ppm-time-log.ts`):
   - Wraps existing `POST /api/v1/task-time-log`
   - Applies 15-min rounding before forwarding to Worklenz controller
   - Stores rounded value in task_work_log AND updates ppm_deliverables.actual_hours

3. **Frontend increment selector** (`src/components/ppm/time-log-increment.tsx`):
   - Dropdown: 0:15, 0:30, 0:45, 1:00, ... up to 8:00
   - Replaces free-text minutes input for PPM users

4. **Retainer rollup query:**
   ```sql
   SELECT SUM(time_spent) / 3600.0 AS total_hours
   FROM task_work_log
   WHERE task_id IN (
       SELECT worklenz_task_id FROM ppm_deliverables
       WHERE client_id = $1
   )
   -- Already in 15-min increments due to validation
   ```

## Verdict: PASS — Small PPM Extension

No Worklenz core files need modification. The 15-min increment enforcement is:
- A validation middleware (new file)
- A wrapper route (new file)
- A frontend component (new file)

**Worklenz core files touched: 0**
