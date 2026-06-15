# App Store Public Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public Marketing, Support, and Privacy Policy pages for the Perjalanan Dinas employee app so App Store Connect can reference publicly accessible URLs.

**Architecture:** Create one focused public React page module with three exported route components. Register all routes outside `ProtectedRoute` so App Store reviewers can open them without login.

**Tech Stack:** React, React Router, Tailwind CSS, lucide-react, Vite.

---

### Task 1: Public Page Components

**Files:**
- Create: `src/pages/PublicPerjalananDinasApp.tsx`

- [ ] **Step 1: Build marketing component**

Create a public marketing page at `/perjalanan-dinas-app` describing the Perjalanan Dinas employee workflow.

- [ ] **Step 2: Build support component**

Create a public support page at `/perjalanan-dinas-app/support` with internal support guidance and escalation categories.

- [ ] **Step 3: Build privacy policy component**

Create a public privacy policy page at `/perjalanan-dinas-app/privacy-policy` explaining collected data, purpose, retention, security, and contact path.

### Task 2: Routing

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import components**

Import the three public components from `src/pages/PublicPerjalananDinasApp.tsx`.

- [ ] **Step 2: Add public routes**

Add routes outside `ProtectedRoute` and before the wildcard route:
- `/perjalanan-dinas-app`
- `/perjalanan-dinas-app/support`
- `/perjalanan-dinas-app/privacy-policy`

### Task 3: Verification

**Files:**
- Modify: `public/CHANGELOG.md`

- [ ] **Step 1: Update changelog**

Add a `Perjalanan Dinas App Store Public URLs` item under version `1.6.11`.

- [ ] **Step 2: Build**

Run `npm run build` and confirm Vite succeeds.

- [ ] **Step 3: Browser check**

Open the three local URLs and confirm they render without redirecting to login.
