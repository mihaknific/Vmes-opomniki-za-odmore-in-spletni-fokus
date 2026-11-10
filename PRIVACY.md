# Privacy

The add-on does not require an account and keeps reminder data local to the Firefox profile.

The extension stores reminders, settings, optional event history, and optional local site-time aggregates in `browser.storage.local`. Firefox documents `storage.local` as extension-local storage; it is not encrypted, so the extension does not use it for secrets.

The standalone Vmes breathing page stores its preferences in the current browser. Users can explicitly export those preferences to a JSON file and import that file on another device. The file is created locally and is never uploaded by Vmes.

Website time limits, focus rules, and site-specific reminders need access only to the domains the user selects. Host access is requested at runtime and can be revoked by the user through Firefox's extension permissions UI. Time is counted only while a selected site is open in the active tab of the focused Firefox window.

No analytics, advertising SDK, remote API, or background telemetry is included in the project.
