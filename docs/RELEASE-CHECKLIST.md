# Android release verification

These are release gates, not claims of device testing. Use an isolated test installation and retain an exported backup before any destructive check.

## Verified on this development machine

- TypeScript and lint checks.
- Exact centavo parsing/formatting through the safe-integer boundary; inclusive calendar days, leap day, active/upcoming/ended guides, and reserve arithmetic.
- Repository SQL against Node's real SQLite engine: duplicate commands, pagination beyond 200 records, overlap rejection, reserve reverse operations, failed-write rollback, atomic replacement, repeated restore, stale deficit confirmation, v1 upgrade, and failed-migration rollback.
- React Native form tests: repeated Save taps, commit-before-navigation, retained inputs after errors, stable retry IDs.
- Backup file orchestration with platform APIs mocked: cancellation, malformed/oversized input, failed destination write, saved-status ordering, share-sheet semantics, temporary-file cleanup.
- Android JavaScript/Hermes export and native prebuild. Generated source manifest disables backups and updates, removes broad storage/overlay/vibration permissions, and references cloud/device-transfer exclusion XML.

The SQLite suite substitutes only the Expo bridge with a Node SQLite adapter. It does **not** establish behavior of the Android expo-sqlite bridge. File mocks do **not** establish provider permission or cancellation behavior on hardware. The merged APK manifest still needs review after compilation.

## Required on Android before release

1. Build and install the standalone APK on Android 10 and a newer device. Turn airplane mode on **before its first launch**. Complete setup, a flexible expense, a reserve expense, a top-up, editing/deleting, period changes, history filters, save/export, and restore with a local file provider. No Metro connection should be available.
2. Force-stop and reopen, then reboot. Confirm record IDs and totals are unchanged. Restore a backup twice and verify no duplication. Test process interruption during writes and restore.
3. Test insufficient storage and denied/canceled file access. Failed writes must retain prior data and form values. Cancel the restore preview and both reset confirmations. Compare exports before and after canceled/failed operations.
4. Exercise local midnight, timezone changes, manual clock changes, one-day periods, upcoming periods, and ended periods. Persisted dates must not shift. Verify recalculation on resume and while foregrounded.
5. Run TalkBack and 200% text scaling on a compact display. Check all labels, focus order, native date picker, keyboard resize, tab safe areas, and deficit text. Capture actual screenshots and record findings.
6. Inspect the final APK permissions and merged manifest: no camera, contacts, location, broad storage, or overlay permissions; automatic backup and device-transfer exclusions present; remote update checks disabled. The build retains INTERNET for Expo tooling/native dependencies, but app workflows make no financial network requests.
7. Run the repository integration scenarios against **real expo-sqlite in an Android development build**, including foreign-key enforcement, queue serialization, migration fixtures, storage-full rollback, and failed restore rollback.
8. Run `maestro test tests/device/smoke.yaml` on an isolated emulator/test device. This flow clears that test installation's data.
9. Measure cold usable Home and expense-save feedback with 5,000 transactions on a reference Android 10 device. Targets are 3 seconds and 300 ms; no performance results have been measured yet.
10. Record APK version, signing owner, device/OS details, measurements, backup round-trip results, and all issues. Do not declare the PRD acceptance criteria complete before these checks pass.

## Build environment remaining

This workspace generated the Android project and exported its bundled JavaScript. The execution machine has no Android SDK or adb, so no APK was compiled or installed here. EAS preview configuration is supplied; an EAS account/project and signing ownership must be configured by the repository owner for a cloud APK build. Local Android builds require the SDK/build tools selected by Expo SDK 58 (the generated project currently targets compile SDK 37).
