# Security Policy

## Supported Versions

The `main` branch of `NobinKhan/careguide-backend` is actively maintained.

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, report vulnerabilities privately using [GitHub Private Vulnerability Reporting](https://github.com/NobinKhan/careguide-backend/security/advisories/new) on this repository or by contacting the repository owner (@NobinKhan) directly. Include:

- Affected endpoint(s) or file(s)
- Steps to reproduce or proof-of-concept request
- Potential impact

## Secret & Environment Hygiene

- **Never commit `.env` files or secrets** (`JWT_SECRET`, production `MONGODB_URI`, or credentials) to git.
- `JWT_SECRET` must be at least 32 characters long and must never use placeholder values.
- If a secret is ever exposed, rotate `JWT_SECRET` immediately to invalidate existing tokens.
