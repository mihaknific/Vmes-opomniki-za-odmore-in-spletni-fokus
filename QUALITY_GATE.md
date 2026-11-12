# Vmes 0.9.3 — Quality Gate

Before publishing to Mozilla Add-ons, run:

```bash
npm test
npm run package
```

Then manually smoke-test in Firefox:

1. In Firefox, use `about:debugging` → **This Firefox** → **Load Temporary Add-on…** and select `extension/manifest.json`.
2. Complete onboarding.
   - Verify “Odpri izbrano” opens the selected section in the same tab.
3. Create interval, once, daily, weekly and site-specific reminders.
   - Confirm each default reminder first triggers after exactly its displayed interval and countdowns include seconds.
4. Test system, in-page and window notification channels.
   - Confirm native notifications use the reminder-specific icon, name, and message.
5. Test Snooze, completion, dismissal, timeout and Do Not Disturb behavior.
6. Restart Firefox and verify alarms are restored.
7. Revoke a site permission and verify tracking stops without errors.
8. Export/import data and verify reminders/settings survive the round trip.
9. With a site reminder or daily time limit enabled, verify site tracking cannot be disabled until that feature is disabled.
10. On Firefox for Android, verify onboarding navigation, popup actions, reminder countdowns, and native notification icons.

`npm test` covers JavaScript syntax, shared-core and asset behavior, breathing preference import/export, background integration, and the built-site routes. `npm run package` validates the extension and produces the versioned XPI and ZIP.
