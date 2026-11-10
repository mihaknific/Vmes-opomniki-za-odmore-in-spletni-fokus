# Security

The add-on is designed as a local-first Firefox extension.

## Design principles

- No remote JavaScript or runtime CDN dependencies.
- No `eval`, `new Function`, WebSocket, XHR or arbitrary remote code execution.
- Extension pages use a self-only script Content Security Policy.
- Host access is optional and requested only for features that need page access.
- Reminder and settings input is normalized before persistence.
- Imported backups are validated before replacing current data.
- Runtime state is serialized through a small background operation queue to reduce storage races.
- Site-time sessions cap unobserved gaps so a suspended/background Firefox instance is not counted as active browsing time.

## Reporting

For a security issue, open a private GitHub security report or contact the project maintainer before publicly disclosing a vulnerability.
