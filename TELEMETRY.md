# Self-hosted installation telemetry

Worklenz offers an optional heartbeat to help estimate adoption and the versions in use. It is **off by default**. To opt in, set `WORKLENZ_TELEMETRY_ENABLED=true` in the backend environment and restart the backend. Set it to `false` or remove it and restart to stop sending; cloud deployments do not send these heartbeats. Run the backend database migrations before enabling it.

The backend sends an HTTPS POST to `https://telemetry.worklenz.com/v1/heartbeat` containing only:

```json
{
  "event": "installation_active",
  "installation_id": "a-random-version-4-uuid",
  "version": "3.0.0"
}
```

The installation ID is a random UUID stored in the self-hosted PostgreSQL database, not a hardware ID. The version is the backend package version. No project content, user details, hostnames, deployment URLs, or credentials are included in the payload. A network request exposes its source IP to the receiving infrastructure; the payload is pseudonymous, not anonymous. The receiver and its hosting infrastructure are operated by Worklenz.

An opted-in backend waits a random interval of up to one hour, then attempts a heartbeat at most once every seven days. A database reservation coordinates replicas. Failed attempts after reservation are retried no sooner than the next weekly interval; failure never blocks startup or normal operation. Restoring or cloning a database also copies the installation ID and can affect counts.

The receiver stores the installation ID, most recent reported version, and time last seen. It does not store the event's source IP in the telemetry table. Records inactive for 90 days are deleted by the admin backend's daily cleanup (while it is running). Infrastructure access logs and backups have their own retention and may contain network metadata. Contact Worklenz to request deletion of an installation's stored record and include its installation ID; the ID can be found in the `self_hosted_telemetry_state` table. Disabling telemetry stops future sends, but does not immediately remove records already received.

The admin dashboard shows recent and retained opted-in installations. The counts are estimates: opt-in is voluntary, and requests can be blocked, lost, duplicated, or forged. This heartbeat does not record clone counts or individual users.
