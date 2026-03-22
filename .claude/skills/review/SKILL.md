---
name: review
description: Review staged git changes for code quality, correctness, and maintainability. Use when the user wants a code review before committing.
disable-model-invocation: true
allowed-tools: Bash(git diff *), Bash(git status *), Bash(git log *), Read, Grep, Glob
---

# Code Review

Review the staged git changes for code quality issues.

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

## Step 2: Review Checklist

For each changed file, evaluate against these criteria:

### Correctness
- Logic errors or off-by-one mistakes
- Missing null/undefined checks at system boundaries
- Incorrect types or type assertions that hide bugs
- Race conditions in async code
- Unhandled promise rejections or missing error handling on external calls

### Code Quality
- Functions doing too many things (single responsibility)
- Duplicated logic that should be extracted
- Dead code or unused imports
- Naming that doesn't communicate intent
- Overly complex conditionals that could be simplified

### Next.js / React Patterns
- Client components missing `"use client"` directive
- Server components accidentally importing client-only code
- Missing or incorrect `revalidate` values for ISR pages
- `useEffect` with missing or incorrect dependencies
- Props drilling where composition would be cleaner

### Database (Drizzle/Neon)
- Missing indexes on frequently queried columns
- N+1 query patterns
- SQL injection via string interpolation (use parameterized queries)
- Missing conflict handling on upserts
- Transactions where atomicity is needed

### Performance
- Unnecessary re-renders from unstable references
- Large data fetched when only a subset is needed
- Missing `loading.tsx` or `Suspense` boundaries for slow queries
- Unbounded queries without `LIMIT`

## Step 3: Report

Present findings organized by severity:

1. **Bugs** — Will cause incorrect behavior or crashes
2. **Issues** — Should be fixed but won't break things immediately
3. **Suggestions** — Optional improvements for readability or maintainability

For each finding, include:
- File and line reference
- What the problem is
- A concrete fix (show the code)

If the code looks good, say so. Don't manufacture issues.

## Scope

$ARGUMENTS

If arguments are provided, narrow the review to those files or patterns. Otherwise review all staged changes.
