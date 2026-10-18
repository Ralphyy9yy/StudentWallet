# StudentWallet

An Android budgeting app for students, built with Expo SDK 58, React Native, strict TypeScript, Expo Router, and SQLite. The installed app uses local assets and storage, with no login, backend, analytics, or required remote services. Hardware verification of the standalone offline guarantee remains a release gate.

## Setup

Use Node 22.14 or newer, npm, and Android Studio/SDK for local Android builds. The exact resolved dependency versions are in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md); `package-lock.json` fixes the dependency tree.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx expo start --android
```

Expo Go is useful during development. It does not verify standalone startup without Metro. Android is the only supported target for this MVP.

## Android APK

The supplied [eas.json](eas.json) includes an internal `preview` profile that produces an APK:

```sh
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

Use your Expo account and project. EAS may prompt for project registration and an Android keystore; the repository owner must retain ownership of the account and signing credentials. No account, project, credentials, or cloud build was created during implementation.

For a local release test build after installing the required Android SDK and compatible JDK:

```sh
npx expo prebuild --platform android
npx expo run:android --variant release
```

Generated native files are ignored and reproducible from app.json and `plugins/`. Prebuild can regenerate them, so keep native configuration changes in config plugins. Local test signing is not a production signing policy. Building/downloading dependencies needs internet; the installed app's core workflows do not.

The Android source project and Hermes bundle export were generated successfully. **No APK has been compiled here:** this machine does not have an Android SDK or adb.

## Features

- Local-storage onboarding, optional display name, allowance setup, inclusive dates, non-overlapping periods, and period editing/history.
- Add/edit/delete expenses and top-ups, built-in categories, notes, and backdated entries in archived periods.
- Named reserves with allocation editing, spending, partial release, and release/archive. Historical expenses keep their reserve relationships.
- Home balance, outstanding reserves, flexible funds, today's flexible spending, recent activity, and an adjusting daily guide. Upcoming, ended, and deficit states are explicit.
- History across all periods with type/category/period filters and 50-record keyset pagination.
- Complete versioned JSON backup, folder-based save, separate sharing, validation/preview, and confirmed atomic replacement restore. An adapter accepts the initial development build's snake_case backups.
- Last completed destination-write time, local-data disclosures, and two-step confirmed reset.

Charts, reminders, dark mode, purchase simulation, custom-category management, and cloud synchronization are outside this MVP.

## Architecture and integrity

Home highlights the adjusting daily guide, with a fixed Add expense action. Expense entry uses icon category chips and a fixed Save action. History filters open in a dismissible sheet and apply together; reserve editing and release actions live in each reserve's options menu. The wallet mark is authored in `assets/branding/wallet.svg`; run `npm run generate:branding` to regenerate the bundled icon and splash PNGs. A new APK build is needed to install these native branding changes.

`src/app/` contains thin Expo Router routes. `src/features/` owns onboarding, allowance, transaction, reserve, dashboard, settings, and backup screens/workflows. `src/domain/` contains pure money, date, budget, command, and backup validation. `src/db/` owns parameterized SQL, migrations, and the serialized operation queue. `src/ui/` supplies system-font tokens, shared controls, native date fields, safe-area/keyboard handling, and confirmation helpers.

SQLite is the source of truth. Money is stored as integer centavos; parsing and formatting retain exact cents even at the supported upper bound. Intermediate financial arithmetic uses integers/BigInt and rejects unsafe aggregates. Dates are local `YYYY-MM-DD`; creation/update timestamps are UTC. Inclusive day counts use calendar ordinals, avoiding daylight-saving duration errors.

Total funds = initial allowance + top-ups. Balance = funds − expenses. Flexible funds = balance − outstanding reserves. The daily guide divides current nonnegative flexible funds by the remaining inclusive days and floors to centavos. A reserve expense lowers balance and remaining reserves once, leaving flexible funds unchanged. Editing/deleting reevaluates the resulting records; reserves are never silently clamped.

Reads, writes, exports, restores, and migration access share one connection queue. Mutations use explicit `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`. Stable persisted command IDs prevent retry duplication. Newly negative or worsened balances require confirmation; a changed financial snapshot requires fresh confirmation. Save feedback/navigation happens only after commit.

Database v1 establishes tables and indexes. V2 adds command idempotency, category indexes, and integer/type guards without replacing financial tables. Migrations run transactionally and update `PRAGMA user_version` only with a successful commit. Unsupported/newer databases block normal use, and errors never trigger an automatic reset. Backup schema version is separate from database version.

## Backup and privacy

Backups are unencrypted JSON and contain personal spending details. Save to a trusted local folder for offline recovery. Folder export marks the last saved time only after the Android document-provider write completes. Sharing does not prove a recipient saved the file and never changes the verified export time. A cloud-only provider may need internet.

Import is capped at 10,000,000 UTF-8 bytes and 50,000 entity records. Strict validation checks versions, UUIDs, duplicate IDs, references, real dates, period overlap, aggregate bounds, and reserve consistency before any mutation. Budget deficits are valid; reserve overdraws are rejected. Confirmed restore replaces parents and children in one transaction; failure rolls back fully. Temporary share/import files are cleaned after use.

Uninstalling, clearing storage, or losing the device can lose the local wallet. SQLite is not claimed to be encrypted. Android automatic cloud backup and device transfer are excluded by the supplied native config plugin. No broad storage, camera, location, contacts, or overlay permission is needed by app workflows.

## Verification

Tests include pure domain/backup validation, repository SQL on real desktop SQLite, mocked file-provider orchestration, and React Native forms. CI runs typechecking, lint, tests, and Android bundle export. The SQL adapter is not the Android native bridge; mock picker tests are not hardware tests.

See [docs/RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md) for the remaining native SQLite tests, airplane-mode first install, force-close/reboot persistence, file-provider cancellation/permissions, TalkBack, 200% text, compact layouts, storage failures, and performance measurements. The Maestro smoke flow is [tests/device/smoke.yaml](tests/device/smoke.yaml) and intentionally clears only an isolated test install.

A fictional demo backup is available at [tests/fixtures/demo-backup.json](tests/fixtures/demo-backup.json). Import it only into a test wallet: restore replaces current data. For its 16–25 October 2026 period, the sample has PHP 1,500 initial funds, PHP 100 expenses (half reserved), PHP 250 outstanding reserves, and PHP 1,150 flexible funds. On 16 October the daily guide is PHP 115. It is never inserted automatically into a fresh app.
