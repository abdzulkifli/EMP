# HOME31 Test Checklist

## Demo mode

- Open `index.html` directly.
- Log in with the administrator account.
- Change filters and navigate every page.
- Create, edit and archive an initiative.
- Import `templates/initiative-import.csv`.
- Create and edit a project.
- Switch project list/timeline views.
- Export initiative, project and comparison CSV reports.
- Create a user, freeze it, revoke it and reactivate it.
- Add a department and a reporting year.
- Log in with the end-user account and confirm department scoping.
- Refresh the browser and confirm demo changes persist.

## Supabase mode

- Verify login and logout.
- Verify mandatory first-login password change.
- Verify RLS for each role.
- Verify initiative and project save functions.
- Verify archived records are not returned in active views.
- Verify admin-user Edge Function operations.
- Verify audit entries.
- Verify storage policies before enabling document upload.
