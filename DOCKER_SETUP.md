# Docker setup

The supplied `docker-compose.yml` runs the application, PostgreSQL, SeaweedFS,
nginx, and a database backup container. It uses version-pinned published images;
these can differ from the source in your checkout. Review the image tags before
upgrading, and back up your data first.

## Database migrations and upgrades

Compose runs a one-shot migration service using the same backend image as the
API. It waits for PostgreSQL initialization and must finish successfully before
the backend starts. New databases are initialized and migrated automatically.
Image `3.4.3` does not support this migration service; use the matching images
specified in this release's Compose file.

For this Compose deployment, migrations target the bundled database and
`DB_NAME`, matching the API, even if migration-specific host, port, or database
overrides are set in `.env`. `MIGRATION_DB_USER` and `MIGRATION_DB_PASSWORD`
remain available when migrations need a more privileged database role.

An existing or restored database must have recorded Node migration history.
Otherwise the migration service stops without running migrations: back up the
database and review [the migration guide](worklenz-backend/database/README-pg-migrations.md)
before resolving its history. The migration bootstrap script is never run
automatically. Inspect failures using `docker compose logs migrate`.

Before upgrading, stop the backend and all other writers, back up the database
and object storage, and verify that the backup can be restored. Compose does not
stop a previously running backend before starting the migration service. In
multi-instance deployments, coordinate all writers: the migration lock prevents
concurrent migrations, but does not stop an older application from writing.

For local verification, a backend image can be built with
`docker build -f worklenz-backend/Dockerfile -t worklenz-backend:migration-test worklenz-backend`
and selected by setting `WORKLENZ_BACKEND_IMAGE=worklenz-backend:migration-test`
in `.env` before starting Compose.

## Prerequisites

Install Git, OpenSSL, Docker Engine and the Docker Compose plugin. The host needs ports
80 and 443 available. The default configuration also publishes ports 3000,
5000, 5174 and 8333; restrict access to those ports with your firewall as
appropriate. The database container installs `dos2unix` at startup and therefore
needs package repository access.

## Setup

The interactive `./quick-setup.sh` generates secrets and delegates installation
to `manage.sh`. For a public deployment, first place your externally provisioned
certificate and key at `nginx/ssl/cert.pem` and `nginx/ssl/key.pem`; the installer
does not issue or renew certificates. Configure an HTTPS storage endpoint reachable
by remote browsers and set `S3_PUBLIC_URL` in `.env` to its bucket URL; the
default points to each browser's localhost. After changing it, run
`docker compose up -d --force-recreate backend` to apply the setting. Review the
generated `.env` and nginx configuration. Alternatively, configure the stack manually:

```bash
git clone https://github.com/Worklenz/worklenz.git
cd worklenz
cp .env.example .env
```

Replace the example database password, session, cookie and JWT secrets, and
`S3_SECRET_ACCESS_KEY` in `.env`. Set the domain, application URLs and
`S3_PUBLIC_URL` to addresses reachable by your users. For production, configure
CORS and use HTTPS. In particular, the default `http://localhost:8333` storage
URL only works locally; configure a reachable HTTPS S3 endpoint and certificate
for remote browsers. The bundled nginx configuration does not proxy SeaweedFS. See the comments in
`.env.example` for the available values.

Nginx expects `nginx/ssl/cert.pem` and `nginx/ssl/key.pem` before it starts.
For a domain, put the server certificate followed by any required intermediate
certificates in `cert.pem` and use regular files for both PEM paths. The installer
does not verify that clients trust the chain; verify it and renew it externally.
For **local testing only**, create a
self-signed certificate (browsers will show a warning):

```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem \
  -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
docker compose up -d
```

Visit `https://localhost` for a local installation. HTTP requests redirect to
HTTPS. For a remote server, replace localhost with the configured domain.

The Compose file does not define `express`, `advanced`, `ssl` or `backup`
profiles: setting `DEPLOYMENT_MODE` or supplying a profile alone does not swap
bundled services for external ones. Using an external database or storage
requires adapting the Compose configuration and verifying connectivity.

## Operations

```bash
docker compose ps
docker compose logs -f
docker compose stop
docker compose start
```

PostgreSQL data and SeaweedFS data use Docker volumes. The `db-backup` service
writes daily SQL backups to `pg_backups` and removes SQL files older than 30
days only after a successful backup. Monitor container logs for backup failures.
Those database backups do **not** include attachments in the SeaweedFS
volume. Back up both data sets off-host and test restoration before relying on
them. Stopping containers preserves volumes; `docker compose down -v` deletes
Compose-managed volumes and should be used only when intentionally removing
data.

For a database backup, use the configured database user and name:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > worklenz-backup.sql
```

See [SELF_HOSTING.md](SELF_HOSTING.md) for licensing and
[README.md](README.md) for configuration and analytics information.
