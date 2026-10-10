# SQLEducation API

Initial Express API for SQLEducation. It currently provides a health check and Supabase-backed login/current-user endpoints.

## Requirements

- Node.js 20 or newer
- A Supabase project with the SQLEducation schema already applied

## Local setup

1. Open a terminal in the `backend` directory.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env`.
4. Fill in the Supabase project URL, anon/publishable key, and service-role key.
5. Set `FRONTEND_ORIGIN` to the exact origin serving the frontend.
6. Run `npm run dev`.
7. Visit `http://localhost:3000/api/health`.

## Environment security

- Keep `.env` out of Git.
- The service-role key is server-only and bypasses Row Level Security. Never use it in browser JavaScript, HTML, or a public repository.
- Use a separate development/test project before production.
- Login is limited to 10 attempts per IP per 15 minutes; production deployments should also use platform-level rate limits and monitoring.

## Current endpoints

- `GET /api/health`: process health.
- `POST /api/auth/login`: accepts JSON `{ "user": "email-or-username", "pass": "password" }`.
- `GET /api/auth/me`: requires `Authorization: Bearer <access-token>`.

Registration, profile creation on signup, refresh-token handling, and frontend integration are not implemented yet.
