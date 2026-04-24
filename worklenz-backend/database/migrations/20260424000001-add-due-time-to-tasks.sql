-- Migration: Add due_time column to tasks table
-- This stores the due time separately from end_date (date-only field)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time TIME;
