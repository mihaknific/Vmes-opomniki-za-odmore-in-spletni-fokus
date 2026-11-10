# Vmes: opomniki za odmore in spletni fokus 0.9.2

## 0.9.2

- First reminders now fire after exactly the interval shown in the interface.
- Upgrade migration corrects built-in reminders while preserving customized and user-created reminders.
- Native notifications use the reminder's selected icon, title, and message.
- Built-in reminders can rotate original, category-specific messages; users can instead keep one custom message.
- The onboarding action opens the selected settings page in the current tab and reports failures visibly.
- Firefox for Android uses tabs for reminder windows and active-tab tracking when the desktop `windows` API is unavailable.
- The popup reports extension-state errors instead of showing sample reminder data.
- Countdown formatting is consistent between the popup and settings page and includes seconds.

## 0.9.1

- Updated starter intervals to 10 minutes for eye breaks, 20 minutes for stretching, and 5 minutes for water reminders.
- Staggered built-in reminder schedules and safely migrate unchanged starter reminders during upgrade.
- Updated the body exercise guide to 11 exercises with the new numbered illustrations.
- Fixed the five-minute extension action on website focus screens.
- Updated quick-add presets and the standalone-site reminder preview.
- Prevented disabling site tracking while site reminders or daily time-limit rules still depend on it.
- Aligned package metadata and the GitHub Pages deployment workflow.

## Included features

- Reminder management with search, filters, bulk actions, and duplication.
- Guided breathing, eye-relaxation, and 11 body-stretch exercises.
- Daily time limits and blocking for selected websites.
- Local reminder history, statistics, and JSON backup/restore.
- Optional website permissions and local-first storage.
