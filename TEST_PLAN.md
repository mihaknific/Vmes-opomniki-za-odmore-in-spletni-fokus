# Vmes — Manual QA / Release Test Plan

## Install

1. Load `extension/manifest.json` through `about:debugging`.
2. Complete onboarding.
3. Confirm toolbar popup opens.
4. On the final onboarding screen, select both starting paths in turn and confirm they open the matching settings sections.

## Reminder matrix

- interval: 1 minute
- once: 2 minutes in the future
- daily schedule: next local minute
- weekly schedule: next selected weekday
- site: 1 minute on a permitted domain

## Notification matrix

Test `system`, `inpage`, `window`, `both`, and `all`.

For `inpage`, `window`, and `all`, also test a custom reminder with a PNG or JPG image. Confirm the image is shown, remains local, can be removed, and is restored when the reminder is edited.

Test the sound option with sound disabled, then enabled with `Zvonec`, `Nežen ton`, and `Dvojni ton`. Confirm the volume slider changes the sound and that native system notification sound remains controlled by Firefox/the operating system.

## Actions

For each channel test `Zaključeno`, `Snooze`, `Zapri`, timeout/close, and reopening. Confirm history does not create duplicate dismissal events.

## Site tracking

Confirm only the active tab in the focused Firefox window accumulates time. Switch tab, switch window, minimize/defocus Firefox, close tab, revoke permission and confirm the session stops.

Add a focus time-limit rule for a permitted domain. Confirm Firefox asks for access to only that selected domain, the rule starts tracking without needing a site reminder, current-session time counts toward the daily quota, and the blocked page appears at the limit. Also test a strict block rule and a subdomain.

With an active site reminder and with an active daily time-limit rule, try to disable site tracking. Confirm the settings page explains why it cannot be disabled and that the reminder/limit continues to be enforced.

## Recovery

Restart Firefox and verify enabled interval/schedule alarms return. Verify disabled reminders stay disabled.

## Data

Export JSON, delete/reset local state, import JSON, and confirm reminders/settings return. Test a backup containing website rules with permission granted and denied; denied permission must leave current data unchanged, and approving permission must complete the import. Confirm unsupported schema versions, duplicate reminder IDs, and malformed JSON are rejected without replacing current data.

## Accessibility

Keyboard-only navigation, visible focus, Escape closes in-page notification, labels announced by screen reader, reduced motion respected. Test onboarding and settings at narrow viewport widths and with the largest text-size option.

Open the 10 eye exercises and verify each image and diagram matches its title and instruction, including the paired left/right images in exercise 1 and the right-gazing character beside the diagrams in exercises 5–8. Open the body exercise guide and verify all 11 images in order; also open the `neck`, `upper`, and `legs` groups and confirm each image, title, and group count match.

Open the breathing guide and try each technique, changing duration, pausing, resuming, and restarting. Confirm the circle follows the phase labels, sound stays off unless enabled, and reduced-motion settings suppress the animation.

## Platforms

Smoke-test Windows 11, macOS, and Linux. Native notification appearance intentionally follows each OS; in-page/window channels provide the Vmes UI.


## Automated 0.9.3 gate
- `npm test` runs static validation, shared-core and asset tests, breathing-preference tests, background integration tests, and site-build integration tests.
- Validation checks strict UUID storage IDs, extension CSP, forbidden dynamic/network primitives, manifest MV3 structure, local asset references and required release files.
