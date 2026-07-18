# Validation Results

Validation was run against the files in this package.

## Static checks

- `data.js`, `api.js` and `app.js` passed `node --check`.
- `index.html` uses only relative file paths.
- There is no `type="module"`, Vite entry point, npm dependency or absolute `/assets/` path.
- The root page and all JavaScript/CSS resources were loaded from a `file://` URL in a DOM test environment.

## Functional demo tests

Passed:

- Login screen renders.
- Administrator login succeeds.
- Dashboard renders with portfolio data.
- Initiative register navigation works.
- Create Initiative modal opens.
- New initiative saves and appears in the register.
- Projects page and horizontal timeline render.
- Administration page renders.
- New demo user saves and appears in the directory.
- End user sees only the authorised department and has no Administration menu.
- A first-login account is forced into the password-change dialog.
- No JavaScript errors were reported during these automated tests.

## Not validated here

A live Supabase project was not available in this environment. The SQL migration, live Auth, Row-Level Security, storage and Edge Function must be verified in the target Supabase development project before production use.
