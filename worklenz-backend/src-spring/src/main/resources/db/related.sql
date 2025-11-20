-- projects
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS project_type VARCHAR(10);

-- 删除 projects 的外键约束（如果存在）
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
                EXECUTE 'ALTER TABLE projects DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
            END LOOP;
    END $$;

-- 删除 projects 中非主键列的 NOT NULL 约束
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

-- tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id INTEGER;

-- 修改 progress_mode 类型（如果不是 varchar）
DO $$
    BEGIN
        IF (SELECT data_type FROM information_schema.columns
            WHERE table_name='tasks' AND column_name='progress_mode') != 'character varying'
        THEN
            ALTER TABLE tasks ALTER COLUMN progress_mode TYPE varchar USING progress_mode::text;
        END IF;
    END $$;

-- 删除 tasks 的外键约束（如果存在）
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
                EXECUTE 'ALTER TABLE tasks DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
            END LOOP;
    END $$;

-- 删除 tasks 中非主键列的 NOT NULL 约束
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



-- sprints
CREATE TABLE IF NOT EXISTS sprints (
                                       id SERIAL PRIMARY KEY,
                                       project_id UUID,
                                       name VARCHAR(100),
                                       start_date DATE,
                                       end_date DATE,
                                       goal TEXT
);

ALTER TABLE sprints
    ADD COLUMN IF NOT EXISTS subTask JSONB;




-- 修改 sprints.subtask 类型为 jsonb（如果不是 jsonb）
DO $$
    BEGIN
        IF (SELECT data_type FROM information_schema.columns
            WHERE table_name='sprints' AND column_name='subtask') != 'jsonb'
        THEN
            ALTER TABLE sprints
                ALTER COLUMN subtask TYPE jsonb USING subtask::jsonb;
        END IF;
    END $$;
