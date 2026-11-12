# Supabase setup

The cloud side of the system: the shared database, the two Edge Functions and the daily reminder schedule
(SDD Sections 2, 3.1.1, 4.11 and 4.13). The desktop app works without it; the Logbook view, member invites,
announcements and the member app need it.

## 1. Create the project

1. Create a project at supabase.com. Note the **Project URL** and the **anon key** (Settings > API).
2. **Authentication > Providers > Email:** keep Email on, turn **Allow new users to sign up OFF**.
   Members get accounts only through an invite, and staff accounts are added by the owner.
3. **Authentication > URL Configuration:** add the member app's address to the redirect URLs.

## 2. Create the tables and the security rules

Open the SQL editor and run `migrations/0001_schema.sql` (or `supabase db push`). It creates the tables, the official
rates, and every Row-Level Security policy of Table 11.0.

## 3. Create the owner account

1. **Authentication > Users > Add user:** create the owner (email and password, confirm the email).
2. A trigger creates the profile as **staff**. Promote it in the SQL editor:

   ```sql
   update public.profiles set role = 'owner' where email = 'owner@yourgym.com';
   ```

3. Staff accounts are created the same way and stay `staff`. The role is never read from the user-editable
   `user_metadata`, so nobody can make themselves an owner.

## 4. Deploy the Edge Functions

```bash
supabase link --project-ref <PROJECT_REF>
supabase functions deploy member-access
supabase functions deploy send-reminders --no-verify-jwt
supabase secrets set MEMBER_APP_URL=https://<where-the-member-web-app-is-hosted>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the functions by Supabase.
The service role key never leaves the cloud.

## 5. Schedule the reminders

Enable **pg_cron** and **pg_net** (Database > Extensions), store the project URL and the service role key in Vault as
described at the top of `migrations/0002_daily_reminders.sql`, then run that file. It starts `send-reminders` every day
at 8:00 AM Philippine time.

## 6. Connect the desktop app

Add a `cloud` section to the app's settings file, `neofit-config.json`, in the app's data folder
(`%APPDATA%\@neofit\desktop-electron\` in development). The desktop signs in as the **owner**:

```json
{
  "cloud": {
    "url": "https://<PROJECT_REF>.supabase.co",
    "anonKey": "<anon key>",
    "ownerEmail": "owner@yourgym.com",
    "ownerPassword": "<the owner's password>"
  }
}
```

Keep this file private. It is outside the source code and is never committed. Restart the app; the Logbook view and
the invite button then work.

When running the local API directly, the same four values are the environment variables `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_OWNER_EMAIL` and `SUPABASE_OWNER_PASSWORD`.

## Trying the cloud screens without Supabase

```bash
npm run dev:fake-cloud -w @neofit/desktop-server
npm run dev -w @neofit/desktop-renderer
```

This runs the local API against an in-memory stand-in with sample logbook pages. Nothing is saved.
