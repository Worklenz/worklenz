-- Create audit log table for recurring task operations
CREATE TABLE IF NOT EXISTS recurring_tasks_audit_log (
    id                  UUID                     DEFAULT uuid_generate_v4() PRIMARY KEY,
    operation_type      VARCHAR(50)              NOT NULL,
    template_id         UUID,
    schedule_id         UUID,
    task_id             UUID,
    template_name       TEXT,
    success             BOOLEAN                  DEFAULT TRUE,
    error_message       TEXT,
    details             JSONB,
    created_tasks_count INTEGER                  DEFAULT 0,
    failed_tasks_count  INTEGER                  DEFAULT 0,
    execution_time_ms   INTEGER,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID                     REFERENCES users(id)
);

-- Create indexes for better query performance
CREATE INDEX idx_recurring_tasks_audit_log_template_id ON recurring_tasks_audit_log(template_id);
CREATE INDEX idx_recurring_tasks_audit_log_schedule_id ON recurring_tasks_audit_log(schedule_id);
CREATE INDEX idx_recurring_tasks_audit_log_created_at ON recurring_tasks_audit_log(created_at);
CREATE INDEX idx_recurring_tasks_audit_log_operation_type ON recurring_tasks_audit_log(operation_type);

-- Add comments
COMMENT ON TABLE recurring_tasks_audit_log IS 'Audit log for all recurring task operations';
COMMENT ON COLUMN recurring_tasks_audit_log.operation_type IS 'Type of operation: cron_job_run, manual_trigger, schedule_created, schedule_updated, schedule_deleted, etc.';
COMMENT ON COLUMN recurring_tasks_audit_log.details IS 'Additional details about the operation in JSON format';

-- Create a function to log recurring task operations
CREATE OR REPLACE FUNCTION log_recurring_task_operation(
    p_operation_type VARCHAR(50),
    p_template_id UUID DEFAULT NULL,
    p_schedule_id UUID DEFAULT NULL,
    p_task_id UUID DEFAULT NULL,
    p_template_name TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE,
    p_error_message TEXT DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_created_tasks_count INTEGER DEFAULT 0,
    p_failed_tasks_count INTEGER DEFAULT 0,
    p_execution_time_ms INTEGER DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO recurring_tasks_audit_log (
        operation_type,
        template_id,
        schedule_id,
        task_id,
        template_name,
        success,
        error_message,
        details,
        created_tasks_count,
        failed_tasks_count,
        execution_time_ms,
        created_by
    ) VALUES (
        p_operation_type,
        p_template_id,
        p_schedule_id,
        p_task_id,
        p_template_name,
        p_success,
        p_error_message,
        p_details,
        p_created_tasks_count,
        p_failed_tasks_count,
        p_execution_time_ms,
        p_created_by
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Create a view for recent audit logs
CREATE OR REPLACE VIEW v_recent_recurring_tasks_audit AS
SELECT 
    l.*,
    u.name as created_by_name,
    t.name as current_template_name,
    s.schedule_type,
    s.timezone
FROM recurring_tasks_audit_log l
LEFT JOIN users u ON l.created_by = u.id
LEFT JOIN task_recurring_templates t ON l.template_id = t.id
LEFT JOIN task_recurring_schedules s ON l.schedule_id = s.id
WHERE l.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY l.created_at DESC;