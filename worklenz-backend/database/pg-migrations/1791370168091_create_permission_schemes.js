'use strict';
// Roles & Permissions: creates the permission scheme tables required for the
// Admin Center > Security > Roles & Permissions feature.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    -- 1. permission_schemes
    CREATE TABLE IF NOT EXISTS permission_schemes (
      id          UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      team_id     UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name        TEXT        NOT NULL,
      is_default  BOOLEAN     NOT NULL DEFAULT FALSE,
      is_locked   BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ          DEFAULT NOW(),
      updated_at  TIMESTAMPTZ          DEFAULT NOW(),
      UNIQUE (team_id, name)
    );

    -- 2. permission_scheme_roles
    CREATE TABLE IF NOT EXISTS permission_scheme_roles (
      id          UUID  NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      scheme_id   UUID  NOT NULL REFERENCES permission_schemes(id) ON DELETE CASCADE,
      role_name   TEXT  NOT NULL,
      sort_order  INT   NOT NULL DEFAULT 0,
      UNIQUE (scheme_id, role_name)
    );

    -- 3. permission_scheme_grants
    CREATE TABLE IF NOT EXISTS permission_scheme_grants (
      id          UUID     NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      scheme_id   UUID     NOT NULL REFERENCES permission_schemes(id) ON DELETE CASCADE,
      role_name   TEXT     NOT NULL,
      permission  TEXT     NOT NULL,
      granted     BOOLEAN  NOT NULL DEFAULT FALSE,
      UNIQUE (scheme_id, role_name, permission)
    );

    -- 4. project_scheme_assignments
    CREATE TABLE IF NOT EXISTS project_scheme_assignments (
      id          UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scheme_id   UUID        REFERENCES permission_schemes(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ          DEFAULT NOW(),
      UNIQUE (project_id)
    );

    -- 5. permission_groups
    CREATE TABLE IF NOT EXISTS permission_groups (
      id          UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      team_id     UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name        TEXT        NOT NULL,
      created_at  TIMESTAMPTZ          DEFAULT NOW(),
      UNIQUE (team_id, name)
    );

    -- 6. permission_group_members
    CREATE TABLE IF NOT EXISTS permission_group_members (
      id              UUID  NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      group_id        UUID  NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
      team_member_id  UUID  NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
      UNIQUE (group_id, team_member_id)
    );

    -- 7. scheme_role_members  (member OR group, never both)
    CREATE TABLE IF NOT EXISTS scheme_role_members (
      id              UUID  NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      project_id      UUID  NOT NULL REFERENCES projects(id)           ON DELETE CASCADE,
      scheme_id       UUID  NOT NULL REFERENCES permission_schemes(id)  ON DELETE CASCADE,
      role_name       TEXT  NOT NULL,
      team_member_id  UUID  REFERENCES team_members(id)       ON DELETE CASCADE,
      group_id        UUID  REFERENCES permission_groups(id)  ON DELETE CASCADE,
      CONSTRAINT srm_exactly_one_member CHECK (
        (team_member_id IS NOT NULL AND group_id IS NULL)
        OR (team_member_id IS NULL  AND group_id IS NOT NULL)
      )
    );

    -- Partial unique constraints for scheme_role_members (nullable cols require partial indexes)
    CREATE UNIQUE INDEX IF NOT EXISTS srm_uq_team_member
      ON scheme_role_members (project_id, scheme_id, role_name, team_member_id)
      WHERE team_member_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS srm_uq_group
      ON scheme_role_members (project_id, scheme_id, role_name, group_id)
      WHERE group_id IS NOT NULL;
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS scheme_role_members          CASCADE;
    DROP TABLE IF EXISTS permission_group_members     CASCADE;
    DROP TABLE IF EXISTS permission_groups            CASCADE;
    DROP TABLE IF EXISTS project_scheme_assignments   CASCADE;
    DROP TABLE IF EXISTS permission_scheme_grants     CASCADE;
    DROP TABLE IF EXISTS permission_scheme_roles      CASCADE;
    DROP TABLE IF EXISTS permission_schemes           CASCADE;
  `);
};
