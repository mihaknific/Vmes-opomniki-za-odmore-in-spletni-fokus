# Vmes — AMO publication checklist

## Add-on metadata

- Name: Vmes: opomniki za odmore in spletni fokus
- English name: Vmes: Break Reminders & Website Focus
- Version: 0.9.2
- Summary: Opomniki za oči, vodo in odmore ter spletne omejitve za Firefox. Lokalno, brez računa ali analitike.
- Categories: Productivity, Other
- Language: Slovenian (source UI)
- Project code: MIT. Bundled third-party assets retain their own licenses; see `extension/THIRD_PARTY_NOTICES.txt`, `extension/fonts/OFL.txt`, and `extension/sounds/LICENSE.txt`.
- Data collection: none

## Permission rationale

The extension uses `alarms` for scheduled reminders, `notifications` for native notifications, `storage` for local settings/reminder history and website focus rules, the browser tabs and windows APIs to identify the active browser tab for optional site-time tracking and limits, and `scripting` to inject the in-page reminder only after the corresponding host permission is granted.

Host access is declared under `optional_host_permissions` and is requested at runtime only when a user chooses a feature that needs it. Firefox supports runtime host permissions for MV3 and lets users review/revoke them in Add-ons Manager.

## Privacy

The add-on does not send reminder content, browsing history, site-time data, analytics, or account information to a remote server. Data is stored in Firefox local extension storage. There is no account, advertising SDK, remote analytics, or external tracking endpoint.

## Before submission

1. Confirm the final AMO listing, public website, and repository URLs in `scripts/site-links.json`.
2. Confirm the AMO listing name and metadata match this document and `STORE_LISTING.md` / `STORE_LISTING_EN.md`.
3. Keep the existing Gecko add-on ID stable and increase the manifest/package version for every release.
4. Submit releases as new versions of the existing AMO listing; do not remove and re-add the add-on. With the same ID, Firefox recognizes it as an update and keeps the user's local extension data.
5. Run `npm test` and `npm run package`.
6. Run `web-ext lint --source-dir extension` locally with a supported Firefox/web-ext installation.
7. Test install, browser restart, one-time, interval, daily, weekly, snooze, quiet hours, native/window/in-page notifications, permission grant/revoke, and site-time tracking on supported desktop Firefox versions.
8. Upload the versioned `.xpi` from `dist/` to Mozilla Add-ons, not the GitHub repository archive or the stable-name release copy.
9. Update the AMO listing's display name, description, and store artwork separately when those listing details change; the manifest controls the installed add-on name and icons.
10. Verify the live AMO listing, website, repository, and release-download links before announcing the release.

## Package layout

The AMO upload archive must contain `manifest.json` and the extension files at the ZIP root.
