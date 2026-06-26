'use strict';
// Converted from: database/migrations/20251224000000-create-client-portal-task-comments.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Create client_portal_task_comments table
-- Description: Add support for client comments on tasks in the client portal
-- Date: 2025-12-24

-- Create the client_portal_task_comments table
CREATE TABLE IF NOT EXISTS client_portal_task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_team_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id),
  comment TEXT NOT NULL,
  sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('client', 'team_member')),
  sender_id UUID NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON client_portal_task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_org ON client_portal_task_comments(organization_team_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_project ON client_portal_task_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON client_portal_task_comments(created_at);

-- Add comment to the table
COMMENT ON TABLE client_portal_task_comments IS 'Stores comments made by clients and team members on tasks visible in the client portal';
COMMENT ON COLUMN client_portal_task_comments.sender_type IS 'Indicates whether the comment was made by a client or team_member';
COMMENT ON COLUMN client_portal_task_comments.sender_id IS 'ID of the client or team member who made the comment';
COMMENT ON COLUMN client_portal_task_comments.sender_name IS 'Name of the sender at the time of comment creation';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
