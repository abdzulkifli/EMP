# Security Notes

- `config.js` may contain only the Supabase project URL and browser-safe publishable/anon key.
- Never publish a service-role key, secret key or database password.
- Supabase Row-Level Security is the enforcement boundary; hiding menus in the frontend is not security.
- Privileged account actions are routed through the included Edge Function.
- Test every role and department scope before production use.
- Use separate development, testing and production Supabase projects.
- Enable backups, monitoring and incident logging for production.
- Review account freeze, revocation, password-reset and offboarding procedures with the organisation's security team.
