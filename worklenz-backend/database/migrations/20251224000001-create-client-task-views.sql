-- Migration: Create client_task_views table
-- Description: Track when clients last viewed task comments to show unseen count
-- Date: 2025-12-24

-- Create the client_task_views table
CREATE TABLE IF NOT EXISTS client_task_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, task_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_client_task_views_client ON client_task_views(client_id);
CREATE INDEX idx_client_task_views_task ON client_task_views(task_id);

-- Add comment to the table
COMMENT ON TABLE client_task_views IS 'Tracks when clients last viewed task comments to calculate unseen comment count';
COMMENT ON COLUMN client_task_views.last_viewed_at IS 'Timestamp when client last viewed the comments for this task';
