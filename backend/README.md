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
4. Run `npm install` inside `backend/`.
5. Run `npm run dev` inside `backend/`.
6. Check `GET http://localhost:3000/api/health`.
7. Serve the frontend from a local web server such as VS Code Live Server. The login page defaults to `http://localhost:3000` for its API. To override that, define `window.SQLEDUCATION_API_URL` before `js/login.js` loads.

## Authentication

- `POST /api/auth/login`: body `{ "user": "username-or-email", "pass": "password" }`.
- `GET /api/auth/me`: requires `Authorization: Bearer <access-token>`.
- The login page now calls the real API and saves the returned access token in its browser session record. Token refresh is not implemented yet.

There is deliberately no public student sign-up endpoint.

## Administrator endpoints

All `/api/admin/*` endpoints require a valid Supabase access token whose `public.users.role` is `admin`.

- `GET /api/admin/students`: list students.
- `POST /api/admin/students`: create a student using `{ "username": "...", "display_name": "...", "password": "..." }`.
- `POST /api/admin/students/:id/reset-password`: set a new password using `{ "password": "..." }`.
- `POST /api/admin/students/:id/access`: enable or suspend login using `{ "enabled": true }` or `false`.

Student accounts without a real email use an internal `.invalid` email identifier because Supabase password authentication uses an email/phone identifier. The app never sends email to that reserved address; students sign in with their username through the API.

## First administrator setup

Follow [ADMIN_SETUP.md](./ADMIN_SETUP.md) to create the first trusted administrator manually in the Supabase dashboard. Never make a public endpoint that lets someone assign themselves the admin role.

## Current limitations

The API and login integration are committed to this feature branch but are not deployed and have not been tested end-to-end against your local environment. The student-management endpoints exist, but the admin interface, lesson assignment UI, student learning APIs, SQL execution sandbox, and token refresh still need implementation and testing.
