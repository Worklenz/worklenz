/* eslint-disable camelcase */

exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS practices (
      id         UUID DEFAULT uuid_generate_v4() NOT NULL,
      name       VARCHAR(255) NOT NULL,
      team_id    UUID NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      CONSTRAINT practices_pk PRIMARY KEY (id),
      CONSTRAINT practices_team_id_fk FOREIGN KEY (team_id) REFERENCES teams ON DELETE CASCADE,
      CONSTRAINT practices_name_team_id_uindex UNIQUE (name, team_id)
    );

    ALTER TABLE team_members ADD COLUMN IF NOT EXISTS practice_id UUID;
    ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_practice_id_fk;
    ALTER TABLE team_members ADD CONSTRAINT team_members_practice_id_fk
      FOREIGN KEY (practice_id) REFERENCES practices ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS practices_team_id_index ON practices (team_id);
    CREATE INDEX IF NOT EXISTS team_members_practice_id_index ON team_members (practice_id);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_practice_id_fk;
    ALTER TABLE team_members DROP COLUMN IF EXISTS practice_id;
    DROP TABLE IF EXISTS practices;
  `);
};
