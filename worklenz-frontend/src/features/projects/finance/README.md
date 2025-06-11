# Optimized Finance Calculation System

## Overview

This system provides efficient frontend recalculation of project finance data when fixed costs are updated, eliminating the need for API refetches and ensuring optimal performance even with deeply nested task hierarchies.

## Key Features

### 1. Hierarchical Recalculation
- When a nested subtask's fixed cost is updated, all parent tasks are automatically recalculated
- Parent task totals are aggregated from their subtasks to avoid double counting
- Calculations propagate up the entire task hierarchy efficiently

### 2. Performance Optimizations
- **Memoization**: Task calculations are cached to avoid redundant computations
- **Smart Cache Management**: Cache entries expire automatically and are cleaned up periodically
- **Selective Updates**: Only tasks that have actually changed trigger recalculations

### 3. Frontend-Only Updates
- No API refetches required for fixed cost updates
- Immediate UI responsiveness
- Reduced server load and network traffic

## How It Works

### Task Update Flow
1. User updates fixed cost in UI
2. `updateTaskFixedCostAsync` is dispatched
3. API call updates the backend
4. Redux reducer updates the task and triggers `recalculateTaskHierarchy`
5. All parent tasks are recalculated automatically
6. UI updates immediately with new values

### Calculation Logic
```typescript
// For parent tasks with subtasks
parentTask.fixed_cost = sum(subtask.fixed_cost)
parentTask.total_budget = parentTask.estimated_cost + parentTask.fixed_cost
parentTask.variance = parentTask.total_actual - parentTask.total_budget

// For leaf tasks
task.total_budget = task.estimated_cost + task.fixed_cost
task.variance = task.total_actual - task.total_budget
```

### Memoization Strategy
- Cache key includes all relevant financial fields
- Cache entries expire after 10 minutes
- Cache is cleared when fresh data is loaded from API
- Automatic cleanup prevents memory leaks

## Usage Examples

### Updating Fixed Cost
```typescript
// This will automatically recalculate all parent tasks
dispatch(updateTaskFixedCostAsync({ 
  taskId: 'subtask-123', 
  groupId: 'group-456', 
  fixedCost: 1500 
}));
```

### Budget Statistics
The budget statistics in the project overview are calculated efficiently:
- Avoids double counting in nested hierarchies
- Uses aggregated values from parent tasks
- Updates automatically when any task changes

## Performance Benefits

1. **Reduced API Calls**: No refetching required for fixed cost updates
2. **Faster UI Updates**: Immediate recalculation and display
3. **Memory Efficient**: Smart caching with automatic cleanup
4. **Scalable**: Handles deeply nested task hierarchies efficiently

## Cache Management

The system includes automatic cache management:
- Cache cleanup every 5 minutes
- Entries expire after 10 minutes
- Manual cache clearing when fresh data is loaded
- Memory-efficient with automatic garbage collection 