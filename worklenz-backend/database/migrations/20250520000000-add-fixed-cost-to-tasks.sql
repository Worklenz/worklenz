-- Add fixed_cost column to tasks table for project finance functionality
ALTER TABLE tasks 
ADD COLUMN fixed_cost DECIMAL(10, 2) DEFAULT 0 CHECK (fixed_cost >= 0);

-- Add comment to explain the column
COMMENT ON COLUMN tasks.fixed_cost IS 'Fixed cost for the task in addition to hourly rate calculations'; 