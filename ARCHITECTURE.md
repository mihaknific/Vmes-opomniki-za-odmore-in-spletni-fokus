# Vmes — Architecture

## Product boundary

- `extension/` is the Firefox WebExtension and the primary product.
- `extension/index.html` is the source for the unified public Vmes homepage, including exercises, add-on installation, features, notification channels, privacy, and project links. `extension/vmes.css` styles that page.
- `scripts/` contains validation, tests, and ZIP/XPI packaging. The extension has no runtime package dependencies.
- Reminder, settings, history, and site-use data are kept in Firefox extension storage.

## Extension surfaces

- `extension/popup/` is the compact toolbar dashboard: next reminder, active reminders, site rules, quick-add buttons, and links into management.
- `extension/options/` is one HTML application with hash-routed sections: reminders and their editor, notifications, focus rules, statistics, history, appearance, privacy, backup/data, and about.
- `extension/onboarding/` is the first-run, five-slide setup wizard.
- `extension/notification/` is the dedicated reminder-window interface.
- `extension/content/content.js` renders the optional in-page notification in a Shadow DOM.
- `extension/exercises/` contains separate pages for blocked-site messaging, guided breathing, eye exercises, and seated exercises.

The popup, options, onboarding, notification, and exercise pages use their own HTML/CSS and page-specific JavaScript. Shared behavior and assets live in `extension/lib/` (core data helpers, appearance, icons, and sounds). The public website is separate from the extension UI and does not participate in its runtime.

## Runtime and data flow

`extension/background.js` is the coordinator for alarms, storage, notification delivery, optional site permissions, active-tab site-time sessions, focus limits, and messages from the UI. UI pages use `browser.runtime.sendMessage`; the background script serializes state-changing work through an operation queue.

Durable state includes settings, reminders, history, and site-usage aggregates. The settings schema version supports state migration. Site-time measures only the active tab in the focused Firefox window; switching tabs, domains, or window focus ends or changes the active session.

## Permissions

The manifest declares the extension API permissions for alarms, notifications, local storage, tabs, and scripting. Website access is optional and requested at runtime for user-selected site features or the in-page notification channel. The extension pages use a self-only script Content Security Policy; the extension does not load remote runtime scripts.

## Scheduling and reminder delivery

The shared core normalizes reminder data and calculates scheduling behavior. The background script creates and synchronizes named alarms, restores scheduling on startup, and dispatches notifications through one or more selected channels:

- `system`: Firefox/operating-system notification;
- `inpage`: page UI injected after host access is granted;
- `window`: dedicated extension window;
- combinations of channels.

Reminder actions and delivery outcomes are recorded in local history. Optional custom sounds and bundled audio are local assets.

## Main web pages

The public Vmes homepage is a single page with anchor sections for exercises, installation, features, notification channels, privacy, and the repository. The former `/dodatek/` route redirects to the homepage installation section. The options page is also a single document, but behaves as a multi-section settings application. Exercises and the blocked-site screen are separate extension pages, published as clean exercise routes.

## Backup and release

The options page exports and imports JSON backups. Import validates data before replacing local state and requests the required website permissions when needed.

`npm test` runs validation, shared-core and asset tests, breathing-preference tests, background integration tests, and built-site tests. `npm run package` validates the project and creates a ZIP and an XPI under `dist/`; only the contents of `extension/` go into those archives.
