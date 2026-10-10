# First administrator setup

Do this once, from the trusted Supabase dashboard. Never expose a service-role key in the browser or share credentials in chat.

1. Open **Authentication → Users** in the Supabase dashboard.
2. Create your own Auth user with an email and a strong password. Keep these credentials private.
3. Copy the UUID of that Auth user.
4. Open **SQL Editor** and run the statement below after replacing all three placeholders with your own values. Use a lowercase username containing only letters, numbers, or underscores.

```sql
insert into public.users (id, username, display_name, role)
values (
  'REPLACE_WITH_AUTH_USER_UUID'::uuid,
  'your_admin_username',
  'Your display name',
  'admin'
);
```

5. Start the backend and sign in using the email/password you set in Auth, or the username/password you added above.
6. Use the returned access token for protected `/api/admin/*` requests. The frontend must keep this token private to the current signed-in session.

Only run this SQL for your own trusted administrator account. Do not expose this as a public API or allow students to choose their role. Do not put a real password, UUID, or Supabase secret in the repository.
