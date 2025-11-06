-- projects
ALTER TABLE projects ADD COLUMN project_type VARCHAR(10);

DO $$
DECLARE
r RECORD;
BEGIN
FOR r IN (
SELECT conname
FROM pg_constraint
WHERE conrelid = 'projects'::regclass
AND contype = 'f'
)
LOOP
EXECUTE 'ALTER TABLE projects DROP CONSTRAINT ' || quote_ident(r.conname) || ' CASCADE';
END LOOP;
END$$;




-- tasks
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS sprint_id INTEGER;
ALTER TABLE tasks    ALTER COLUMN progress_mode TYPE varchar USING progress_mode::text;

DO $$
DECLARE
r RECORD;
BEGIN
FOR r IN (
SELECT conname
FROM pg_constraint
WHERE conrelid = 'tasks'::regclass
AND contype = 'f'
)
LOOP
EXECUTE 'ALTER TABLE tasks DROP CONSTRAINT ' || quote_ident(r.conname) || ' CASCADE';
END LOOP;
END$$;

DO $$
DECLARE
r RECORD;
BEGIN
FOR r IN (
SELECT conname
FROM pg_constraint
WHERE conrelid = 'sprints'::regclass
AND contype = 'f'
)
LOOP
EXECUTE 'ALTER TABLE sprint DROP CONSTRAINT ' || quote_ident(r.conname) || ' CASCADE';
END LOOP;
END$$;

--sprints
CREATE TABLE sprints (
                         id SERIAL PRIMARY KEY,
                         project_id UUID ,
                         name VARCHAR(100),
                         start_date DATE ,
                         end_date DATE ,
                         goal TEXT
);

ALTER TABLE sprints
    ADD COLUMN subTask JSONB;



-- 删除对应的非空限制
DO $$
    DECLARE
r RECORD;
BEGIN
FOR r IN
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'sprints'
  AND is_nullable = 'NO'
  AND column_name NOT IN (
    SELECT a.attname
    FROM pg_index i
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'sprints'::regclass
  AND i.indisprimary
    )
    LOOP
    EXECUTE format('ALTER TABLE sprints ALTER COLUMN %I DROP NOT NULL;', r.column_name);
END LOOP;
END $$;


DO $$
    DECLARE
r RECORD;
BEGIN
FOR r IN
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND is_nullable = 'NO'
  AND column_name NOT IN (
    SELECT a.attname
    FROM pg_index i
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'tasks'::regclass
  AND i.indisprimary
    )
    LOOP
    EXECUTE format('ALTER TABLE tasks ALTER COLUMN %I DROP NOT NULL;', r.column_name);
END LOOP;
END $$;

DO $$
    DECLARE
r RECORD;
BEGIN
FOR r IN
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'projects'
  AND is_nullable = 'NO'
  AND column_name NOT IN (
    SELECT a.attname
    FROM pg_index i
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'projects'::regclass
  AND i.indisprimary
    )
    LOOP
    EXECUTE format('ALTER TABLE projects ALTER COLUMN %I DROP NOT NULL;', r.column_name);
END LOOP;
END $$;
ALTER TABLE sprints
ALTER COLUMN subtask TYPE jsonb USING subtask::jsonb;
