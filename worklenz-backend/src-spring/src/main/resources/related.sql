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

