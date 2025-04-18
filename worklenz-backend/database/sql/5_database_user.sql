REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE ROLE worklenz_client;

GRANT CONNECT ON DATABASE worklenz_db TO worklenz_client;
GRANT INSERT, SELECT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO worklenz_client;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO worklenz_client;

REVOKE ALL PRIVILEGES ON task_priorities FROM worklenz_client;
GRANT SELECT ON task_priorities TO worklenz_client;

REVOKE ALL PRIVILEGES ON project_access_levels FROM worklenz_client;
GRANT SELECT ON project_access_levels TO worklenz_client;

REVOKE ALL PRIVILEGES ON timezones FROM worklenz_client;
GRANT SELECT ON timezones TO worklenz_client;

REVOKE ALL PRIVILEGES ON worklenz_alerts FROM worklenz_client;
GRANT SELECT ON worklenz_alerts TO worklenz_client;

REVOKE ALL PRIVILEGES ON sys_task_status_categories FROM worklenz_client;
GRANT SELECT ON sys_task_status_categories TO worklenz_client;

REVOKE ALL PRIVILEGES ON sys_project_statuses FROM worklenz_client;
GRANT SELECT ON sys_project_statuses TO worklenz_client;

REVOKE ALL PRIVILEGES ON sys_project_healths FROM worklenz_client;
GRANT SELECT ON sys_project_healths TO worklenz_client;

CREATE USER worklenz_backend WITH PASSWORD 'n?&bb24=aWmnw+G@';
GRANT worklenz_client TO worklenz_backend;
