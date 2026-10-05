# Worklenz Addons

This directory is the installation target for optional Worklenz addons and plugins.

---

## 🚀 Overview

Addons are modular, self-contained extensions that integrate with Worklenz via backend routers, frontend routes, and UI extension slots.

### Directory Structure

Place addon directories directly into `addons/`:

```
addons/<addon-id>/
├── manifest.json       # Metadata, slot declarations, and migration table name
├── backend/            # Express routes, controllers, and migrations (optional)
│   ├── migrations/     # Database migrations run via node-pg-migrate
│   └── routes.ts       # Express router mounted at /api/v1/addons/<addon-id>
└── frontend/           # React UI components, routes, and slots (optional)
    ├── routes.tsx      # Application routes registered dynamically
    ├── slots.tsx       # UI extension slots (navigation items, project columns, tabs)
    └── store.ts        # Redux reducers and middleware
```

---

## ⚙️ Configuration

### 1. Enabling Addons
Enable installed addons by specifying their directory IDs in your environment configuration (`.env`):

```env
ENABLED_ADDONS=my-addon,sample-plugin
```

For frontend-only builds, you can also define:

```env
VITE_ENABLED_ADDONS=my-addon,sample-plugin
```

### 2. Addon Database Migrations
Run migrations for all enabled addons:

```bash
cd worklenz-backend
npm run migrate:addons
```

Each addon tracks its schema in its own isolated migrations table (e.g. `pgmigrations_<addon_id>`), ensuring the core database schema remains clean and decoupled.
