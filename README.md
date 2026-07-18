# HOME31 Enterprise Dashboard

A complete, no-build GitHub Pages frontend with a Supabase PostgreSQL/Auth foundation.

## What works immediately

Open `index.html` directly or publish the repository root through GitHub Pages. Demo mode includes:

- Login and account-status checks
- Role-aware top navigation
- Department-scoped end-user data
- Executive dashboard and portfolio KPIs
- Dynamic reporting years
- Initiative create, edit, view, archive, CSV import and export
- Project create, edit, list and horizontal timeline
- AMP year-on-year comparison
- Reports and CSV exports
- User create, freeze, revoke and reactivate
- Department and reporting-year administration
- First-login password change workflow
- Audit activity and browser persistence
- Responsive desktop/tablet/mobile layout

## Demo login

Administrator:

```text
admin@home31.demo
Home31!Demo
```

Department end user:

```text
user@home31.demo
Home31!User
```

## Deploy directly to GitHub Pages

1. Upload every file and folder in this package to the root of the repository.
2. Open repository **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select branch `main` and folder `/(root)`.
5. Save and wait for GitHub Pages to publish.

There is no npm installation, Vite build or GitHub Actions workflow in this version.

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/001_home31_core.sql` in the SQL Editor.
3. Create the first Auth user.
4. Run `select public.bootstrap_super_admin('your-email@example.com');`.
5. Deploy `supabase/functions/admin-users` for privileged account administration.
6. Edit `config.js`:

```js
window.HOME31_CONFIG = {
  mode: "supabase",
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  publishableKey: "YOUR_PUBLISHABLE_OR_ANON_KEY",
  currency: "MYR",
  locale: "en-MY",
  organisationName: "HOME31"
};
```

Never place a Supabase service-role or secret key in `config.js`.

## Repository structure

```text
index.html
config.js
assets/
  css/styles.css
  js/data.js
  js/api.js
  js/app.js
supabase/
  migrations/001_home31_core.sql
  seed.sql
  functions/admin-users/index.ts
docs/
templates/initiative-import.csv
.nojekyll
404.html
favicon.svg
```

## Important production note

Demo mode is fully functional in the browser, but it is not a multi-user database. For organisational use, enable Supabase, test Row-Level Security with each role, configure backups and complete user-acceptance/security testing.
