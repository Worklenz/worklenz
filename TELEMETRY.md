# Self-hosted installation telemetry

Worklenz sends an optional heartbeat to help estimate adoption and the versions in use. It is **on by default for self-hosted installations**. To disable it, set `WORKLENZ_TELEMETRY_ENABLED=false` in the backend environment and restart the backend. Removing the variable enables telemetry again; `true` also enables it. Other values disable telemetry. Cloud deployments do not send these heartbeats. Run the backend database migrations before starting the backend.

The backend sends an HTTPS POST to `https://telemetry.worklenz.com/v1/heartbeat` containing only:

```json
{
  "event": "installation_active",
  "installation_id": "a-random-version-4-uuid",
  "version": "3.0.0"
}
```

The installation ID is a random UUID stored in the self-hosted PostgreSQL database, not a hardware ID. The version is the backend package version. No project content, user details, hostnames, deployment URLs, or credentials are included in the payload. A network request exposes its source IP to the receiving infrastructure; the payload is pseudonymous, not anonymous. The receiver and its hosting infrastructure are operated by Worklenz.

A telemetry-enabled backend waits a random interval of up to one hour, then sends a heartbeat approximately once every seven days. A database reservation coordinates replicas. After a failed attempt, a retry is scheduled no sooner than one day later when possible; a crash or database failure can delay it until the next weekly interval. Retries may produce duplicate requests if the receiver accepted a response that was lost; failure never blocks startup or normal operation. Restoring or cloning a database also copies the installation ID and can affect counts.

The receiver stores the installation ID, most recent reported version, and time last seen. It does not store the event's source IP in the telemetry table. Records inactive for 90 days are deleted by the admin backend's daily cleanup (while it is running). Infrastructure access logs and backups have their own retention and may contain network metadata. Contact Worklenz to request deletion of an installation's stored record and include its installation ID; the ID can be found in the `self_hosted_telemetry_state` table. Disabling telemetry stops future sends, but does not immediately remove records already received.

The admin dashboard shows recent and retained telemetry-enabled installations. The counts are estimates: telemetry can be disabled, and requests can be blocked, lost, duplicated, or forged. This heartbeat does not record clone counts or individual users.
