# Huichuang Admin · Backend (ADMINSERVER)

## System Overview

The NestJS backend of the Huichuang Admin Console Base. It provides the RBAC permission system and shared capabilities for the frontend: JWT login, user/role/menu/operation management, menu column templates, Excel data import, file upload and restore defaults.

The server is designed for **standalone local deployment**: the database defaults to `127.0.0.1`, configured through `.env`, with no dependency on remote servers or third-party authorization services.

## Features

- Login: account + password (bcrypt) → JWT
- Token refresh via `refresh_token`
- User management: paginated list with filter/sort, add, update, delete, change password, profile
- Role management: list, add, update, delete, detail
- Permission configuration: menu & operation (button-level) permissions per role
- Menu management: menu tree (directories/menus), ordering, add/update/delete
- Operation management: per-menu operations (API sign/address/method)
- Menu column templates: per-menu list column configuration (title/field/width/sort/visibility)
- Excel import: single-table import, batch import, import history, clear history
- File services: image/file upload, list, base64 content, delete
- Restore defaults: rebuild the database from `src/sql/default.sql`
- Cross-cutting: global prefix `/hippoadmin`, unified response envelope, exception filter, CORS

## Tech Stack

```text
Backend
├── NestJS 10
├── TypeScript
├── TypeORM
├── MySQL (default 127.0.0.1:3306)
├── @nestjs/jwt + passport-jwt
└── bcrypt / class-validator / xlsx

Frontend (provided by ADMINCLIENT)
└── Vue 3 + TDesign (talks to this service via /hippoadmin)
```

## Installation

Requirements: Node.js >= 18 (Node 20 LTS recommended).

```bash
# 1. Install dependencies
npm install

# 2. Configure .env (see .env.example)
#    - JWT_SECRET: signing secret
#    - DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_DATABASE

# 3. Create the local database
#    Default schema: etp_default_sql; on first boot synchronize=true creates the tables;
#    seed data can be loaded via "System Settings → Restore Defaults" (default.sql)

# 4. Start the service (dev mode, listens on 5004, prefix /hippoadmin)
npm run start:dev

# Production build & run
npm run build
npm run start:prod
```

Common scripts (per `package.json`): `start` / `start:dev` / `start:debug` / `start:prod` / `build` / `lint` / `format` / `test` / `test:e2e`.

Database: runs on the local machine at `127.0.0.1` (`DB_HOST=127.0.0.1`). Schema name and credentials can be adjusted in `.env` for your local environment.

> Related frontend project: [ADMINCLIENT](../ADMINCLIENT/README.md)
