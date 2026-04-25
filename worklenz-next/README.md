# Worklenz Next.js Migration App

This app is the production migration target for:

- Next.js App Router
- Clerk authentication
- Prisma on Supabase Postgres
- Supabase Realtime
- Cloudflare R2 object storage
- Upstash Redis cache
- Resend + React Email
- Vercel Cron
- Axiom logging

## Local run

1. Copy `.env.example` to `.env.local` and fill values.
2. Install dependencies:

```bash
npm install
```

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Start the app:

```bash
npm run dev
```

## Production notes

- Deploy this folder as the Vercel project root.
- Add `CRON_SECRET` and all service credentials in Vercel env settings.
- Set Supabase pooled URL as `DATABASE_URL` and direct connection URL as `DIRECT_URL`.
- This migration intentionally removes local DB backup services, nginx, and certbot from the deployment path.
