# Connect HOME31 to Supabase

## 1. Create the database

Open the Supabase SQL Editor and run:

```text
supabase/migrations/001_home31_core.sql
```

The migration creates departments, profiles, roles, reporting years, portfolios, initiatives, annual cycles, budgets, projects, milestones, risks, attachments, audit logs, functions, views and Row-Level Security policies.

## 2. Create the first administrator

Create a user under Supabase Authentication, then run:

```sql
select public.bootstrap_super_admin('your-email@example.com');
```

The first administrator is required to change the temporary password.

## 3. Runtime configuration

Open `config.js`, switch `mode` to `supabase`, and enter the project URL and browser-safe publishable/anon key.

Do not place a database password, service-role key or secret key in the frontend.

## 4. Admin Edge Function

Install the Supabase CLI, link the project, then deploy:

```bash
supabase functions deploy admin-users
```

The function uses the server-side service-role environment provided by Supabase for user creation and account administration.

## 5. Auth redirect URL

In Supabase Authentication URL settings, add the final GitHub Pages address as the Site URL and allowed redirect URL.

## 6. Verification

Test with at least:

- Super Administrator
- Department Administrator
- End User
- Frozen account
- Revoked account

Verify that an end user cannot view or edit another department's records.
