-- Debug query to check client status values
-- Run this to see what status values currently exist in the clients table

-- Check if status column exists
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'clients' AND column_name = 'status';

-- Count clients by status (including NULL)
SELECT 
    COALESCE(status, 'NULL') as status_value,
    COUNT(*) as count
FROM clients
GROUP BY status
ORDER BY count DESC;

-- Show sample clients with their status
SELECT 
    id,
    name,
    email,
    status,
    created_at
FROM clients
ORDER BY created_at DESC
LIMIT 10;
