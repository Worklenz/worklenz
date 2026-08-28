-- Migration: Add notes column to client_portal_invoices
-- Description: Adds the missing notes column to support invoice notes functionality
-- Date: 2025-12-07

-- Add notes column to client_portal_invoices table
ALTER TABLE client_portal_invoices 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN client_portal_invoices.notes IS 'Optional notes or description for the invoice';
