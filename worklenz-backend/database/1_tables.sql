-- CREATE DATABASE worklenz_db;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Domains
CREATE DOMAIN WL_HEX_COLOR AS TEXT CHECK (value ~* '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$');
CREATE DOMAIN WL_EMAIL AS TEXT CHECK (value ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Enumerated Types
-- Add new values using "ALTER TYPE WL_TASK_LIST_COL_KEY ADD VALUE 'NEW_VALUE_NAME' AFTER 'REPORTER';"
CREATE TYPE WL_TASK_LIST_COL_KEY AS ENUM ('ASSIGNEES', 'COMPLETED_DATE', 'CREATED_DATE', 'DESCRIPTION', 'DUE_DATE', 'ESTIMATION', 'KEY', 'LABELS', 'LAST_UPDATED', 'NAME', 'PRIORITY', 'PROGRESS', 'START_DATE', 'STATUS', 'TIME_TRACKING', 'REPORTER', 'PHASE');


CREATE TABLE archived_projects (
    user_id    UUID NOT NULL,
    project_id UUID NOT NULL
);

ALTER TABLE archived_projects
    ADD CONSTRAINT archived_projects_pk
        PRIMARY KEY (user_id, project_id);

CREATE TABLE bounced_emails (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    email      TEXT                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE UNIQUE INDEX bounced_emails_email_uindex
    ON bounced_emails (email);

ALTER TABLE bounced_emails
    ADD CONSTRAINT bounced_emails_pk
        PRIMARY KEY (id);

CREATE TABLE clients (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                                                NOT NULL,
    team_id    UUID                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE INDEX clients_id_team_id_index
    ON clients (id, team_id);

CREATE UNIQUE INDEX clients_name_team_id_uindex
    ON clients (name, team_id);

ALTER TABLE clients
    ADD CONSTRAINT clients_pk
        PRIMARY KEY (id);

ALTER TABLE clients
    ADD CONSTRAINT clients_name_check
        CHECK (CHAR_LENGTH(name) <= 60);

CREATE TABLE countries (
    id       UUID       DEFAULT uuid_generate_v4() NOT NULL,
    code     CHAR(2)                               NOT NULL,
    name     VARCHAR(150)                          NOT NULL,
    phone    INTEGER                               NOT NULL,
    currency VARCHAR(3) DEFAULT NULL::CHARACTER VARYING
);

ALTER TABLE countries
    ADD PRIMARY KEY (id);

CREATE TABLE cpt_phases (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                                                NOT NULL,
    color_code  WL_HEX_COLOR                                        NOT NULL,
    template_id UUID                                                NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE UNIQUE INDEX cpt_phases_name_project_uindex
    ON cpt_phases (name, template_id);

ALTER TABLE cpt_phases
    ADD CONSTRAINT cpt_phases_pk
        PRIMARY KEY (id);

CREATE TABLE cpt_task_labels (
    task_id  UUID NOT NULL,
    label_id UUID NOT NULL
);

ALTER TABLE cpt_task_labels
    ADD CONSTRAINT cpt_task_labels_pk
        PRIMARY KEY (task_id, label_id);

CREATE TABLE cpt_task_phases (
    task_id  UUID NOT NULL,
    phase_id UUID NOT NULL
);

CREATE UNIQUE INDEX cpt_task_phase_cpt_task_phase_uindex
    ON cpt_task_phases (task_id, phase_id);

CREATE UNIQUE INDEX cpt_task_phase_task_id_uindex
    ON cpt_task_phases (task_id);

ALTER TABLE cpt_task_phases
    ADD CONSTRAINT cpt_task_phase_phase_id_fk
        FOREIGN KEY (phase_id) REFERENCES cpt_phases
            ON DELETE CASCADE;

CREATE TABLE cpt_task_statuses (
    id          UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                               NOT NULL,
    template_id UUID                               NOT NULL,
    team_id     UUID                               NOT NULL,
    category_id UUID                               NOT NULL,
    sort_order  INTEGER DEFAULT 0                  NOT NULL
);

CREATE UNIQUE INDEX cpt_task_statuses_template_id_name_uindex
    ON cpt_task_statuses (template_id, name);

ALTER TABLE cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_pk
        PRIMARY KEY (id);

CREATE TABLE cpt_tasks (
    id               UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name             TEXT                                                NOT NULL,
    description      TEXT,
    total_minutes    NUMERIC                  DEFAULT 0                  NOT NULL,
    sort_order       INTEGER                  DEFAULT 0                  NOT NULL,
    task_no          BIGINT,
    original_task_id UUID,
    priority_id      UUID                                                NOT NULL,
    template_id      UUID                                                NOT NULL,
    parent_task_id   UUID,
    status_id        UUID                                                NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

COMMENT ON COLUMN cpt_tasks.original_task_id IS 'original_task_id from the project the template is created from';

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_pk
        PRIMARY KEY (id);

ALTER TABLE cpt_task_labels
    ADD CONSTRAINT cpt_task_labels_task_id_fk
        FOREIGN KEY (task_id) REFERENCES cpt_tasks
            ON DELETE CASCADE;

ALTER TABLE cpt_task_phases
    ADD CONSTRAINT cpt_task_phase_task_id_fk
        FOREIGN KEY (task_id) REFERENCES cpt_tasks
            ON DELETE CASCADE;

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_sort_order_unique
        UNIQUE (template_id, sort_order)
            DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_status_id_fk
        FOREIGN KEY (status_id) REFERENCES cpt_task_statuses
            ON DELETE RESTRICT;

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_task_order_check
        CHECK (sort_order >= 0);

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_total_minutes_check
        CHECK ((total_minutes >= (0)::NUMERIC) AND (total_minutes <= (999999)::NUMERIC));

CREATE TABLE custom_project_templates (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                                                NOT NULL,
    phase_label TEXT                     DEFAULT 'Phase'::TEXT      NOT NULL,
    team_id     UUID                                                NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    color_code  TEXT                                                NOT NULL,
    notes       TEXT
);

CREATE UNIQUE INDEX custom_project_templates_name_team_id_uindex
    ON custom_project_templates (name, team_id);

ALTER TABLE custom_project_templates
    ADD CONSTRAINT custom_project_templates_pk
        PRIMARY KEY (id);

ALTER TABLE cpt_phases
    ADD CONSTRAINT cpt_phases_template_id_fk
        FOREIGN KEY (template_id) REFERENCES custom_project_templates
            ON DELETE CASCADE;

ALTER TABLE cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_template_id_fk
        FOREIGN KEY (template_id) REFERENCES custom_project_templates
            ON DELETE CASCADE;

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_template_fk
        FOREIGN KEY (template_id) REFERENCES custom_project_templates
            ON DELETE CASCADE;

CREATE TABLE email_invitations (
    id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name           TEXT                                                NOT NULL,
    email          WL_EMAIL                                            NOT NULL,
    team_id        UUID,
    team_member_id UUID,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE email_invitations
    ADD CONSTRAINT email_invitations_pk
        PRIMARY KEY (id);

CREATE TABLE favorite_projects (
    user_id    UUID NOT NULL,
    project_id UUID NOT NULL
);

ALTER TABLE favorite_projects
    ADD CONSTRAINT favorite_projects_pk
        PRIMARY KEY (user_id, project_id);

CREATE TABLE job_titles (
    id      UUID DEFAULT uuid_generate_v4() NOT NULL,
    name    TEXT                            NOT NULL,
    team_id UUID                            NOT NULL
);

CREATE UNIQUE INDEX job_titles_name_team_id_uindex
    ON job_titles (name, team_id);

CREATE INDEX job_titles_team_id_index
    ON job_titles (team_id);

ALTER TABLE job_titles
    ADD CONSTRAINT job_titles_pk
        PRIMARY KEY (id);

ALTER TABLE job_titles
    ADD CONSTRAINT job_titles_name_check
        CHECK (CHAR_LENGTH(name) <= 55);

CREATE TABLE notification_settings (
    email_notifications_enabled BOOLEAN DEFAULT TRUE  NOT NULL,
    popup_notifications_enabled BOOLEAN DEFAULT TRUE  NOT NULL,
    show_unread_items_count     BOOLEAN DEFAULT TRUE  NOT NULL,
    daily_digest_enabled        BOOLEAN DEFAULT FALSE NOT NULL,
    user_id                     UUID                  NOT NULL,
    team_id                     UUID                  NOT NULL
);

CREATE INDEX notification_settings_team_user_id_index
    ON notification_settings (team_id, user_id);

ALTER TABLE notification_settings
    ADD CONSTRAINT notification_settings_pk
        PRIMARY KEY (user_id, team_id);

CREATE TABLE organizations (
    id                       UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    organization_name        TEXT                                                NOT NULL,
    contact_number           TEXT,
    contact_number_secondary TEXT,
    address_line_1           TEXT,
    address_line_2           TEXT,
    country                  UUID,
    city                     TEXT,
    state                    TEXT,
    postal_code              TEXT,
    trial_in_progress        BOOLEAN                  DEFAULT FALSE              NOT NULL,
    trial_expire_date        DATE,
    subscription_status      TEXT                     DEFAULT 'active'::TEXT     NOT NULL,
    storage                  INTEGER                  DEFAULT 1                  NOT NULL,
    updating_plan            BOOLEAN                  DEFAULT FALSE,
    user_id                  UUID                                                NOT NULL,
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    license_type_id          UUID
);

CREATE UNIQUE INDEX organizations_user_id_uindex
    ON organizations (user_id);

ALTER TABLE organizations
    ADD CONSTRAINT organizations_pk
        PRIMARY KEY (id);

ALTER TABLE organizations
    ADD CONSTRAINT users_data_countries_id_fk
        FOREIGN KEY (country) REFERENCES countries;

ALTER TABLE organizations
    ADD CONSTRAINT subscription_statuses_allowed
        CHECK (subscription_status = ANY
               (ARRAY ['active'::TEXT, 'past_due'::TEXT, 'trialing'::TEXT, 'paused'::TEXT, 'deleted'::TEXT, 'life_time_deal'::TEXT, 'free'::TEXT, 'custom'::TEXT, 'credit'::TEXT]));

CREATE TABLE permissions (
    id          TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT NOT NULL
);

CREATE UNIQUE INDEX permissions_name_uindex
    ON permissions (name);

ALTER TABLE permissions
    ADD CONSTRAINT permissions_pk
        PRIMARY KEY (id);

CREATE TABLE personal_todo_list (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                                                NOT NULL,
    description TEXT,
    color_code  WL_HEX_COLOR                                        NOT NULL,
    done        BOOLEAN                  DEFAULT FALSE              NOT NULL,
    index       INTEGER                  DEFAULT 0,
    user_id     UUID                                                NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE UNIQUE INDEX personal_todo_list_index_uindex
    ON personal_todo_list (user_id, index);

ALTER TABLE personal_todo_list
    ADD CONSTRAINT personal_todo_list_pk
        PRIMARY KEY (id);

ALTER TABLE personal_todo_list
    ADD CONSTRAINT personal_todo_list_description_check
        CHECK (CHAR_LENGTH(description) <= 200);

ALTER TABLE personal_todo_list
    ADD CONSTRAINT personal_todo_list_name_check
        CHECK (CHAR_LENGTH(name) <= 100);

CREATE TABLE pg_sessions (
    sid    VARCHAR      NOT NULL,
    sess   JSON         NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

ALTER TABLE pg_sessions
    ADD PRIMARY KEY (sid);

CREATE TABLE project_access_levels (
    id   UUID DEFAULT uuid_generate_v4() NOT NULL,
    name TEXT                            NOT NULL,
    key  TEXT                            NOT NULL
);

CREATE UNIQUE INDEX project_access_levels_key_uindex
    ON project_access_levels (key);

CREATE UNIQUE INDEX project_access_levels_name_uindex
    ON project_access_levels (name);

ALTER TABLE project_access_levels
    ADD CONSTRAINT project_access_levels_pk
        PRIMARY KEY (id);

CREATE TABLE project_categories (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                                                NOT NULL,
    color_code WL_HEX_COLOR             DEFAULT '#70a6f3'::TEXT    NOT NULL,
    team_id    UUID                                                NOT NULL,
    created_by UUID                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE UNIQUE INDEX project_categories_name_team_id_uindex
    ON project_categories (name, team_id);

ALTER TABLE project_categories
    ADD CONSTRAINT project_categories_pk
        PRIMARY KEY (id);

CREATE TABLE project_comment_mentions (
    comment_id      UUID                                               NOT NULL,
    mentioned_index INTEGER                                            NOT NULL,
    mentioned_by    UUID                                               NOT NULL,
    informed_by     UUID                                               NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE project_comments (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    content    TEXT                                                NOT NULL,
    created_by UUID                                                NOT NULL,
    project_id UUID                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE INDEX project_comments_project_id_index
    ON project_comments (project_id);

ALTER TABLE project_comments
    ADD CONSTRAINT project_comments_pk
        PRIMARY KEY (id);

ALTER TABLE project_comment_mentions
    ADD CONSTRAINT project_comment_mentions_comment_id_fk
        FOREIGN KEY (comment_id) REFERENCES project_comments
            ON DELETE CASCADE;

ALTER TABLE project_comments
    ADD CONSTRAINT project_comments_content_length_check
        CHECK (CHAR_LENGTH(content) <= 2000);

CREATE TABLE project_folders (
    id               UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name             TEXT                                                NOT NULL,
    key              TEXT                                                NOT NULL,
    color_code       WL_HEX_COLOR             DEFAULT '#70a6f3'::TEXT    NOT NULL,
    created_by       UUID                                                NOT NULL,
    parent_folder_id UUID,
    team_id          UUID                                                NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE UNIQUE INDEX project_folders_team_id_key_uindex
    ON project_folders (team_id, key);

CREATE UNIQUE INDEX project_folders_team_id_name_uindex
    ON project_folders (team_id, name);

ALTER TABLE project_folders
    ADD CONSTRAINT project_folders_pk
        PRIMARY KEY (id);

ALTER TABLE project_folders
    ADD CONSTRAINT project_folders_parent_folder_fk
        FOREIGN KEY (parent_folder_id) REFERENCES project_folders;

CREATE TABLE project_logs (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    team_id     UUID                                                NOT NULL,
    project_id  UUID                                                NOT NULL,
    description TEXT                                                NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE project_logs
    ADD CONSTRAINT project_logs_pk
        PRIMARY KEY (id);

CREATE TABLE project_member_allocations (
    id             UUID DEFAULT uuid_generate_v4() NOT NULL,
    project_id     UUID                            NOT NULL,
    team_member_id UUID                            NOT NULL,
    allocated_from TIMESTAMP WITH TIME ZONE        NOT NULL,
    allocated_to   TIMESTAMP WITH TIME ZONE        NOT NULL
);

ALTER TABLE project_member_allocations
    ADD CONSTRAINT project_member_allocations_pk
        PRIMARY KEY (id);

CREATE TABLE project_members (
    id                      UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    team_member_id          UUID                                                NOT NULL,
    project_access_level_id UUID                                                NOT NULL,
    project_id              UUID                                                NOT NULL,
    role_id                 UUID                                                NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    default_view            TEXT                     DEFAULT 'TASK_LIST'::TEXT  NOT NULL
);

CREATE INDEX project_members_project_id_index
    ON project_members (project_id);

CREATE INDEX project_members_project_id_member_id_index
    ON project_members (project_id, team_member_id);

CREATE INDEX project_members_team_member_id_index
    ON project_members (team_member_id);

CREATE UNIQUE INDEX project_members_team_member_project_uindex
    ON project_members (team_member_id, project_id);

ALTER TABLE project_members
    ADD CONSTRAINT project_members_pk
        PRIMARY KEY (id);

ALTER TABLE project_members
    ADD CONSTRAINT project_members_access_level_fk
        FOREIGN KEY (project_access_level_id) REFERENCES project_access_levels;

CREATE TABLE project_phases (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                                                NOT NULL,
    color_code WL_HEX_COLOR                                        NOT NULL,
    project_id UUID                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date   TIMESTAMP WITH TIME ZONE,
    sort_index INTEGER                  DEFAULT 0
);

CREATE UNIQUE INDEX project_phases_name_project_uindex
    ON project_phases (name, project_id);

ALTER TABLE project_phases
    ADD CONSTRAINT project_phases_pk
        PRIMARY KEY (id);

CREATE TABLE project_subscribers (
    id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    user_id        UUID                                                NOT NULL,
    project_id     UUID                                                NOT NULL,
    team_member_id UUID                                                NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE UNIQUE INDEX project_subscribers_user_task_team_member_uindex
    ON project_subscribers (user_id, project_id, team_member_id);

ALTER TABLE project_subscribers
    ADD CONSTRAINT project_subscribers_pk
        PRIMARY KEY (id);

CREATE TABLE project_task_list_cols (
    id         UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                               NOT NULL,
    key        WL_TASK_LIST_COL_KEY               NOT NULL,
    index      INTEGER DEFAULT 0                  NOT NULL,
    pinned     BOOLEAN DEFAULT TRUE               NOT NULL,
    project_id UUID                               NOT NULL
);

CREATE INDEX project_task_list_cols_index
    ON project_task_list_cols (project_id, index);

CREATE UNIQUE INDEX project_task_list_cols_key_project_uindex
    ON project_task_list_cols (key, project_id);

ALTER TABLE project_task_list_cols
    ADD CONSTRAINT project_task_list_cols_pk
        PRIMARY KEY (id);

CREATE TABLE projects (
    id                     UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name                   TEXT                                                NOT NULL,
    key                    TEXT                                                NOT NULL,
    color_code             WL_HEX_COLOR             DEFAULT '#70a6f3'::TEXT    NOT NULL,
    notes                  TEXT,
    tasks_counter          BIGINT                   DEFAULT 0                  NOT NULL,
    start_date             TIMESTAMP WITH TIME ZONE,
    end_date               TIMESTAMP WITH TIME ZONE,
    team_id                UUID                                                NOT NULL,
    client_id              UUID,
    owner_id               UUID                                                NOT NULL,
    status_id              UUID                                                NOT NULL,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    category_id            UUID,
    folder_id              UUID,
    phase_label            TEXT                     DEFAULT 'Phase'::TEXT      NOT NULL,
    estimated_man_days     INTEGER                  DEFAULT 0,
    hours_per_day          INTEGER                  DEFAULT 8,
    health_id              UUID,
    estimated_working_days INTEGER                  DEFAULT 0
);

CREATE INDEX projects_folder_id_index
    ON projects (folder_id);

CREATE INDEX projects_id_team_id_index
    ON projects (id, team_id);

CREATE UNIQUE INDEX projects_key_team_id_uindex
    ON projects (key, team_id);

CREATE INDEX projects_name_index
    ON projects (name);

CREATE UNIQUE INDEX projects_name_team_id_uindex
    ON projects (name, team_id);

CREATE INDEX projects_team_id_folder_id_index
    ON projects (team_id, folder_id);

CREATE INDEX projects_team_id_index
    ON projects (team_id);

CREATE INDEX projects_team_id_name_index
    ON projects (team_id, name);

ALTER TABLE projects
    ADD CONSTRAINT projects_pk
        PRIMARY KEY (id);

ALTER TABLE archived_projects
    ADD CONSTRAINT archived_projects_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE favorite_projects
    ADD CONSTRAINT favorite_projects_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_comments
    ADD CONSTRAINT project_comments_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_logs
    ADD CONSTRAINT project_logs_projects_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_member_allocations
    ADD CONSTRAINT project_members_allocations_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_members
    ADD CONSTRAINT project_members_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_phases
    ADD CONSTRAINT project_phases_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_subscribers
    ADD CONSTRAINT project_subscribers_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_task_list_cols
    ADD CONSTRAINT project_task_list_cols_project_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE projects
    ADD CONSTRAINT projects_category_id_fk
        FOREIGN KEY (category_id) REFERENCES project_categories
            ON DELETE CASCADE;

ALTER TABLE projects
    ADD CONSTRAINT projects_client_id_fk
        FOREIGN KEY (client_id) REFERENCES clients
            ON DELETE SET NULL;

ALTER TABLE projects
    ADD CONSTRAINT projects_folder_id_fk
        FOREIGN KEY (folder_id) REFERENCES project_folders
            ON DELETE SET DEFAULT;

ALTER TABLE projects
    ADD CONSTRAINT projects_name_check
        CHECK (CHAR_LENGTH(name) <= 100);

ALTER TABLE projects
    ADD CONSTRAINT projects_notes_check
        CHECK (CHAR_LENGTH(notes) <= 500);

CREATE TABLE pt_labels (
    id          UUID DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                            NOT NULL,
    color_code  TEXT                            NOT NULL,
    template_id UUID
);

ALTER TABLE pt_labels
    ADD CONSTRAINT pt_project_templates_labels_pk
        PRIMARY KEY (id);

CREATE TABLE pt_phases (
    id          UUID DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                            NOT NULL,
    color_code  TEXT,
    template_id UUID                            NOT NULL
);

ALTER TABLE pt_phases
    ADD CONSTRAINT pt_project_template_phases_pk
        PRIMARY KEY (id);

CREATE TABLE pt_project_templates (
    id          UUID DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                            NOT NULL,
    key         TEXT                            NOT NULL,
    description TEXT,
    phase_label TEXT,
    image_url   TEXT,
    color_code  TEXT DEFAULT '#3b7ad4'::TEXT    NOT NULL
);

ALTER TABLE pt_project_templates
    ADD CONSTRAINT pt_project_templates_pk
        PRIMARY KEY (id);

ALTER TABLE pt_labels
    ADD CONSTRAINT pt_labels_pt_project_templates_id_fk
        FOREIGN KEY (template_id) REFERENCES pt_project_templates;

ALTER TABLE pt_phases
    ADD CONSTRAINT pt_project_template_phases_template_id_fk
        FOREIGN KEY (template_id) REFERENCES pt_project_templates
            ON DELETE CASCADE;

ALTER TABLE pt_project_templates
    ADD CONSTRAINT pt_project_templates_key_unique
        UNIQUE (key);

CREATE TABLE pt_statuses (
    id          UUID DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                            NOT NULL,
    template_id UUID                            NOT NULL,
    category_id UUID                            NOT NULL
);

ALTER TABLE pt_statuses
    ADD CONSTRAINT pt_project_template_statuses_pk
        PRIMARY KEY (id);

ALTER TABLE pt_statuses
    ADD CONSTRAINT pt_project_template_statuses_template_id_fk
        FOREIGN KEY (template_id) REFERENCES pt_project_templates
            ON DELETE CASCADE;

CREATE TABLE pt_task_labels (
    task_id  UUID NOT NULL,
    label_id UUID NOT NULL
);

ALTER TABLE pt_task_labels
    ADD CONSTRAINT pt_task_labels_pk
        PRIMARY KEY (task_id, label_id);

ALTER TABLE pt_task_labels
    ADD CONSTRAINT pt_task_labels_label_id_fk
        FOREIGN KEY (label_id) REFERENCES pt_labels;

CREATE TABLE pt_task_phases (
    task_id  UUID NOT NULL,
    phase_id UUID NOT NULL
);

CREATE UNIQUE INDEX pt_task_phase_pt_task_phase_uindex
    ON pt_task_phases (task_id, phase_id);

CREATE UNIQUE INDEX pt_task_phase_task_id_uindex
    ON pt_task_phases (task_id);

ALTER TABLE pt_task_phases
    ADD CONSTRAINT pt_task_phase_phase_id_fk
        FOREIGN KEY (phase_id) REFERENCES pt_phases
            ON DELETE CASCADE;

CREATE TABLE pt_task_statuses (
    id          UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                               NOT NULL,
    template_id UUID                               NOT NULL,
    team_id     UUID                               NOT NULL,
    category_id UUID                               NOT NULL,
    sort_order  INTEGER DEFAULT 0                  NOT NULL
);

CREATE UNIQUE INDEX pt_task_statuses_template_id_name_uindex
    ON pt_task_statuses (template_id, name);

ALTER TABLE pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_pk
        PRIMARY KEY (id);

ALTER TABLE pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_template_id_fk
        FOREIGN KEY (template_id) REFERENCES pt_project_templates
            ON DELETE CASCADE;

CREATE TABLE pt_tasks (
    id             UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name           TEXT                               NOT NULL,
    description    TEXT,
    total_minutes  NUMERIC DEFAULT 0                  NOT NULL,
    sort_order     INTEGER DEFAULT 0                  NOT NULL,
    priority_id    UUID                               NOT NULL,
    template_id    UUID                               NOT NULL,
    parent_task_id UUID,
    status_id      UUID                               NOT NULL
);

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_pk
        PRIMARY KEY (id);

ALTER TABLE pt_task_labels
    ADD CONSTRAINT pt_task_labels_task_id_fk
        FOREIGN KEY (task_id) REFERENCES pt_tasks
            ON DELETE CASCADE;

ALTER TABLE pt_task_phases
    ADD CONSTRAINT pt_task_phase_task_id_fk
        FOREIGN KEY (task_id) REFERENCES pt_tasks
            ON DELETE CASCADE;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_sort_order_unique
        UNIQUE (template_id, sort_order)
            DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_parent_task_id_fk
        FOREIGN KEY (parent_task_id) REFERENCES pt_tasks
            ON DELETE CASCADE;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_status_id_fk
        FOREIGN KEY (status_id) REFERENCES pt_statuses
            ON DELETE RESTRICT;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_template_fk
        FOREIGN KEY (template_id) REFERENCES pt_project_templates
            ON DELETE CASCADE;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_task_order_check
        CHECK (sort_order >= 0);

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_total_minutes_check
        CHECK ((total_minutes >= (0)::NUMERIC) AND (total_minutes <= (999999)::NUMERIC));

CREATE TABLE role_permissions (
    role_id       UUID NOT NULL,
    permission_id TEXT NOT NULL
);

ALTER TABLE role_permissions
    ADD CONSTRAINT role_permissions_pk
        PRIMARY KEY (role_id, permission_id);

ALTER TABLE role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fk
        FOREIGN KEY (permission_id) REFERENCES permissions;

CREATE TABLE roles (
    id           UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name         TEXT                               NOT NULL,
    team_id      UUID                               NOT NULL,
    default_role BOOLEAN DEFAULT FALSE              NOT NULL,
    admin_role   BOOLEAN DEFAULT FALSE              NOT NULL,
    owner        BOOLEAN DEFAULT FALSE              NOT NULL
);

CREATE UNIQUE INDEX roles_default_uindex
    ON roles (team_id)
    WHERE (default_role IS TRUE);

CREATE UNIQUE INDEX roles_name_team_id_uindex
    ON roles (name, team_id);

CREATE UNIQUE INDEX roles_owner_uindex
    ON roles (team_id)
    WHERE (owner IS TRUE);

ALTER TABLE roles
    ADD CONSTRAINT roles_pk
        PRIMARY KEY (id);

ALTER TABLE project_members
    ADD CONSTRAINT project_members_role_id_fk
        FOREIGN KEY (role_id) REFERENCES roles;

ALTER TABLE role_permissions
    ADD CONSTRAINT role_permissions_role_id_fk
        FOREIGN KEY (role_id) REFERENCES roles;

CREATE TABLE spam_emails (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    email      TEXT                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE UNIQUE INDEX spam_emails_email_uindex
    ON spam_emails (email);

ALTER TABLE spam_emails
    ADD CONSTRAINT spam_emails_pk
        PRIMARY KEY (id);

CREATE TABLE sys_project_healths (
    id         UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                               NOT NULL,
    color_code WL_HEX_COLOR                       NOT NULL,
    sort_order INTEGER DEFAULT 0                  NOT NULL,
    is_default BOOLEAN DEFAULT FALSE              NOT NULL
);

ALTER TABLE sys_project_healths
    ADD CONSTRAINT sys_project_healths_pk
        PRIMARY KEY (id);

ALTER TABLE projects
    ADD CONSTRAINT projects_sys_project_healths_id_fk
        FOREIGN KEY (health_id) REFERENCES sys_project_healths;

CREATE TABLE sys_project_statuses (
    id         UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                               NOT NULL,
    color_code WL_HEX_COLOR                       NOT NULL,
    icon       TEXT                               NOT NULL,
    sort_order INTEGER DEFAULT 0                  NOT NULL,
    is_default BOOLEAN DEFAULT FALSE              NOT NULL
);

ALTER TABLE sys_project_statuses
    ADD CONSTRAINT sys_project_statuses_pk
        PRIMARY KEY (id);

ALTER TABLE projects
    ADD CONSTRAINT projects_status_id_fk
        FOREIGN KEY (status_id) REFERENCES sys_project_statuses;

CREATE TABLE sys_task_status_categories (
    id          UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                               NOT NULL,
    color_code  WL_HEX_COLOR                       NOT NULL,
    index       INTEGER DEFAULT 0                  NOT NULL,
    is_todo     BOOLEAN DEFAULT FALSE              NOT NULL,
    is_doing    BOOLEAN DEFAULT FALSE              NOT NULL,
    is_done     BOOLEAN DEFAULT FALSE              NOT NULL,
    description TEXT
);

ALTER TABLE sys_task_status_categories
    ADD CONSTRAINT sys_task_status_categories_pk
        PRIMARY KEY (id);

ALTER TABLE cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_category_id_fk
        FOREIGN KEY (category_id) REFERENCES sys_task_status_categories;

ALTER TABLE pt_statuses
    ADD CONSTRAINT pt_project_template_statuses_category_id_fk
        FOREIGN KEY (category_id) REFERENCES sys_task_status_categories;

ALTER TABLE pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_category_id_fk
        FOREIGN KEY (category_id) REFERENCES sys_task_status_categories;

CREATE TABLE task_activity_logs (
    id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    task_id        UUID                                                NOT NULL,
    team_id        UUID                                                NOT NULL,
    attribute_type TEXT                                                NOT NULL,
    user_id        UUID                                                NOT NULL,
    log_type       TEXT,
    old_value      TEXT,
    new_value      TEXT,
    prev_string    TEXT,
    next_string    TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    project_id     UUID                                                NOT NULL
);

COMMENT ON COLUMN task_activity_logs.user_id IS 'id of the user who initiated the activity';

COMMENT ON COLUMN task_activity_logs.log_type IS 'whether the log belongs to create, update, delete, assign or unassign category';

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_pk
        PRIMARY KEY (id);

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_projects_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_log_type_check
        CHECK (log_type = ANY (ARRAY ['create'::TEXT, 'update'::TEXT, 'delete'::TEXT, 'assign'::TEXT, 'unassign'::TEXT]));

CREATE TABLE task_attachments (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                                                NOT NULL,
    size        BIGINT                   DEFAULT 0                  NOT NULL,
    type        TEXT                                                NOT NULL,
    task_id     UUID,
    team_id     UUID                                                NOT NULL,
    project_id  UUID                                                NOT NULL,
    uploaded_by UUID                                                NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE INDEX task_attachments_task_id_index
    ON task_attachments (task_id);

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_pk
        PRIMARY KEY (id);

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_name_check
        CHECK (CHAR_LENGTH(name) <= 110);

CREATE TABLE task_comment_contents (
    index          INTEGER NOT NULL,
    comment_id     UUID    NOT NULL,
    team_member_id UUID,
    text_content   TEXT
);

ALTER TABLE task_comment_contents
    ADD CONSTRAINT task_comment_contents_content_check
        CHECK (((team_member_id IS NULL) AND (text_content IS NULL)) IS FALSE);

ALTER TABLE task_comment_contents
    ADD CONSTRAINT task_comment_contents_name_check
        CHECK (CHAR_LENGTH(text_content) <= 2000);

CREATE TABLE task_comments (
    id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    user_id        UUID                                                NOT NULL,
    team_member_id UUID                                                NOT NULL,
    task_id        UUID                                                NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    ses_message_id TEXT
);

CREATE INDEX task_comments_task_id_index
    ON task_comments (task_id);

ALTER TABLE task_comments
    ADD CONSTRAINT task_comments_pk
        PRIMARY KEY (id);

ALTER TABLE task_comment_contents
    ADD CONSTRAINT task_comment_contents_comment_id_fk
        FOREIGN KEY (comment_id) REFERENCES task_comments
            ON DELETE CASCADE;

CREATE TABLE task_labels (
    task_id  UUID NOT NULL,
    label_id UUID NOT NULL
);

CREATE INDEX task_labels_task_id_index
    ON task_labels (task_id);

ALTER TABLE task_labels
    ADD CONSTRAINT task_labels_pk
        PRIMARY KEY (task_id, label_id);

CREATE TABLE team_labels (
    id         UUID DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                            NOT NULL,
    color_code WL_HEX_COLOR                    NOT NULL,
    team_id    UUID                            NOT NULL
);

CREATE INDEX team_labels_name_index
    ON team_labels (name);

CREATE UNIQUE INDEX team_labels_name_team_uindex
    ON team_labels (name, team_id);

ALTER TABLE team_labels
    ADD CONSTRAINT team_labels_pk
        PRIMARY KEY (id);

ALTER TABLE cpt_task_labels
    ADD CONSTRAINT cpt_task_labels_label_id_fk
        FOREIGN KEY (label_id) REFERENCES team_labels
            ON DELETE CASCADE;

ALTER TABLE task_labels
    ADD CONSTRAINT task_labels_label_id_fk
        FOREIGN KEY (label_id) REFERENCES team_labels
            ON DELETE CASCADE;

ALTER TABLE team_labels
    ADD CONSTRAINT team_labels_name_check
        CHECK (CHAR_LENGTH(name) <= 40);

CREATE TABLE task_phase (
    task_id  UUID NOT NULL,
    phase_id UUID NOT NULL
);

CREATE UNIQUE INDEX task_phase_task_id_uindex
    ON task_phase (task_id);

CREATE UNIQUE INDEX task_phase_task_phase_uindex
    ON task_phase (task_id, phase_id);

ALTER TABLE task_phase
    ADD CONSTRAINT task_phase_phase_id_fk
        FOREIGN KEY (phase_id) REFERENCES project_phases
            ON DELETE CASCADE;

CREATE TABLE task_priorities (
    id         UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                               NOT NULL,
    value      INTEGER DEFAULT 0                  NOT NULL,
    color_code WL_HEX_COLOR                       NOT NULL
);

CREATE UNIQUE INDEX task_priorities_name_uindex
    ON task_priorities (name);

ALTER TABLE task_priorities
    ADD CONSTRAINT task_priorities_pk
        PRIMARY KEY (id);

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_priority_fk
        FOREIGN KEY (priority_id) REFERENCES task_priorities;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_priority_fk
        FOREIGN KEY (priority_id) REFERENCES task_priorities;

CREATE TABLE task_statuses (
    id          UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                               NOT NULL,
    project_id  UUID                               NOT NULL,
    team_id     UUID                               NOT NULL,
    category_id UUID                               NOT NULL,
    sort_order  INTEGER DEFAULT 0                  NOT NULL
);

CREATE INDEX task_statuses_name_index
    ON task_statuses (name);

CREATE INDEX task_statuses_project_category_index
    ON task_statuses (project_id, category_id);

CREATE UNIQUE INDEX task_statuses_project_id_name_uindex
    ON task_statuses (project_id, name);

ALTER TABLE task_statuses
    ADD CONSTRAINT task_statuses_pk
        PRIMARY KEY (id);

ALTER TABLE task_statuses
    ADD CONSTRAINT task_statuses_category_id_fk
        FOREIGN KEY (category_id) REFERENCES sys_task_status_categories;

ALTER TABLE task_statuses
    ADD CONSTRAINT task_statuses_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE task_statuses
    ADD CONSTRAINT task_statuses_name_check
        CHECK (CHAR_LENGTH(name) <= 50);

CREATE TABLE task_subscribers (
    id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    user_id        UUID                                                NOT NULL,
    task_id        UUID                                                NOT NULL,
    team_member_id UUID                                                NOT NULL,
    action         TEXT                                                NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE INDEX task_subscribers_task_id_index
    ON task_subscribers (task_id);

CREATE INDEX task_subscribers_user_id_index
    ON task_subscribers (user_id);

CREATE UNIQUE INDEX task_subscribers_user_task_team_member_uindex
    ON task_subscribers (user_id, task_id, team_member_id);

ALTER TABLE task_subscribers
    ADD CONSTRAINT task_subscribers_pk
        PRIMARY KEY (id);

ALTER TABLE task_subscribers
    ADD CONSTRAINT task_subscribers_action_check
        CHECK (action = 'WHEN_DONE'::TEXT);

CREATE TABLE task_templates (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                                                NOT NULL,
    team_id    UUID                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

CREATE UNIQUE INDEX task_templates_name_team_uindex
    ON task_templates (name, team_id);

ALTER TABLE task_templates
    ADD CONSTRAINT task_templates_pk
        PRIMARY KEY (id);

CREATE TABLE task_templates_tasks (
    name          TEXT              NOT NULL,
    template_id   UUID              NOT NULL,
    total_minutes NUMERIC DEFAULT 0 NOT NULL
);

ALTER TABLE task_templates_tasks
    ADD CONSTRAINT task_templates_tasks_template_id_fk
        FOREIGN KEY (template_id) REFERENCES task_templates
            ON DELETE CASCADE;

CREATE TABLE task_timers (
    task_id    UUID NOT NULL,
    user_id    UUID NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE
);

CREATE INDEX task_timers_task_id_user_id_index
    ON task_timers (task_id, user_id);

ALTER TABLE task_timers
    ADD CONSTRAINT task_timers_pk
        PRIMARY KEY (task_id, user_id);

CREATE TABLE task_updates (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    type        TEXT                                                NOT NULL,
    reporter_id UUID                                                NOT NULL,
    task_id     UUID                                                NOT NULL,
    user_id     UUID                                                NOT NULL,
    team_id     UUID                                                NOT NULL,
    project_id  UUID                                                NOT NULL,
    is_sent     BOOLEAN                  DEFAULT FALSE              NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_pk
        PRIMARY KEY (id);

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_type_check
        CHECK (type = ANY (ARRAY ['ASSIGN'::TEXT, 'UNASSIGN'::TEXT]));

CREATE TABLE task_work_log (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    time_spent      NUMERIC                  DEFAULT 0                  NOT NULL,
    description     TEXT,
    logged_by_timer BOOLEAN                  DEFAULT FALSE              NOT NULL,
    task_id         UUID                                                NOT NULL,
    user_id         UUID                                                NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE task_work_log
    ADD CONSTRAINT task_work_log_pk
        PRIMARY KEY (id);

ALTER TABLE task_work_log
    ADD CONSTRAINT task_work_log_description_check
        CHECK (CHAR_LENGTH(description) <= 500);

ALTER TABLE task_work_log
    ADD CONSTRAINT task_work_log_time_spent_check
        CHECK (time_spent >= (0)::NUMERIC);

CREATE TABLE tasks (
    id                 UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name               TEXT                                                NOT NULL,
    description        TEXT,
    done               BOOLEAN                  DEFAULT FALSE              NOT NULL,
    total_minutes      NUMERIC                  DEFAULT 0                  NOT NULL,
    archived           BOOLEAN                  DEFAULT FALSE              NOT NULL,
    task_no            BIGINT                                              NOT NULL,
    start_date         TIMESTAMP WITH TIME ZONE,
    end_date           TIMESTAMP WITH TIME ZONE,
    priority_id        UUID                                                NOT NULL,
    project_id         UUID                                                NOT NULL,
    reporter_id        UUID                                                NOT NULL,
    parent_task_id     UUID,
    status_id          UUID                                                NOT NULL,
    completed_at       TIMESTAMP WITH TIME ZONE,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    sort_order         INTEGER                  DEFAULT 0                  NOT NULL,
    roadmap_sort_order INTEGER                  DEFAULT 0                  NOT NULL
);

CREATE INDEX tasks_created_at_index
    ON tasks (created_at);

CREATE INDEX tasks_id_project_id_index
    ON tasks (id, project_id);

CREATE INDEX tasks_name_index
    ON tasks (name);

CREATE INDEX tasks_parent_task_id_index
    ON tasks (parent_task_id);

CREATE INDEX tasks_project_id_index
    ON tasks (project_id);

CREATE INDEX tasks_sort_order_index
    ON tasks (sort_order);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_pk
        PRIMARY KEY (id);

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_tasks_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE SET NULL;

ALTER TABLE task_comments
    ADD CONSTRAINT task_comments_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_labels
    ADD CONSTRAINT task_labels_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_phase
    ADD CONSTRAINT task_phase_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_subscribers
    ADD CONSTRAINT task_subscribers_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_timers
    ADD CONSTRAINT task_timers_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_work_log
    ADD CONSTRAINT task_work_log_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_sort_order_unique
        UNIQUE (project_id, sort_order)
            DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_parent_task_id_fk
        FOREIGN KEY (parent_task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_priority_fk
        FOREIGN KEY (priority_id) REFERENCES task_priorities;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_project_fk
        FOREIGN KEY (project_id) REFERENCES projects;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_status_id_fk
        FOREIGN KEY (status_id) REFERENCES task_statuses
            ON DELETE RESTRICT;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_description_check
        CHECK (CHAR_LENGTH(description) <= 500000);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_name_check
        CHECK (CHAR_LENGTH(name) <= 500);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_total_minutes_check
        CHECK ((total_minutes >= (0)::NUMERIC) AND (total_minutes <= (999999)::NUMERIC));

CREATE TABLE tasks_assignees (
    task_id           UUID                                               NOT NULL,
    project_member_id UUID                                               NOT NULL,
    team_member_id    UUID                                               NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by       UUID                                               NOT NULL
);

CREATE INDEX tasks_assignees_team_member_id_index
    ON tasks_assignees (team_member_id);

ALTER TABLE tasks_assignees
    ADD CONSTRAINT tasks_assignees_pk
        PRIMARY KEY (task_id, project_member_id);

ALTER TABLE tasks_assignees
    ADD CONSTRAINT tasks_assignees_project_member_id_fk
        FOREIGN KEY (project_member_id) REFERENCES project_members
            ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE tasks_assignees
    ADD CONSTRAINT tasks_assignees_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

CREATE TABLE team_members (
    id           UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    user_id      UUID,
    team_id      UUID                                                NOT NULL,
    role_id      UUID                                                NOT NULL,
    job_title_id UUID,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    active       BOOLEAN                  DEFAULT TRUE
);

CREATE INDEX team_members_ids_index
    ON team_members (team_id, user_id, role_id);

CREATE INDEX team_members_team_id_index
    ON team_members (team_id);

CREATE INDEX team_members_user_id_team_id_index
    ON team_members (user_id, team_id);

CREATE UNIQUE INDEX team_members_user_id_team_id_uindex
    ON team_members (user_id, team_id);

ALTER TABLE team_members
    ADD CONSTRAINT team_members_pk
        PRIMARY KEY (id);

ALTER TABLE email_invitations
    ADD CONSTRAINT email_invitations_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE project_member_allocations
    ADD CONSTRAINT project_members_allocations_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE project_members
    ADD CONSTRAINT project_members_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE project_subscribers
    ADD CONSTRAINT project_subscribers_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE task_comment_contents
    ADD CONSTRAINT task_comment_contents_team_member_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members;

ALTER TABLE task_comments
    ADD CONSTRAINT task_comments_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE task_subscribers
    ADD CONSTRAINT task_subscribers_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE tasks_assignees
    ADD CONSTRAINT tasks_assignees_team_member_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE team_members
    ADD CONSTRAINT team_members_job_title_id_fk
        FOREIGN KEY (job_title_id) REFERENCES job_titles
            ON DELETE SET NULL;

ALTER TABLE team_members
    ADD CONSTRAINT team_members_role_id_fk
        FOREIGN KEY (role_id) REFERENCES roles;

-- START: Users
CREATE SEQUENCE IF NOT EXISTS users_user_no_seq START 1;

CREATE TABLE users (
    id              UUID                     DEFAULT uuid_generate_v4()                     NOT NULL,
    name            TEXT                                                                    NOT NULL,
    email           WL_EMAIL                                                                NOT NULL,
    password        TEXT,
    active_team     UUID,
    avatar_url      TEXT,
    setup_completed BOOLEAN                  DEFAULT FALSE                                  NOT NULL,
    user_no         BIGINT                   DEFAULT NEXTVAL('users_user_no_seq'::REGCLASS) NOT NULL,
    timezone_id     UUID                                                                    NOT NULL,
    google_id       TEXT,
    socket_id       TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP                      NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP                      NOT NULL,
    last_active     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP                      NOT NULL,
    temp_email      BOOLEAN                  DEFAULT FALSE
);

CREATE INDEX users_email_index
    ON users (email);

CREATE UNIQUE INDEX users_email_uindex
    ON users (email);

CREATE UNIQUE INDEX users_google_id_uindex
    ON users (google_id);

CREATE UNIQUE INDEX users_socket_id_uindex
    ON users (socket_id);

ALTER TABLE users
    ADD CONSTRAINT users_pk
        PRIMARY KEY (id);

ALTER TABLE archived_projects
    ADD CONSTRAINT archived_projects_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE favorite_projects
    ADD CONSTRAINT favorite_projects_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE notification_settings
    ADD CONSTRAINT notification_settings_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE organizations
    ADD CONSTRAINT organization_user_id_pk
        FOREIGN KEY (user_id) REFERENCES users ON DELETE CASCADE;

ALTER TABLE personal_todo_list
    ADD CONSTRAINT personal_todo_list_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users ON DELETE CASCADE;

ALTER TABLE project_categories
    ADD CONSTRAINT project_categories_created_by_fk
        FOREIGN KEY (created_by) REFERENCES users;

ALTER TABLE project_comment_mentions
    ADD CONSTRAINT project_comment_mentions_informed_by_fk
        FOREIGN KEY (informed_by) REFERENCES users;

ALTER TABLE project_comment_mentions
    ADD CONSTRAINT project_comment_mentions_mentioned_by_fk
        FOREIGN KEY (mentioned_by) REFERENCES users;

ALTER TABLE project_comments
    ADD CONSTRAINT project_comments_created_by_fk
        FOREIGN KEY (created_by) REFERENCES users;

ALTER TABLE project_folders
    ADD CONSTRAINT project_folders_created_by_fk
        FOREIGN KEY (created_by) REFERENCES users;

ALTER TABLE project_subscribers
    ADD CONSTRAINT project_subscribers_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE projects
    ADD CONSTRAINT projects_owner_id_fk
        FOREIGN KEY (owner_id) REFERENCES users;

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_uploaded_by_fk
        FOREIGN KEY (uploaded_by) REFERENCES users;

ALTER TABLE task_comments
    ADD CONSTRAINT task_comments_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE task_subscribers
    ADD CONSTRAINT task_subscribers_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE task_timers
    ADD CONSTRAINT task_timers_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_reporter_id_fk
        FOREIGN KEY (reporter_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE task_work_log
    ADD CONSTRAINT task_work_log_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_reporter_id_fk
        FOREIGN KEY (reporter_id) REFERENCES users;

ALTER TABLE tasks_assignees
    ADD CONSTRAINT tasks_assignees_assigned_by_fk
        FOREIGN KEY (assigned_by) REFERENCES users;

ALTER TABLE team_members
    ADD CONSTRAINT team_members_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE users
    ADD CONSTRAINT users_email_check
        CHECK (CHAR_LENGTH((email)::TEXT) <= 255);

ALTER TABLE users
    ADD CONSTRAINT users_name_check
        CHECK (CHAR_LENGTH(name) <= 55);

CREATE TABLE teams (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name            TEXT                                                NOT NULL,
    user_id         UUID                                                NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    organization_id UUID
);

CREATE INDEX teams_id_user_id_index
    ON teams (id, user_id);

ALTER TABLE teams
    ADD CONSTRAINT teams_pk
        PRIMARY KEY (id);

ALTER TABLE clients
    ADD CONSTRAINT clients_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE custom_project_templates
    ADD CONSTRAINT custom_project_templates_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE email_invitations
    ADD CONSTRAINT email_invitations_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE job_titles
    ADD CONSTRAINT job_titles_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams;

ALTER TABLE notification_settings
    ADD CONSTRAINT notification_settings_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE project_categories
    ADD CONSTRAINT project_categories_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE project_folders
    ADD CONSTRAINT project_folders_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams;

ALTER TABLE project_logs
    ADD CONSTRAINT project_logs_teams_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE projects
    ADD CONSTRAINT projects_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE team_labels
    ADD CONSTRAINT team_labels_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE task_statuses
    ADD CONSTRAINT task_statuses_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE task_templates
    ADD CONSTRAINT task_templates_teams_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE team_members
    ADD CONSTRAINT team_members_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE users
    ADD CONSTRAINT users_active_team_fk
        FOREIGN KEY (active_team) REFERENCES teams;

ALTER TABLE teams
    ADD CONSTRAINT team_organization_id_pk
        FOREIGN KEY (organization_id) REFERENCES organizations;

ALTER TABLE teams
    ADD CONSTRAINT teams_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE teams
    ADD CONSTRAINT teams_name_check
        CHECK (CHAR_LENGTH(name) <= 55);

CREATE TABLE timezones (
    id         UUID DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                            NOT NULL,
    abbrev     TEXT                            NOT NULL,
    utc_offset INTERVAL                        NOT NULL
);

CREATE INDEX timezones_name_index
    ON timezones (name);

ALTER TABLE timezones
    ADD CONSTRAINT timezones_pk
        PRIMARY KEY (id);

ALTER TABLE users
    ADD CONSTRAINT users_timezone_id_fk
        FOREIGN KEY (timezone_id) REFERENCES timezones;

CREATE TABLE user_notifications (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    message    TEXT                                                NOT NULL,
    user_id    UUID                                                NOT NULL,
    team_id    UUID                                                NOT NULL,
    read       BOOLEAN                  DEFAULT FALSE              NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    task_id    UUID,
    project_id UUID
);

ALTER TABLE user_notifications
    ADD CONSTRAINT user_notifications_pk
        PRIMARY KEY (id);

ALTER TABLE user_notifications
    ADD CONSTRAINT user_notifications_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE user_notifications
    ADD CONSTRAINT user_notifications_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE user_notifications
    ADD CONSTRAINT user_notifications_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE user_notifications
    ADD CONSTRAINT user_notifications_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

CREATE TABLE users_data (
    user_id                  UUID                           NOT NULL,
    organization_name        TEXT                           NOT NULL,
    contact_number           TEXT,
    contact_number_secondary TEXT,
    address_line_1           TEXT,
    address_line_2           TEXT,
    country                  UUID,
    city                     TEXT,
    state                    TEXT,
    postal_code              TEXT,
    trial_in_progress        BOOLEAN DEFAULT FALSE          NOT NULL,
    trial_expire_date        DATE,
    subscription_status      TEXT    DEFAULT 'active'::TEXT NOT NULL,
    storage                  INTEGER DEFAULT 1              NOT NULL,
    updating_plan            BOOLEAN DEFAULT FALSE
);

CREATE UNIQUE INDEX users_data_user_id_uindex
    ON users_data (user_id);

ALTER TABLE users_data
    ADD UNIQUE (user_id);

ALTER TABLE users_data
    ADD CONSTRAINT users_data_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE users_data
    ADD CONSTRAINT users_data_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

CREATE TABLE worklenz_alerts (
    description TEXT NOT NULL,
    type        TEXT NOT NULL,
    active      BOOLEAN DEFAULT FALSE
);

ALTER TABLE worklenz_alerts
    ADD CONSTRAINT worklenz_alerts_type_check
        CHECK (type = ANY (ARRAY ['success'::TEXT, 'info'::TEXT, 'warning'::TEXT, 'error'::TEXT]));


CREATE TABLE task_comment_mentions (
    comment_id      UUID                                               NOT NULL,
    mentioned_index INTEGER                  DEFAULT 0                 NOT NULL,
    mentioned_by    UUID                                               NOT NULL,
    informed_by     UUID                                               NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_comment_id_fk
        FOREIGN KEY (comment_id) REFERENCES task_comments
            ON DELETE CASCADE;

ALTER TABLE task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_mentioned_by_fk
        FOREIGN KEY (mentioned_by) REFERENCES users;

ALTER TABLE task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_informed_by_fk
        FOREIGN KEY (informed_by) REFERENCES team_members;

CREATE TABLE email_logs (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    email      TEXT                                                NOT NULL,
    subject    TEXT                                                NOT NULL,
    html       TEXT                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
