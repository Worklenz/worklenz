# SVAR Gantt Integration for Worklenz

This directory contains the integration of SVAR Gantt chart component into the Worklenz project management system.

## Overview

SVAR Gantt is a modern React Gantt chart component that provides interactive project timeline visualization. This integration allows users to view their project tasks in a Gantt chart format within the Worklenz project view.

## Components

### `project-view-gantt.tsx`
Main component that handles:
- Task data transformation from Worklenz format to SVAR Gantt format
- Redux state management integration
- Dark/light theme support
- Loading states and error handling
- Event handling for task interactions

### `gantt-custom-styles.css`
Custom CSS that provides:
- Theme-aware styling (light/dark mode)
- Worklenz brand color integration
- Responsive design adjustments
- Smooth theme transitions

## Features

### ✅ Implemented
- **Task Visualization**: Displays tasks and subtasks as Gantt bars
- **Group Support**: Shows task groups as summary tasks
- **Progress Tracking**: Visual progress indicators on task bars
- **Dark Mode**: Full dark/light theme compatibility
- **Responsive Design**: Works on desktop and mobile devices
- **Redux Integration**: Uses existing Worklenz Redux state management
- **Filtering**: Integrates with existing task filters
- **Loading States**: Proper skeleton loading while data loads

### 🚧 Planned Enhancements
- **Task Editing**: Click to open task drawer for editing
- **Drag & Drop**: Update task dates by dragging bars
- **Dependency Links**: Show task dependencies as links
- **Real-time Updates**: Live updates when tasks change
- **Export Features**: Export Gantt chart as PDF/image
- **Critical Path**: Highlight critical path in projects

## Data Transformation

The component transforms Worklenz task data structure to SVAR Gantt format:

```typescript
// Worklenz Task Group → SVAR Gantt Summary Task
{
  id: `group-${group.id}`,
  text: group.name,
  start: groupStartDate,
  end: groupEndDate,
  type: 'summary',
  parent: 0,
  progress: group.done_progress
}

// Worklenz Task → SVAR Gantt Task
{
  id: task.id,
  text: task.name,
  start: task.start_date,
  end: task.end_date,
  type: task.sub_tasks_count > 0 ? 'summary' : 'task',
  parent: `group-${group.id}`,
  progress: task.progress / 100
}
```

## Theme Integration

The component uses Worklenz's theme system:

```typescript
// Theme detection from Redux
const themeMode = useAppSelector(state => state.themeReducer.mode);
const isDarkMode = themeMode === 'dark';

// Dynamic CSS classes
<div className={`gantt-container ${isDarkMode ? 'gantt-dark-mode' : 'gantt-light-mode'}`}>
```

### Theme Variables

**Light Mode:**
- Task bars: `#1890ff` (Worklenz primary blue)
- Summary tasks: `#52c41a` (Worklenz green)
- Backgrounds: `#ffffff`, `#fafafa`
- Borders: `#d9d9d9`

**Dark Mode:**
- Task bars: `#4096ff` (Lighter blue for contrast)
- Summary tasks: `#73d13d` (Lighter green for contrast)
- Backgrounds: `#1f1f1f`, `#262626`
- Borders: `#424242`

## Configuration

### Gantt Settings
```typescript
const ganttConfig = {
  scales: [
    { unit: 'month', step: 1, format: 'MMMM yyyy' },
    { unit: 'day', step: 1, format: 'd' }
  ],
  columns: [
    { id: 'text', header: 'Task Name', width: 200 },
    { id: 'start', header: 'Start Date', width: 100 },
    { id: 'end', header: 'End Date', width: 100 },
    { id: 'progress', header: 'Progress', width: 80 }
  ],
  taskHeight: 32,
  rowHeight: 40
};
```

## Dependencies

- `wx-react-gantt`: SVAR Gantt React component
- `wx-react-gantt/dist/gantt.css`: Base SVAR Gantt styles
- External CDN for icons: `https://cdn.svar.dev/fonts/wxi/wx-icons.css`

## Usage

The Gantt tab is automatically available in the project view tabs. Users can:
1. Navigate to a project
2. Click the "Gantt" tab
3. View tasks in timeline format
4. Use existing filters to refine the view
5. Toggle between light/dark themes

## Performance Considerations

- **Lazy Loading**: Component is lazy-loaded to reduce initial bundle size
- **Data Memoization**: Task transformation is memoized to prevent unnecessary recalculations
- **Batch Loading**: Initial data fetching is batched for efficiency
- **Conditional Rendering**: Only renders when tab is active (destroyInactiveTabPane)

## Browser Support

Compatible with all modern browsers that support:
- ES6+ JavaScript features
- CSS Grid and Flexbox
- CSS Custom Properties (variables)
- React 18+

## Troubleshooting

### Common Issues

1. **Styles not loading**: Ensure CSS import order is correct
2. **Theme not updating**: Check Redux theme state
3. **Tasks not displaying**: Verify task data has required fields (name, dates)
4. **Performance issues**: Check if too many tasks are being rendered

### Debug Tips

```typescript
// Enable console logging for debugging
console.log('Gantt data:', ganttData);
console.log('Theme mode:', themeMode);
console.log('Task groups:', taskGroups);
```

## Contributing

When modifying the Gantt integration:

1. Test both light and dark themes
2. Verify responsive behavior
3. Check performance with large datasets
4. Update this README if adding new features
5. Follow Worklenz coding standards and patterns

---

For more information about SVAR Gantt, visit: https://svar.dev/react/gantt/ 