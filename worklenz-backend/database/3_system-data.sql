CREATE OR REPLACE FUNCTION sys_insert_task_priorities() RETURNS VOID AS
$$
BEGIN
    INSERT INTO task_priorities (name, value, color_code) VALUES ('Low', 0, '#75c997');
    INSERT INTO task_priorities (name, value, color_code) VALUES ('Medium', 1, '#fbc84c');
    INSERT INTO task_priorities (name, value, color_code) VALUES ('High', 2, '#f37070');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sys_insert_project_access_levels() RETURNS VOID AS
$$
BEGIN
    INSERT INTO project_access_levels (name, key)
    VALUES ('Admin', 'ADMIN');
    INSERT INTO project_access_levels (name, key)
    VALUES ('Member', 'MEMBER');
    INSERT INTO project_access_levels (name, key)
    VALUES ('Project Manager', 'PROJECT_MANAGER');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sys_insert_task_status_categories() RETURNS VOID AS
$$
BEGIN
    INSERT INTO sys_task_status_categories (name, color_code, index, is_todo)
    VALUES ('To do', '#a9a9a9', 0, TRUE);
    INSERT INTO sys_task_status_categories (name, color_code, index, is_doing)
    VALUES ('Doing', '#70a6f3', 1, TRUE);
    INSERT INTO sys_task_status_categories (name, color_code, index, is_done)
    VALUES ('Done', '#75c997', 2, TRUE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sys_insert_project_statuses() RETURNS VOID AS
$$
BEGIN
    INSERT INTO sys_project_statuses (name, color_code, icon, sort_order, is_default)
    VALUES ('Cancelled', '#f37070', 'close-circle', 0, FALSE),
           ('Blocked', '#cbc8a1', 'stop', 1, FALSE),
           ('On Hold', '#cbc8a1', 'stop', 2, FALSE),
           ('Proposed', '#cbc8a1', 'clock-circle', 3, TRUE),
           ('In Planning', '#cbc8a1', 'clock-circle', 4, FALSE),
           ('In Progress', '#80ca79', 'clock-circle', 5, FALSE),
           ('Completed', '#80ca79', 'check-circle', 6, FALSE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sys_insert_project_healths() RETURNS VOID AS
$$
BEGIN
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('Not Set', '#a9a9a9', 0, TRUE);
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('Needs Attention', '#fbc84c', 1, FALSE);
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('At Risk', '#f37070', 2, FALSE);
    INSERT INTO sys_project_healths (name, color_code, sort_order, is_default)
    VALUES ('Good', '#75c997', 3, FALSE);
END;
$$ LANGUAGE plpgsql;


SELECT sys_insert_task_priorities();
SELECT sys_insert_project_access_levels();
SELECT sys_insert_task_status_categories();
SELECT sys_insert_project_statuses();
SELECT sys_insert_project_healths();

DROP FUNCTION sys_insert_task_priorities();
DROP FUNCTION sys_insert_project_access_levels();
DROP FUNCTION sys_insert_task_status_categories();
DROP FUNCTION sys_insert_project_statuses();
DROP FUNCTION sys_insert_project_healths();

INSERT INTO timezones (name, abbrev, utc_offset)
SELECT name, abbrev, utc_offset
FROM pg_timezone_names;
