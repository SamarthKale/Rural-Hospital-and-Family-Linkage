# GraamSwasthya — Rural Healthcare Platform

Household-centric rural healthcare web application for maternal & child health management.

## Architecture

- **Backend**: Express.js + Supabase (service role, RLS disabled)
- **Frontend**: React 18 + Vite + Tailwind CSS 3
- **State**: Zustand (auth, alerts) + TanStack Query v5 (server state)
- **Charts**: Recharts
- **Database**: PostgreSQL (Supabase) — 22 tables, 3NF schema

## Project Structure

```
graamswasthya/
├── backend/
│   ├── src/
│   │   ├── cron/         alertCron.js (8 alert types, every 6h)
│   │   ├── middleware/   verifyJWT, roleGuard, villageScope, errorHandler
│   │   ├── routes/       auth, villages, households, members, relationships,
│   │   │                 pregnancies, immunizations, illnessLogs, alerts,
│   │   │                 diseases, admin
│   │   ├── utils/        supabaseClient, logger
│   │   └── index.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/          axios.js (interceptors)
│   │   ├── components/
│   │   │   ├── common/   15 shared components
│   │   │   └── layout/   AppLayout (collapsible sidebar)
│   │   ├── hooks/        useApi.js (35+ TanStack Query hooks)
│   │   ├── pages/        8 page components
│   │   ├── stores/       authStore, alertStore (Zustand)
│   │   ├── utils/        helpers.js
│   │   ├── App.jsx       Router + protected routes
│   │   ├── main.jsx      Entry point
│   │   └── index.css     Tailwind + custom components
│   ├── .env.example
│   ├── index.html
│   └── package.json
├── ARCHITECTURE.md       (read-only reference)
└── SCHEMA.sql            (read-only reference)
```

## Quick Start

### 1. Clone & Install

```bash
cd graamswasthya/backend
npm install

cd ../frontend
npm install
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET

# Frontend
cp frontend/.env.example frontend/.env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

### 3. Local Development (TEST_MODE)

For local testing without Supabase Auth:

```bash
# In backend/.env
TEST_MODE=true
NODE_ENV=development
```

This disables JWT verification and injects a mock admin user with all villages allowed.

### 4. Run

```bash
# Terminal 1 — Backend
cd backend
npm run dev    # Port 3001

# Terminal 2 — Frontend
cd frontend
npm run dev    # Port 5173
```

## Key Features

| Module | Description |
|--------|-------------|
| **Dashboard** | KPI cards, pregnancy trends (area chart), outcome pie chart, risk distribution (stacked bar), top illnesses |
| **Households** | Register, search, filter by village, view members |
| **Members** | Demographics, pregnancy history, immunization schedule, illness logs |
| **Pregnancies** | Full ANC lifecycle, auto risk calculation (BP/Hb/BS thresholds), outcome recording with auto newborn + immunization schedule generation |
| **Immunizations** | National schedule from vaccines table, overdue/due/given status, administer with visit log |
| **Illness Logs** | Record with medications array, chronic flag, ICD-10 codes |
| **Alerts** | 8 alert types, severity-based ordering, acknowledge workflow, auto-resolve |
| **Diseases** | NLM MedlinePlus search with 30-day cache |
| **Admin** | User CRUD with Supabase Auth, village assignments, audit logs |

## Alert Types

| Type | Trigger | Severity |
|------|---------|----------|
| `ANC_MISSED` | No ANC visit > 35d (or 14d for high-risk) | High |
| `ANC_HIGH_BP` | BP > 140/90 mmHg | Critical |
| `ANC_LOW_HB` | Hemoglobin < 11 g/dL | High |
| `ANC_HIGH_BS` | Fasting > 95 or PPBS > 140 mg/dL | High |
| `PNC_MISSED_MOTHER` | Missed postnatal checkpoint (D2/7/14/42) | High |
| `PNC_MISSED_NEWBORN` | Missed newborn checkpoint (D1/3/7/28) | High |
| `VACCINE_OVERDUE` | Scheduled date + 7 days passed | Medium |
| `PREGNANCY_OVERDUE` | EDD passed, no outcome | Critical |

## Roles

| Role | Access |
|------|--------|
| `admin` | Full access, user management, analytics |
| `doctor` | Clinical records, all villages |
| `supervisor` | Read-only overview, assigned villages |
| `field_worker` | CRUD within assigned villages |

## API Routes

All routes prefixed with `/api`. Protected routes require `Authorization: Bearer <jwt>`.

```
POST   /auth/login
GET    /auth/me
GET    /villages, /villages/:id, /villages/states, /villages/districts
GET    /households, /households/:id
POST   /households
PATCH  /households/:id
GET    /households/:id/members
POST   /members
PATCH  /members/:id
GET    /members/:id
GET    /households/:id/relationships
POST   /relationships
GET    /members/:id/pregnancies
POST   /pregnancies
PATCH  /pregnancies/:id
GET    /pregnancies/:id
POST   /pregnancies/:id/anc-visits
PATCH  /pregnancies/:id/anc-visits/:visitId
POST   /pregnancies/:id/outcome
GET    /members/:id/immunizations
POST   /immunizations
PATCH  /immunizations/:id
GET    /members/:id/illness-logs
POST   /illness-logs
PATCH  /illness-logs/:id
GET    /alerts
PATCH  /alerts/:id/acknowledge
GET    /diseases/search?q=
GET    /admin/users
POST   /admin/users
PATCH  /admin/users/:id
GET    /admin/audit-logs
GET    /admin/analytics/summary
GET    /admin/analytics/villages/:id
```
