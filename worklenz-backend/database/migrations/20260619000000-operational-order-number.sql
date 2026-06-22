ALTER TABLE operational_cases
    ADD COLUMN IF NOT EXISTS order_number TEXT;

CREATE INDEX IF NOT EXISTS operational_cases_team_order_number_index
    ON operational_cases (team_id, LOWER(order_number))
    WHERE order_number IS NOT NULL;
