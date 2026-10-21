# Security Policy

SpriteForge is a client-side web application (package `spritev2`, version `0.1.0`).
It runs entirely in the browser and persists scene data only to the user's own
`localStorage`. There is no server-side data store and no multi-user backend in
this release.

## Supported Versions

Only the latest release is supported with security fixes.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.0   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

Please report suspected vulnerabilities privately rather than opening a public
issue. Use GitHub's private vulnerability reporting on the repository
(Security → "Report a vulnerability"), or contact the maintainer directly
through the profile at https://github.com/GarcesSebastian.

Include a description of the issue, affected version, and steps to reproduce.
We aim to acknowledge reports within a reasonable time frame and will let you
know whether the report is accepted and when a fix is expected.

## Notes

- Baseline HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`) are configured in `next.config.ts`
  and apply when the app is served via `next start`.
- TODO(CSP): a Content-Security-Policy is intentionally deferred until all inline
  scripts are removed, to avoid breaking the app with a too-strict initial policy.
  This is tracked here and in a `TODO(CSP)` comment in `next.config.ts`.
