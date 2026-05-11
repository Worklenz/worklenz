# Column Drag-and-Drop Width Issue - Fix Documentation

## Issue Description

### Problem Statement
When dragging a column to reorder it in the task list table, the dragged column would temporarily change its width to match the column it was hovering over. This created a jarring visual experience where:

- A narrow column (120px) would suddenly expand when dragged over a wider column (270px)
- A wide column would shrink when dragged over a narrower column
- The column would "jump" or "stretch" during the drag operation instead of maintaining its original size

### Expected Behavior
The dragged column should maintain its original width throughout the entire drag operation, regardless of which column it's hovering over. This is the standard behavior in data tables and spreadsheet applications.

### Actual Behavior
The dragged column was adopting the width of the underlying column during drag, causing visual instability and poor user experience.

---

## Root Cause Analysis

### Investigation Process
We added comprehensive debug logging to track the drag operation and discovered the following:

1. **CSS Variable Issue (Initial Hypothesis - Incorrect)**
   - Initially suspected CSS variables weren't being resolved properly
   - Debug logs showed `computedWidth: ''` (empty string)
   - This was a red herring - the real issue was elsewhere

2. **Transform Scaling (Actual Root Cause)**
   - Debug logs revealed: `transform: 'translate3d(98px, 0px, 0) scaleX(2.25) scaleY(1)'`
   - **The `scaleX(2.25)` was the culprit!**
   - dnd-kit was automatically applying scale transforms to match the drop target's dimensions
   - Example: 120px column × 2.25 = 270px (exactly the width of the target column)

### Why This Happened
The `@dnd-kit/sortable` library has built-in collision detection that applies scale transforms to provide visual feedback about where the item will be dropped. While this works well for list items, it's inappropriate for column headers where width should remain constant.

---

## The Solution

### Changes Made to `SortableHeader` Component

#### 1. Remove Scale from Transform
```typescript
// Before: Used transform directly from dnd-kit
const style = {
  transform: transform ? CSS.Transform.toString(transform) : undefined,
  // ... other styles
};

// After: Strip out scale, keep only translation
const transformWithoutScale = transform ? {
  ...transform,
  scaleX: 1,  // Override scale to 1 (no scaling)
  scaleY: 1,
} : null;

const style = {
  transform: transformWithoutScale ? CSS.Transform.toString(transformWithoutScale) : undefined,
  // ... other styles
};
```

**Why this works:** By setting `scaleX: 1` and `scaleY: 1`, we preserve the translation (movement) but eliminate the scaling effect that was causing the width changes.

#### 2. Use Explicit Pixel Widths
```typescript
// Before: Used CSS variables (which weren't being resolved during drag)
const style = {
  width: `var(--col-width-${column.id})`,
  minWidth: `var(--col-width-${column.id})`,
  maxWidth: `var(--col-width-${column.id})`,
  // ...
};

// After: Use explicit pixel values from column object
const explicitWidth = column.width; // e.g., "120px"

const style = {
  width: explicitWidth,
  minWidth: explicitWidth,
  maxWidth: explicitWidth,
  flexShrink: 0,
  // ...
};
```

**Why this works:** Explicit pixel values are immediately available and don't require CSS variable resolution, ensuring the width constraint is applied during the entire drag lifecycle.

#### 3. Disable Layout Animations
```typescript
// Before: Default dnd-kit behavior
const { ... } = useSortable({ id: column.id });

// After: Disable automatic layout changes
const { ... } = useSortable({ 
  id: column.id,
  animateLayoutChanges: () => false,
});
```

**Why this works:** Prevents dnd-kit from making automatic layout adjustments that could interfere with our explicit width constraints.

---

## Performance Improvements (Bonus Fixes)

While fixing the width issue, we also implemented several performance optimizations:

### 1. Memoization
```typescript
// Wrapped SortableHeader with React.memo
const SortableHeader: React.FC<...> = React.memo(({ column, isDropTarget, children }) => {
  // Component logic
});
```
**Benefit:** Prevents unnecessary re-renders of non-dragging columns during drag operations.

### 2. Throttled State Updates
```typescript
const handleColumnDragOver = useCallback((event: any) => {
  const newOverId = event?.over?.id || null;
  // Only update state if the value actually changed
  setOverColumnId(prev => prev === newOverId ? prev : newOverId);
}, []);
```
**Benefit:** Reduces redundant state updates and re-renders during drag.

### 3. CSS Performance Hints
```typescript
const style = {
  willChange: isDragging ? 'transform' : undefined,
  // ...
};
```

```css
[data-column-id] {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
```
**Benefit:** Hints to the browser to optimize transform animations using GPU acceleration.

### 4. Memoized Column IDs
```typescript
const reorderableColumnIds = useMemo(() => {
  return visibleColumns.filter(column => !column.isSticky).map(c => c.id);
}, [visibleColumns]);
```
**Benefit:** Prevents recalculation of reorderable column IDs on every render.

---

## Code Changes Summary

### File: `worklenz-frontend/src/components/task-list-v2/TaskListV2Table.tsx`

**Modified Component:** `SortableHeader`

**Key Changes:**
1. Added `animateLayoutChanges: () => false` to `useSortable` config
2. Created `transformWithoutScale` to override scale values
3. Changed from CSS variable widths to explicit pixel widths
4. Wrapped component with `React.memo`
5. Added performance optimizations (willChange, backface-visibility)

**Lines of Code Changed:** ~50 lines
**Files Modified:** 1 file

---

## Testing & Verification

### Test Scenarios
1. ✅ Drag narrow column (120px) over wide column (270px) - maintains 120px width
2. ✅ Drag wide column (270px) over narrow column (120px) - maintains 270px width
3. ✅ Drag column over multiple columns with varying widths - maintains original width
4. ✅ Column reordering still works correctly after drag
5. ✅ Performance is smooth with no lag or stutter
6. ✅ Works in both light and dark themes
7. ✅ Respects Ant Design theme tokens

### Debug Log Verification
**Before Fix:**
```
transform: 'translate3d(98px, 0px, 0) scaleX(2.25) scaleY(1)'
```

**After Fix:**
```
transform: 'translate3d(98px, 0px, 0) scaleX(1) scaleY(1)'
```

The `scaleX` is now always `1`, confirming the fix is working.

---

## Technical Details

### dnd-kit Library Behavior
- **Library:** `@dnd-kit/sortable` (part of dnd-kit ecosystem)
- **Default Behavior:** Applies scale transforms during drag for visual feedback
- **Use Case:** Works well for list items, cards, and other draggable elements
- **Problem:** Inappropriate for column headers where width must remain constant

### Transform Breakdown
```
translate3d(x, y, z) - Moves the element (this is good, we keep it)
scaleX(value)        - Scales width (this was the problem, we override to 1)
scaleY(value)        - Scales height (we also override to 1 for consistency)
```

### CSS Variables vs Explicit Values
- **CSS Variables:** `var(--col-width-progress)` - Requires browser resolution
- **Explicit Values:** `"120px"` - Immediately available, no resolution needed
- **During Drag:** Explicit values are more reliable for maintaining constraints

---

## Lessons Learned

1. **Debug Logging is Essential:** Without comprehensive logging, we wouldn't have discovered the `scaleX` transform issue
2. **Library Defaults Aren't Always Appropriate:** dnd-kit's default scaling behavior works for most cases but needed customization for column headers
3. **CSS Variables Have Limitations:** While useful for theming, they can be problematic during complex DOM manipulations
4. **Performance Matters:** Even when fixing bugs, consider performance implications and add optimizations where possible

---

## Future Considerations

### Potential Improvements
1. Consider adding a visual indicator (e.g., drop line) to show where the column will be placed
2. Add animation easing for smoother column transitions after drop
3. Consider adding keyboard support for column reordering (accessibility)
4. Add unit tests for drag-and-drop behavior

### Maintenance Notes
- If upgrading dnd-kit library, verify this fix still works
- The `animateLayoutChanges: () => false` setting may need adjustment in future versions
- Monitor for any new dnd-kit features that might provide better solutions

---

## References

- **dnd-kit Documentation:** https://docs.dndkit.com/
- **CSS Transform Specification:** https://developer.mozilla.org/en-US/docs/Web/CSS/transform
- **React.memo Documentation:** https://react.dev/reference/react/memo
- **Ant Design Theme Tokens:** https://ant.design/docs/react/customize-theme

---

## Author Notes

**Issue Severity:** P0 (Critical) - Affects core user interaction
**Fix Complexity:** Medium - Required understanding of dnd-kit internals
**Testing Time:** ~30 minutes of debugging with logs
**Implementation Time:** ~15 minutes once root cause was identified

**Date Fixed:** 2026-05-07
**Affected Component:** TaskListV2Table column headers
**Browser Compatibility:** Tested on Chrome, Firefox, Safari (all working)
