-- Minimal read-only operations foundation for cases used by operations views.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operational_case_type') THEN
        CREATE TYPE operational_case_type AS ENUM (
            'supplier_order',
            'repair',
            'shipment',
            'general'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operational_case_status') THEN
        CREATE TYPE operational_case_status AS ENUM (
            'new',
            'waiting_internal',
            'waiting_external',
            'in_progress',
            'at_risk',
            'overdue',
            'done',
            'closed_problem'
        );
    END IF;
END
$$;

CREATE OR REPLACE PROCEDURE pg_temp.add_constraint(_table TEXT, _constraint TEXT, _definition TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = _constraint) THEN
        EXECUTE FORMAT('ALTER TABLE %I ADD CONSTRAINT %I %s', _table, _constraint, _definition);
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS counterparties (
    id               UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    team_id          UUID                                                NOT NULL,
    name             TEXT                                                NOT NULL,
    type             TEXT                                                NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CALL pg_temp.add_constraint('counterparties', 'counterparties_pk', 'PRIMARY KEY (id)');
CALL pg_temp.add_constraint('counterparties', 'counterparties_team_id_fk', 'FOREIGN KEY (team_id) REFERENCES teams ON DELETE CASCADE');
CALL pg_temp.add_constraint('counterparties', 'counterparties_type_check', 'CHECK (type = ANY (ARRAY [''supplier''::TEXT, ''broker''::TEXT, ''repair_service''::TEXT, ''carrier''::TEXT, ''customer''::TEXT, ''internal''::TEXT, ''other''::TEXT]))');

CREATE UNIQUE INDEX IF NOT EXISTS counterparties_name_type_team_uindex
    ON counterparties (LOWER(name), type, team_id);

CREATE TABLE IF NOT EXISTS assets (
    id           UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    team_id      UUID                                                NOT NULL,
    name         TEXT                                                NOT NULL,
    inventory_no TEXT,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CALL pg_temp.add_constraint('assets', 'assets_pk', 'PRIMARY KEY (id)');
CALL pg_temp.add_constraint('assets', 'assets_team_id_fk', 'FOREIGN KEY (team_id) REFERENCES teams ON DELETE CASCADE');

CREATE UNIQUE INDEX IF NOT EXISTS assets_inventory_no_team_uindex
    ON assets (team_id, inventory_no)
    WHERE inventory_no IS NOT NULL;

CREATE TABLE IF NOT EXISTS operational_cases (
    id                  UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    team_id             UUID                                                NOT NULL,
    project_id          UUID,
    title               TEXT                                                NOT NULL,
    description         TEXT,
    case_type           operational_case_type                               NOT NULL,
    status              operational_case_status  DEFAULT 'new'              NOT NULL,
    owner_id            UUID                                                NOT NULL,
    counterparty_id     UUID,
    asset_id            UUID,
    due_date            TIMESTAMP WITH TIME ZONE,
    external_wait_since TIMESTAMP WITH TIME ZONE,
    last_activity_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    priority_score      NUMERIC                  DEFAULT 0                  NOT NULL,
    risk_score          NUMERIC                  DEFAULT 0                  NOT NULL,
    no_deadline_reason  TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CALL pg_temp.add_constraint('operational_cases', 'operational_cases_pk', 'PRIMARY KEY (id)');
CALL pg_temp.add_constraint('operational_cases', 'operational_cases_team_id_fk', 'FOREIGN KEY (team_id) REFERENCES teams ON DELETE CASCADE');
CALL pg_temp.add_constraint('operational_cases', 'operational_cases_project_id_fk', 'FOREIGN KEY (project_id) REFERENCES projects ON DELETE SET NULL');
CALL pg_temp.add_constraint('operational_cases', 'operational_cases_owner_id_fk', 'FOREIGN KEY (owner_id) REFERENCES users ON DELETE RESTRICT');
CALL pg_temp.add_constraint('operational_cases', 'operational_cases_counterparty_id_fk', 'FOREIGN KEY (counterparty_id) REFERENCES counterparties ON DELETE SET NULL');
CALL pg_temp.add_constraint('operational_cases', 'operational_cases_asset_id_fk', 'FOREIGN KEY (asset_id) REFERENCES assets ON DELETE SET NULL');

CREATE INDEX IF NOT EXISTS operational_cases_team_status_index
    ON operational_cases (team_id, status);

CREATE INDEX IF NOT EXISTS operational_cases_team_due_date_index
    ON operational_cases (team_id, due_date);

CREATE INDEX IF NOT EXISTS operational_cases_team_type_index
    ON operational_cases (team_id, case_type);

CREATE TABLE IF NOT EXISTS money_impacts (
    id                    UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    case_id               UUID                                                NOT NULL,
    currency              TEXT                     DEFAULT 'RUB'::TEXT        NOT NULL,
    object_value          NUMERIC,
    service_cost          NUMERIC,
    potential_loss        NUMERIC,
    downtime_cost_per_day NUMERIC,
    delay_cost_per_day    NUMERIC,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CALL pg_temp.add_constraint('money_impacts', 'money_impacts_pk', 'PRIMARY KEY (id)');
CALL pg_temp.add_constraint('money_impacts', 'money_impacts_case_id_fk', 'FOREIGN KEY (case_id) REFERENCES operational_cases ON DELETE CASCADE');

CREATE UNIQUE INDEX IF NOT EXISTS money_impacts_case_id_uindex
    ON money_impacts (case_id);
