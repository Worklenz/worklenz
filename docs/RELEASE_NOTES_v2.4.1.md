# Release Notes — v2.4.1

## Reporting: Efficiency Report

A new **Efficiency** report is available under **Reporting → Time Reports**.

It shows how actual logged time compares to task estimates, grouped by Member, Team, Project, or Company.

**Key features:**
- Switch between **Budget %** (logged ÷ estimated) and **Efficiency %** (estimated ÷ logged) calculation modes
- Toggle display between **h/min** and **Man Days** (8 h = 1 day)
- Preset date range selector: Last 7 days, Last 30 days, This month, Last month, Last 3 months, Last 6 months
- Filter by team and project
- Colour-coded efficiency tags (green = on/under budget, red = over budget)
- Export to Excel

## Reporting: Month-End Summary

A new **Month-End Summary** report is available under **Reporting**, between Tasks and Time Reports.

It provides a month-by-month view of team performance across logged hours, completed tasks, and budget vs actual time.

**Key features:**
- Top-level KPIs: Logged Hours, Tasks Completed, Budget (man days), Actual (man days), Variance (man days), Efficiency
- Per-member and per-project breakdown tables with Budget, Actual, Variance, and Efficiency columns
- Filter by month, team, and project
- Export to Excel

## Other Improvements

- **Subtask roll-up totals** — parent tasks now aggregate progress, estimates, and logged time from all subtasks
- **Capacity accuracy** — pending team invitations are excluded from capacity calculations; members with an effective start date have capacity correctly bounded from that date
- **Efficiency calculation fix** — multi-team members are no longer double-counted; estimates and logs are now scoped to the same set of tasks for accurate comparison
