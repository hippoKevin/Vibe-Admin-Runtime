# Huichuang Admin · Frontend (ADMINCLIENT)

## System Overview

The web admin console of the Huichuang Admin Console Base. It targets daily internal management scenarios and ships with ready-to-use admin capabilities: users, roles, menus and permissions (RBAC), data import and column-template configuration.

The whole system can run and be demonstrated locally:

- The frontend dev server listens at `http://localhost:5009` by default;
- The backend API defaults to the local machine `127.0.0.1:5004`;
- **In development, when Mock is enabled (`VITE_ENABLE_MOCK = true/force`), pages are served directly from the JSON files under `mock/` without calling the backend** (never enabled in production).

## Features

- Login and JWT token refresh
- User management: CRUD over account/name/role/phone/email/gender
- Role management: role CRUD plus menu & button-level permission configuration
- Menu management: directories & menus, ordering, operations (button/API) management
- Menu column-template configuration: per-list column title/field/width/sort/visibility
- Data import: single-table Excel import, batch import, import history
- Personal center: view and update profile
- Change password
- System settings and "About Us" (WeChat OA / GitHub / Bilibili)
- Restore defaults (reset the local database to seed data)
- i18n (zh-CN / en-US), theme color & dark-mode switching, global menu search
- Automatic Mock data support in development

## Tech Stack

```text
Frontend
├── Vue 3
├── TypeScript
├── Vite
├── Pinia
├── Vue Router
├── TDesign Vue Next
└── vue-i18n

Backend (provided by ADMINSERVER)
├── NestJS
├── TypeORM
└── MySQL (default 127.0.0.1)

Development
└── Mock JSON (mock/ directory)
```

## Installation

Requirements: Node.js `^20.19.0 || >=22.12.0`.

```bash
# 1. Install dependencies
npm install

# 2. Start the frontend dev server (default http://localhost:5009)
npm run dev

# 3. Production build / preview
npm run build
npm run preview

# 4. Type check / lint
npm run type-check
npm run lint

# 5. E2E tests (optional; install Playwright browsers first)
npx playwright install
npm run test:e2e
```

Environment variables (`ADMINCLIENT/.env.development` / `.env.production`):

| Variable             | Description                                    | Dev default | Prod default |
| -------------------- | ---------------------------------------------- | ----------- | ------------ |
| `VITE_OPEN_CLIENT`   | Dev server host                                | `0.0.0.0`   | -            |
| `VITE_OPEN_CLIENT_PORT` | Dev server port                             | `5009`      | -            |
| `VITE_SERVER_URL`    | Backend API address (proxy target)             | `127.0.0.1:5004` | `127.0.0.1:5004` |
| `VITE_ENABLE_MOCK`   | Enable automatic Mock (development only)       | `true`      | `false`      |

## Using Mock

In development, when the backend cannot be reached, the system automatically serves the JSON files under `mock/` — no business page changes are required.

- Mock data location: `ADMINCLIENT/mock/*.json`
  - `users.json` (users), `roles.json` (roles), `menus.json` (menus), `menu_status.json` (column templates), `operations.json` (operations), `ports.json` (endpoints), `import_history.json` (import history)
- Mock responses keep the same structure as the real backend (`code: 2000 / message / data`), so pages never need to tell real data from mock data
- Switch: with `.env.development` setting `VITE_ENABLE_MOCK = true` or `force` the **pure-Mock mode** is enabled — every mapped endpoint is served directly from `mock/` without any backend call; set it to `auto` to call the backend first and only fall back on failure; `.env.production` must keep it `false` — production never serves mock data
- Restart `npm run dev` after changing environment variables
- Demo accounts for Mock: `admin / 123456` and `viewer / 123456`

> Related backend project: [ADMINSERVER](../ADMINSERVER/README.md)
