# MineGuard — SECL Safety Management

The frontend is a static HTML application paired with the Express/Supabase backend. Existing pages remain available; `safety.html` adds the role-aware SECL safety dashboard.

## Pages
- `index.html`: existing login/registration.
- `app.html`: existing incident/SOP portal.
- `safety.html`: scoped safety dashboard, incident log, HQ Area ranking, comments, and field observation form.

## Development and configuration
Serve the directory with a static server, e.g. `python -m http.server 5500`, and open `index.html`. The safety dashboard uses `window.MINEGUARD_API_BASE` if configured before the page; otherwise it uses the configured Render API origin. It checks `/api/version` before loading safety data and displays a clear rollout warning if the deployed API is still on an older version. Deploy as static assets to the existing Vercel/static hosting setup.

Set backend `FRONTEND_URL` to the exact deployed HTTPS origin (include the Vercel preview origin only in a test environment if you need to test the preview). Never place Supabase service-role keys or JWT secrets in browser code. The frontend preview does not itself deploy the backend or apply the database migration. 

## Roles and security
Dashboard visibility is not a security boundary. The backend verifies active users and organizational scope. New roles must be provisioned through an authorized process; public registration must never grant them. 401 means sign in again; 403/404 may indicate scope restrictions. Do not bypass them.

## Rollout status
The safety dashboard requires the backend migration and manifest seed. It uses API responses rather than hardcoded production statistics. Validate the migration against a disposable Supabase project, run seed reconciliation, provision role-specific test users, configure CORS, and pass negative cross-scope authorization tests before production deployment. A Vercel preview is for UI review and is not a production release.
