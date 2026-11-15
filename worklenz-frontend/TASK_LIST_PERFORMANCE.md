# Recording task-list performance

Use a normal production build to compare navigation speed:

```bash
VITE_GENERATE_SOURCEMAP=true npm run build
npm run serve -- --port 5173 --strictPort
```

For component attribution, enable the optional React profiling renderer:

```bash
VITE_REACT_PROFILING=true VITE_GENERATE_SOURCEMAP=true npm run build
npm run serve -- --port 5173 --strictPort
```

If preview is already running, reload it after building. Record the navigation in
Chrome Performance and export the trace. Keep the project, viewport, filters, and
cache/prefetch state consistent across comparisons. Disable the React DevTools
extension for browser CPU comparisons.

The profiling build adds User Timing measures:

- `worklenz-render:project-view`: the project shell, tabs and all descendants.
- `worklenz-render:project-header`: title, project attributes and header actions.
- `worklenz-render:project-identity`: project title and attributes.
- `worklenz-render:project-actions`: refresh, integration and other header controls.
- `worklenz-render:project-portals`: task-drawer controller and open project dialogs.
- `worklenz-render:table`: table setup and all descendants, including loading states.
- `worklenz-render:table-header`: column header controls and drag/drop setup.
- `worklenz-render:row`: each rendered task row, including its cells.
- `worklenz-render:cell:<column>`: each cell, grouped by column id.
- `worklenz-project-view-to-task-list-rows`: initialization to mounted rows.

Render measures include `phase`, `actualDuration`, and `baseDuration` in their
detail. Their timeline span is render start to commit; `actualDuration` is React's
render duration. Row timings include cell timings, so do not add the two together.
Count `mount` versus `update` phases to distinguish new mounts from repeated
renders. These measures do not include all browser layout/paint costs or React
commit work. The mounted-row marker also does not guarantee a completed paint.

Profiling adds overhead. Compare absolute loading times using normal builds,
and use profiling builds to identify expensive components. Normal builds use the
standard React renderer and omit the profiling boundaries.

For ordinary list navigation, the shell mounts after query metadata and saved
filters are ready, while the first task request is pending. The table shows its
skeleton and reuses that request. Backlog, saved views and task deep links retain
their existing initialization order. Account for this overlap when interpreting
header timing relative to the task response. The early shell update uses a React
transition so its render phase can yield to higher-priority work; commit and
layout work still run synchronously. Filter counts derive directly from Redux
selections, and the toolbar loads status/phase management dialogs on first use.

Virtualization settings live in `src/components/task-list-v2/constants/virtualization.ts`.
The 40px default is an estimate, so expanded subtasks and group headers continue
to be measured. The 160px buffer limits extra row controls mounted on startup.
Keep animation-frame scheduling for ResizeObserver: immediate measurement
produced loop errors in a Chrome fixture when rows expanded or groups collapsed.
