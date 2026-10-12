/* eslint-disable camelcase */

exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS departments (
      id         UUID DEFAULT uuid_generate_v4() NOT NULL,
      name       VARCHAR(255) NOT NULL,
      team_id    UUID NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      CONSTRAINT departments_pk PRIMARY KEY (id),
      CONSTRAINT departments_team_id_fk FOREIGN KEY (team_id) REFERENCES teams ON DELETE CASCADE,
      CONSTRAINT departments_name_team_id_uindex UNIQUE (name, team_id)
    );

    ALTER TABLE team_members ADD COLUMN IF NOT EXISTS department_id UUID;
    ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_department_id_fk;
    ALTER TABLE team_members ADD CONSTRAINT team_members_department_id_fk
      FOREIGN KEY (department_id) REFERENCES departments ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS departments_team_id_index ON departments (team_id);
    CREATE INDEX IF NOT EXISTS team_members_department_id_index ON team_members (department_id);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_department_id_fk;
    ALTER TABLE team_members DROP COLUMN IF EXISTS department_id;
    DROP TABLE IF EXISTS departments;
  `);
};
