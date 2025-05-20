-- Dropping existing finance_rate_cards table
DROP TABLE IF EXISTS finance_rate_cards;
-- Creating table to store rate card details
CREATE TABLE finance_rate_cards
(
    id         UUID PRIMARY KEY                  DEFAULT uuid_generate_v4(),
    team_id    UUID                     NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    name       VARCHAR                  NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Dropping existing finance_project_rate_card_roles table
DROP TABLE IF EXISTS finance_project_rate_card_roles;
-- Creating table with single id primary key
CREATE TABLE finance_project_rate_card_roles
(
    id         UUID PRIMARY KEY                  DEFAULT uuid_generate_v4(),
    project_id UUID                     NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    role_id    UUID                     NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    rate       DECIMAL(10, 2)           NOT NULL CHECK (rate >= 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_project_role UNIQUE (project_id, role_id)
);

-- Dropping existing finance_rate_card_roles table
DROP TABLE IF EXISTS finance_rate_card_roles;
-- Creating table to store role-specific rates for rate cards
CREATE TABLE finance_rate_card_roles
(
    rate_card_id UUID                     NOT NULL REFERENCES finance_rate_cards (id) ON DELETE CASCADE,
    job_title_id      UUID                     REFERENCES job_titles(id) ON DELETE SET NULL,
    rate         DECIMAL(10, 2)           NOT NULL CHECK (rate >= 0),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Adding project_rate_card_role_id column to project_members
ALTER TABLE project_members
    ADD COLUMN project_rate_card_role_id UUID REFERENCES finance_project_rate_card_roles(id) ON DELETE SET NULL;

-- Adding rate_card column to projects
ALTER TABLE projects
 ADD COLUMN rate_card UUID REFERENCES finance_rate_cards(id) ON DELETE SET NULL;

ALTER TABLE finance_rate_cards
    ADD COLUMN currency TEXT NOT NULL DEFAULT 'LKR';
