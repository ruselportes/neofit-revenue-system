# Development guide

How to run, test and package the NeoFit Revenue System code. The design lives in `docs/` (SPMP, SRS, SDD); this
file only covers the code.

## Layout

```
packages/core            Shared TypeScript with no framework code: domain classes, OCR pipeline and review rules,
                         revenue engine, offline queue and sync outbox, receipt and CSV builders. Used by both apps.
apps/desktop/server      The local API (Express, SQLite, JWT, bcrypt) on 127.0.0.1, plus the Word report
apps/desktop/renderer    The desktop interface (React, Vite)
apps/desktop/electron    The desktop shell and the packaging scripts
apps/mobile              The phone app for staff, the owner and members (Expo, React Native; also runs in a browser)
supabase/                The cloud: SQL, Row-Level Security, two Edge Functions, the reminder schedule
```

Rule of thumb: business rules live in `packages/core` or in a server service, never in a screen.

## First time

```bash
npm install
```

Needs Node 22. Docker is only needed for the SQL security tests.

## Run

| What | Command |
|---|---|
| Desktop app (Electron + interface + local API) | `npm run desktop` |
| Desktop API only, with a fake cloud and sample logbook pages | `npm run dev:fake-cloud -w @neofit/desktop-server` |
| Desktop interface in a browser | `npm run dev -w @neofit/desktop-renderer` (open http://localhost:5173) |
| Phone app | `cd apps/mobile`, copy `.env.example` to `.env`, then `npm start` |
| Phone app in a browser, with a fake Supabase | `node apps/mobile/dev/fake-supabase.mjs`, then in `apps/mobile`: `EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=dev npx expo start --web` |

The first time the desktop app opens it asks for the administrator's email and password. The fake Supabase accepts
`owner@neofit.test`, `staff@neofit.test` and `member@neofit.test` with the password `test-pass-1234`.

## Connect the real cloud

Follow `supabase/README.md` (project, SQL, owner account, functions, reminder schedule). Then:

- **Desktop:** add a `cloud` section to `neofit-config.json` in the app's data folder.
- **Phone:** fill in `apps/mobile/.env`.

Without these the desktop works offline, and the Logbook, invites and announcements explain what is missing.

## Test

```bash
npm test                              # every workspace
npm run typecheck                     # every workspace
npm run test:rls -w @neofit/supabase  # the SQL security rules, on a throwaway Postgres in Docker
```

| Suite | Tests | What it covers |
|---|---|---|
| `packages/core` | 67 | domain rules, OCR pipeline and fallback, review flags, revenue de-duplication, offline queue, outbox, owner stats, receipts, CSV |
| `apps/desktop/server` | 84 | every API route, sign-in and protection, members and payments, rates, logbook, invites and publishing, the Word report, and one end-to-end story across phone, cloud and desktop |
| `apps/desktop/renderer` | 19 | API client, formatting, chart axis |
| `apps/mobile` | 16 | configuration, dates, sign-in link parsing, secure session storage |
| `supabase` (functions) | 15 | reminder messages and dates, member-access rules |
| `supabase` (`test:rls`) | 86 | every Row-Level Security policy and guard trigger, run on real Postgres |

## Package the desktop app

```bash
npm run build:desktop           # bundles the API (esbuild) and builds the interface (Vite)
npm run pack:desktop            # then an unpacked app: apps/desktop/electron/dist/win-unpacked
npm run dist:desktop            # then the Windows installer
```

Packaging runs in `apps/desktop/electron/.stage`, a folder of its own. Do not run electron-builder inside the
workspace: it prunes the shared `node_modules`.

Auto-update through GitHub Releases (SDD Section 2) is not set up yet because the repository does not exist.
When it does, add `publish` to the `build` section of `apps/desktop/electron/package.json` and `electron-updater` to the app.

## Requirements traceability

| Requirement | Where it is built | Checked by |
|---|---|---|
| FR-01 Sign-in and roles | `AuthService` (desktop server, phone), `RootNavigator` | server API tests, RLS tests; phone screens in a browser |
| FR-02 Page capture | `CameraScreen`, `ScanLimiter` | limiter tests; **needs a real phone** |
| FR-03 Hybrid OCR | `OcrPipeline`, `GeminiOcrEngine`, `MlKitOcrEngine`, `OcrParser` | core tests; **Gemini and ML Kit need a real phone and key** |
| FR-04 Review and flags | `ReviewSession`, `RateValidator`, `ReviewScreen` | core tests, journey test |
| FR-05 Offline queue | `OfflineQueue`, `LogbookSaver` | core tests, journey test |
| FR-06 Owner monitoring | `OwnerStats`, owner screens, CSV export | core tests; screens in a browser |
| FR-07 Staff accounts | `StaffManagementScreen`, `profiles` policies | RLS tests |
| FR-08 Members and invites | `MemberService`, `MemberAccessService`, `member-access` function | server tests, journey test; **function not run on a real project** |
| FR-09 Rates and announcements | `RateService`, `AnnouncementService` | server tests |
| FR-10 Logbook management | `LogbookService`, Logbook view | server tests |
| FR-11 Revenue and reports | `RevenueEngine`, `NameMatcher`, `WordRevenueReport` | core and server tests, journey test |
| FR-12 Member sign-in and status | `MemberHomeScreen`, `MembershipSummary` | core tests; screens in a browser; **email link needs a real project** |
| FR-13 Payments and receipts | `MemberPaymentsScreen`, `ReceiptScreen`, `receiptHtml` | core tests; PDF and share **need a real phone** |
| FR-14 Renewal reminders | `send-reminders` function, `NotificationService` | function logic tests; **needs a real project and an EAS project id** |

## Still to do before the defense

- Run the phone app on a real Android phone: camera, ML Kit, Gemini, gallery import, PDF and share, push reminders.
- Run `supabase/` on a real project and try the two Edge Functions and the email sign-in link.
- Run `eas init` for the phone app (this gives the project id that push notifications need).
- Add the NeoFit icon and splash screen (the phone app and the desktop installer use default icons).
- Move the Gemini call behind an Edge Function: a key inside the app can be extracted.
- Electron 33 runs Node 20, which `@supabase/supabase-js` is about to stop supporting; move to a newer Electron
  (Node 22) when convenient.
- Create the GitHub repository (`neofit-revenue-system`), then set up the auto-update.
