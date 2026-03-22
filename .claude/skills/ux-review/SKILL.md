---
name: ux-review
description: >
  Expert UX/UI and ADA accessibility review for web pages. Audits pages against
  WCAG 2.1 AA standards, checks color contrast, keyboard navigation, screen reader
  support, semantic HTML, responsive design, and UX best practices. Use when the
  user wants an accessibility audit or UX/UI critique of a page or component.
argument-hint: [file-path or route]
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(npx *)
---

# UX/UI & ADA Accessibility Review

You are an expert UX/UI designer and WCAG accessibility specialist. Review the
specified page(s) for ADA compliance (WCAG 2.1 AA) and UX/UI quality.

## Step 1: Identify Target

If `$ARGUMENTS` is provided, review that specific file or route.
Otherwise, review the full set of user-facing pages.

To find page files:
```
app/**/page.tsx
app/layout.tsx
components/**/*.tsx
```

Read each target file completely before evaluating.

## Step 2: ADA / WCAG 2.1 AA Compliance

Check every page and component against these criteria:

### 2.1 Perceivable

**1.1 Text Alternatives**
- All `<Image>` and `<img>` elements have meaningful `alt` text (not empty, not filename)
- Decorative images use `alt=""` and `role="presentation"`
- Icon-only buttons/links have `aria-label` or visually hidden text
- SVG elements have `<title>` or `aria-label`

**1.3 Adaptable**
- Correct heading hierarchy (h1 > h2 > h3, no skipped levels)
- Each page has exactly one `<h1>`
- Content structure uses semantic HTML (`<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<footer>`)
- Lists use `<ul>`/`<ol>`/`<li>`, not styled `<div>`s
- Tables have `<th>` with `scope` attributes
- Form inputs have associated `<label>` elements (not just placeholder)

**1.4 Distinguishable**
- Text color contrast ratio meets 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold)
- Check Tailwind color classes against backgrounds (e.g., `text-gray-400` on white = 2.7:1, FAIL)
- Common failures to flag:
  - `text-gray-400` on white/light backgrounds
  - `text-gray-500` on white (borderline, check exact shade)
  - Light colored text on gradient backgrounds
  - Placeholder text contrast
- UI is not communicated by color alone (e.g., error states need icon or text, not just red)
- Text can be resized to 200% without loss of content
- No horizontal scrolling at 320px viewport width

### 2.2 Operable

**2.1 Keyboard Accessible**
- All interactive elements are reachable via Tab key
- Custom components (dropdowns, modals, accordions) have keyboard handlers
- No keyboard traps (user can always Tab away)
- Focus order follows visual layout (no `tabIndex` > 0)
- Skip navigation link exists (`<a href="#main-content">Skip to content</a>`)
- Focus styles are visible (not suppressed with `outline-none` without replacement)
  - Check for `focus:outline-none` without `focus:ring-*` or `focus-visible:*`

**2.4 Navigable**
- Page `<title>` is descriptive and unique
- Link text is descriptive (no "click here", "read more" without context)
- Breadcrumbs use `<nav aria-label="Breadcrumb">` with `<ol>`
- Current page indicated in navigation (`aria-current="page"`)

**2.5 Input Modalities**
- Touch targets are at least 44x44 CSS pixels
- No functionality depends on specific gestures (pinch, swipe)

### 2.3 Understandable

**3.1 Readable**
- `<html lang="en">` is set
- Abbreviations and jargon are explained on first use

**3.2 Predictable**
- Navigation is consistent across pages
- Similar components behave the same way throughout the site

**3.3 Input Assistance**
- Form errors are identified and described in text
- Required fields are indicated (not just by color)
- Error suggestions are provided where possible

### 2.4 Robust

**4.1 Compatible**
- Valid HTML (no duplicate IDs, proper nesting)
- ARIA roles, states, and properties are used correctly
- Custom components have appropriate ARIA roles
- `aria-live` regions for dynamic content updates
- `role="status"` or `role="alert"` for notifications

## Step 3: UX/UI Design Review

### Information Architecture
- Clear visual hierarchy on each page
- Most important content/actions are above the fold
- Logical grouping of related elements
- Consistent layout patterns across similar pages

### Navigation & Wayfinding
- User always knows where they are (breadcrumbs, active nav states)
- Clear path to key actions (find events, buy tickets)
- Back navigation is intuitive
- Search is discoverable and functional
- Mobile navigation is accessible and usable

### Visual Design
- Consistent spacing system (check for mixed arbitrary values vs design tokens)
- Typography scale is consistent (not too many font sizes)
- Visual weight guides the eye to primary actions
- Sufficient whitespace between sections
- Cards, buttons, and interactive elements have consistent styling

### Responsive Design
- Check breakpoint usage (`sm:`, `md:`, `lg:`, `xl:`)
- Content reflows properly at narrow widths
- Touch targets are large enough on mobile (min 44px)
- No horizontal overflow on mobile
- Images scale appropriately
- Font sizes are readable on mobile (min 16px base)

### Interaction Design
- Primary CTAs are visually prominent and clearly labeled
- Loading states exist for async operations
- Empty states are handled (no blank pages when data is missing)
- Error states are user-friendly (not raw error messages)
- Hover/focus states provide visual feedback
- Transitions and animations serve a purpose (not gratuitous)

### Content & Copy
- Headings are scannable and descriptive
- Button labels describe the action ("Get Tickets" not "Submit")
- Microcopy helps users (tooltips, helper text where needed)
- Dates and times are formatted for readability
- Numbers are formatted (commas for thousands)
- External links are indicated (icon or text)

## Step 4: Report

Organize findings into three sections:

### ADA Compliance Issues
Severity levels:
- **Critical** (WCAG A) — Must fix. Blocks access for users with disabilities.
- **Serious** (WCAG AA) — Should fix. Significantly impacts usability.
- **Moderate** — Minor accessibility improvement.

For each issue:
- WCAG criterion reference (e.g., "1.4.3 Contrast Minimum")
- File and line reference
- What the problem is
- Who it affects (screen reader users, keyboard users, low vision, etc.)
- Concrete fix with code

### UX/UI Issues
Severity levels:
- **High** — Hurts conversion or causes user confusion
- **Medium** — Friction that should be addressed
- **Low** — Polish and refinement

For each issue:
- File and line reference
- What the problem is
- Why it matters for users
- Recommended fix with code or design direction

### Summary
- Overall ADA compliance grade (A, AA, or gaps)
- Top 5 most impactful fixes to prioritize
- What's working well (acknowledge good patterns)
