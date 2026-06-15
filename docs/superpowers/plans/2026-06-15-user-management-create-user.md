# User Management Create User Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a superuser-facing flow to create new users from User Management.

**Architecture:** Add `POST /api/users` on the authenticated user routes, backed by a focused `createUser` controller that validates required fields, rejects duplicate usernames, hashes passwords, and returns a sanitized user. Add a frontend API wrapper and reuse the existing User Management dialog for both create and edit modes.

**Tech Stack:** Express, Mongoose, bcrypt, React, TanStack Query, shadcn/ui, Vite.

---

### Task 1: Backend Create User Endpoint

**Files:**
- Modify: `akunting-backend/src/controllers/userController.ts`
- Modify: `akunting-backend/src/routes/userRoutes.ts`

- [ ] **Step 1: Add `createUser` controller**

Add a controller that reads `username`, `name`, `password`, and `role` from `req.body`, validates `username/password/role`, checks `User.findOne({ username })`, hashes the password with `bcrypt.hash(password, 10)`, creates the user, and returns `{ success: true, data: sanitizedUser }`.

- [ ] **Step 2: Register route**

Add `router.post("/", createUser);` before parameterized routes.

- [ ] **Step 3: Verify backend build**

Run: `npm --prefix akunting-backend run build`

Expected: TypeScript build passes.

### Task 2: Frontend User Management Flow

**Files:**
- Modify: `src/api/users.ts`
- Modify: `src/pages/Users.tsx`

- [ ] **Step 1: Add frontend API wrapper**

Add `createUser(data)` that sends `POST /users` and returns `res.data?.data`.

- [ ] **Step 2: Add create mode to page**

Import the API, add a create mutation, add a `Tambah User` button, and make the existing dialog title/description/button/password placeholder switch between create and edit modes.

- [ ] **Step 3: Verify frontend build**

Run: `npm run build`

Expected: Vite build passes.

### Task 3: Changelog

**Files:**
- Modify: `public/CHANGELOG.md`

- [ ] **Step 1: Add unreleased/current entry**

Document Subscriber owner/PIC layout, Subscriber date/optional-fields/expand work, Perjalanan Dinas API documentation, rekening multi-perusahaan, and User Management create-user flow.

- [ ] **Step 2: Verify diff**

Run: `git diff --check`

Expected: no whitespace errors.
