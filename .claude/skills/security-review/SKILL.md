---
name: security-review
description: Security-focused review of staged git changes. Checks for OWASP Top 10 vulnerabilities, secrets exposure, and insecure patterns. Use when the user wants a security audit before deploying.
disable-model-invocation: true
allowed-tools: Bash(git diff *), Bash(git status *), Bash(git log *), Read, Grep, Glob
---

# Security Review

Perform a security-focused review of staged git changes.

## Step 1: Gather Changes

Get the staged diff and identify changed files:

```bash
git diff --cached --stat
git diff --cached
```

If nothing is staged, check unstaged changes:

```bash
git diff --stat
git diff
```

If no changes at all, inform the user there's nothing to review.

## Step 2: Secrets & Credentials Scan

Check for accidentally committed secrets:

- API keys, tokens, passwords in code or config files
- `.env` or `.env.local` files staged for commit
- Hardcoded connection strings with credentials
- Private keys or certificates
- Service account JSON files

Use grep to scan:

```bash
git diff --cached | grep -iE "(password|secret|api_key|token|private_key|-----BEGIN)" || true
```

## Step 3: OWASP Top 10 Review

Check each changed file against these vulnerability classes:

### A01: Broken Access Control
- Missing authentication checks on API routes
- Authorization bypass (checking wrong user/role)
- Direct object references without ownership validation
- CORS misconfiguration exposing APIs

### A02: Cryptographic Failures
- Sensitive data in logs or error messages
- Weak hashing algorithms
- Missing HTTPS enforcement
- Tokens or session data exposed in URLs

### A03: Injection
- **SQL Injection**: String interpolation in queries instead of parameterized queries (Drizzle ORM params)
- **XSS**: Unsanitized user input rendered with `dangerouslySetInnerHTML` or directly in JSX
- **Command Injection**: User input passed to `exec()`, `spawn()`, or shell commands
- **Path Traversal**: User input in file paths without sanitization

### A04: Insecure Design
- Missing rate limiting on public API routes
- No input validation on form submissions or API parameters
- Business logic that can be abused (e.g., unlimited resource creation)

### A05: Security Misconfiguration
- Debug mode or verbose errors exposed in production
- Default credentials or configurations
- Unnecessary features or routes enabled
- Missing security headers (CSP, X-Frame-Options, etc.)

### A07: Authentication Failures
- Session tokens that don't expire
- Missing CSRF protection on state-changing operations
- Weak password requirements

### A08: Data Integrity Failures
- Dependencies from untrusted sources
- Missing integrity checks on external data
- Unsafe deserialization of user input

### A09: Logging & Monitoring Failures
- Sensitive data written to logs (PII, credentials, tokens)
- Missing audit logging for security-relevant actions

### A10: Server-Side Request Forgery (SSRF)
- User-controlled URLs fetched server-side without allowlist validation
- Redirect URLs not validated

## Step 4: Next.js Specific Security

- Server Actions accepting unvalidated input
- API routes missing authentication middleware
- Environment variables exposed to client (`NEXT_PUBLIC_` prefix misuse)
- `rewrite` or `redirect` rules that could be abused
- Middleware bypasses via path manipulation

## Step 5: Dependency Check

If `package.json` or lock files changed:

- New dependencies — check if well-maintained and trusted
- Version downgrades that might reintroduce vulnerabilities
- Removed security-related packages

## Step 6: Report

Present findings by severity:

1. **Critical** — Exploitable vulnerabilities, exposed secrets (must fix before merge)
2. **High** — Security weaknesses that should be addressed (fix before deploy)
3. **Medium** — Defense-in-depth improvements (fix soon)
4. **Low** — Hardening suggestions (nice to have)

For each finding:
- File and line reference
- Vulnerability type (e.g., "SQL Injection — A03")
- Attack scenario (how it could be exploited)
- Remediation (show the secure code)

If no security issues found, confirm the changes look safe and note what was checked.

## Scope

$ARGUMENTS

If arguments are provided, narrow the review to those files or patterns. Otherwise review all staged changes.
