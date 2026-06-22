ALTER TABLE operational_cases
    ADD COLUMN IF NOT EXISTS next_action_text TEXT,
    ADD COLUMN IF NOT EXISTS next_action_due_date TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS operational_cases_team_next_action_due_date_index
    ON operational_cases (team_id, next_action_due_date);
