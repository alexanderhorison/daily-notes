# Today Reminders

A reminders web app focused on **Today**, built with **React + Vite + Tailwind + shadcn-style UI**.

This version is configured for:
- **Clerk** authentication
- **Supabase** backend with SQL migration files
- **Docker** + **Docker Compose**
- **GitHub Actions CI**

## Tech Stack

- Frontend: React, Vite, Tailwind CSS
- UI: shadcn-style components + Radix primitives
- Auth: Clerk (`@clerk/clerk-react`)
- Backend data: Supabase (`@supabase/supabase-js`)

## Features

- Today-first task dashboard
- Date presets: Today, Tomorrow, Next Month, custom date
- Priority and reminder time
- Edit tasks
- Mobile swipe-to-delete + delete confirmation
- Responsive quick-add modal on mobile

## 1) Environment Setup

Copy env template:

```bash
cp .env.example .env
```

Set values in `.env`:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_JWT_TEMPLATE` (recommended: `supabase`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (recommended)
- `VITE_SUPABASE_ANON_KEY` (legacy fallback)

## 2) Clerk + Supabase Auth Setup

### Clerk

1. Create your Clerk application.
2. Enable Supabase integration in Clerk and Supabase third-party auth.
3. Create a JWT template in Clerk (name `supabase`) with claims:
   - `aud: "authenticated"`
   - `role: "authenticated"`
   - `sub` (default Clerk subject)

### Supabase

1. Create a Supabase project.
2. In Supabase Auth settings, enable Clerk as third-party auth (set your Clerk domain).
3. Use project URL + publishable key in `.env`.

## 3) Database Migrations

Migration file:

- `supabase/migrations/20260212000100_create_tasks.sql`

Apply migration with Supabase CLI (recommended):

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

The migration creates:
- `public.tasks`
- RLS policies scoped by Clerk user id (`auth.jwt()->>'sub'`)
- indexes and update trigger

## 4) Run Locally

```bash
npm install
npm run dev
```

Open:

- [http://127.0.0.1:5173](http://127.0.0.1:5173)

## 5) Docker

Build and run:

```bash
docker compose up --build
```

Open:

- [http://127.0.0.1:5173](http://127.0.0.1:5173)

Files:
- `Dockerfile`
- `docker-compose.yml`
- `docker/nginx.conf`

## 6) Connect to GitHub

### Option A: Use helper script

```bash
./scripts/connect-github.sh <github-repo-url> [branch]
```

Example:

```bash
./scripts/connect-github.sh git@github.com:your-org/today-reminders.git main
```

### Option B: Manual commands

```bash
git remote add origin <github-repo-url>
git branch -M main
git push -u origin main
```

## 7) GitHub CI

Workflow:

- `.github/workflows/ci.yml`

Set these repository secrets so CI can build:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_ANON_KEY`

Then CI runs `npm ci` and `npm run build` on pushes and pull requests.
