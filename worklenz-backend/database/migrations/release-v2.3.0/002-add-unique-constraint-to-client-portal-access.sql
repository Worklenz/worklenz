-- Migration: Add unique constraint to client_portal_access
-- Description: Adds a unique constraint to the client_id column in the client_portal_access table to support ON CONFLICT statements.
-- Date: 2025-12-12
-- Version: 2.3.0

ALTER TABLE client_portal_access
ADD CONSTRAINT client_portal_access_client_id_key UNIQUE (client_id);
