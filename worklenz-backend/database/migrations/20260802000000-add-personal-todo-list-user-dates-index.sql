-- Index for personal to-do list date-range filtering
-- Migration: 20260802000000-add-personal-todo-list-user-dates-index.sql
--
-- getPersonalTasks() (home-page-controller.ts) filters by user_id plus a
-- created_at/updated_at range (today/week/month/year) and sorts by one of
-- those two columns. The only existing index on personal_todo_list is a
-- UNIQUE constraint on (user_id, index), which doesn't help this query.
-- Runs on every Home > To-do page load, plus a 60-second poll per open tab.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personal_todo_list_user_dates
ON personal_todo_list(user_id, created_at, updated_at);
