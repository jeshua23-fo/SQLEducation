# Deploy SQLEducation API on Render

The repository includes a `render.yaml` blueprint for the Express API. This file configures the service and requests secrets as manual environment variables; it does not contain real credentials.

## Deploy

1. Sign in to Render and choose **New → Blueprint**.
2. Connect the GitHub repository `jeshua23-fo/SQLEducation`.
3. Review the service named `sqleducation-api` and create it.
4. In the service environment settings, provide:
   - `SUPABASE_URL`: the Project URL from Supabase project settings.
   - `SUPABASE_ANON_KEY`: the project's publishable/anon key.
   - `SUPABASE_SERVICE_ROLE_KEY`: the server-only service-role/secret key.
   - `FRONTEND_ORIGIN`: the exact deployed frontend origin, for example `https://your-site.example`. For multiple origins, separate them with commas.
5. Wait for the deployment to finish and open `https://YOUR-SERVICE.onrender.com/api/health`. A working API returns JSON with `"status": "ok"`.

## Important security notes

- Never add the service-role key to frontend files, GitHub, screenshots, or chat.
- Do not set `FRONTEND_ORIGIN` to `*`; use only the real frontend origin(s).
- The API is not considered production-ready until a trusted administrator has been bootstrapped using [ADMIN_SETUP.md](./ADMIN_SETUP.md) and login/admin flows have been tested.
- The SQL editor endpoint / student SQL execution sandbox has not been implemented. Do not connect untrusted student SQL to the production Supabase database.
- After deployment, open `login.html` and add this before the `<script src="js/login.js"></script>` tag, replacing the example with the actual URL assigned by Render:

```html
<script>window.SQLEDUCATION_API_URL = "https://YOUR-SERVICE.onrender.com";</script>
```

Do not guess the service URL; copy the URL assigned by Render.
