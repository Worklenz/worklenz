# Audit retention database access

Migration `1792051800000_restrict_audit_retention_execution` removes public and
application-role execution of `purge_expired_audit_events`. Only the function owner
and the `worklenz_audit_retention` role can invoke it. The runtime `worklenz_client`
role cannot delete audit events or call the privileged purge function.

For deployments with a restricted application database login, provision a separate
worker login using an administrator's psql session:

```sql
CREATE ROLE audit_retention_worker LOGIN;
GRANT worklenz_audit_retention TO audit_retention_worker;
\password audit_retention_worker
```

Set `AUDIT_RETENTION_DB_USER=audit_retention_worker` and
`AUDIT_RETENTION_DB_PASSWORD` through the deployment's secret configuration. The
retention cron job uses a dedicated pool of one connection with those credentials.
Do not grant the retention role to the application login.

When no separate worker login is configured, the existing database pool is used.
A function-owner login can execute the purge; a restricted application login is
refused by PostgreSQL, logged by the job, and no records are removed. Configure the
worker login to keep scheduled retention running in that deployment.
