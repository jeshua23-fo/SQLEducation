# SQLEducation backend

Express API backed by Supabase Auth and PostgreSQL.

## Requirements

- Node.js 20 or newer
- A Supabase project
- The project's Supabase URL, anon/publishable key, and service-role/secret key

## Local setup

1. Copy `.env.example` to `.env`.
2. Fill in the environment variables from your Supabase project settings.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` exclusively in this server-side `.env`. Never put it in browser JavaScript, commit it, or share it in chat.
4. Run `npm install`.
5. Run `npm run dev`.
6. Check `GET http://localhost:3000/api/health`.

## Authentication

- `POST /api/auth/login`: body `{ "user": "username-or-email", "pass": "password" }`.
- `GET /api/auth/me`: requires `Authorization: Bearer <access-token>`.

There is deliberately no public student sign-up endpoint.

## Administrator endpoints

All `/api/admin/*` endpoints require a valid Supabase access token whose `public.users.role` is `admin`.

- `GET /api/admin/students`: list students.
- `POST /api/admin/students`: create a student using `{ "username": "...", "display_name": "...", "password": "..." }`.
- `POST /api/admin/students/:id/reset-password`: set a new password using `{ "password": "..." }`.
- `POST /api/admin/students/:id/access`: enable or suspend login using `{ "enabled": true }` or `false`.

Student accounts without a real email use an internal `.invalid` email identifier because Supabase password authentication uses an email/phone identifier. The app never sends email to that reserved address; students sign in with their username through the API.

## First administrator setup

Create the first administrator in a controlled setup step: create an Auth user in the Supabase dashboard, insert a matching `public.users` profile with a unique lowercase username and `role = 'admin'`, then sign in and use the resulting access token for administrator endpoints. Never make a public endpoint that lets someone assign themselves the admin role.

## Current limitations

The backend and endpoints are not deployed yet. The existing browser login page has not been connected to these endpoints. Student creation, lesson assignment, exercise evaluation, token refresh, and the admin interface still require local integration and end-to-end tests.
