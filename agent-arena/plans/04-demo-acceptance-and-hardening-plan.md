# Demo Acceptance And Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify that the MVP tells the correct Agent Arena story, meets acceptance criteria, avoids layout regressions, and is ready for design review and hackathon demo iteration.

**Architecture:** Add lightweight acceptance tests and final polish after domain, UI, and Predict readiness are already implemented. This plan does not add new protocol behavior; it verifies and hardens the experience.

**Tech Stack:** React, TypeScript, Testing Library, Vitest, Vite build, optional in-app browser screenshot verification.

---

## Source Specs

- `agent-arena/specs/02-frontend-page-spec.md`
- `agent-arena/specs/05-data-state-and-acceptance-spec.md`

## File Structure

- Create: `agent-arena/apps/frontend/src/acceptance/agent-arena.acceptance.test.tsx`
  - End-to-end-style component tests for the primary demo flow.
- Modify: `agent-arena/apps/frontend/src/styles.css`
  - Final responsive hardening.
- Modify: `agent-arena/README.md`
  - Update product story and run commands after implementation.
- Optional create: `agent-arena/apps/frontend/src/components/common/StatusBadge.tsx`
  - Shared visual status badge if repeated status code appears during implementation.

## Task 1: Acceptance Test For Demo Flow

**Files:**
- Create: `agent-arena/apps/frontend/src/acceptance/agent-arena.acceptance.test.tsx`

- [ ] **Step 1: Write the acceptance test**

Create:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("Agent Arena demo flow", () => {
  it("runs the judge-facing flow from Lobby to Arena to Workshop", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Back AI trading agents/i })).toBeInTheDocument();
    expect(screen.getByText(/Sui Predict native/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Enter Live Arena/i }));
    expect(screen.getByRole("heading", { name: /Live Arena/i })).toBeInTheDocument();
    expect(screen.getByText(/Back Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/T-30s/i)).toBeInTheDocument();
    expect(screen.getByText(/Predict/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Workshop/i }));
    expect(screen.getByRole("heading", { name: /Agent Workshop/i })).toBeInTheDocument();
    expect(screen.getByText(/Demo only/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run acceptance test**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/acceptance/agent-arena.acceptance.test.tsx
```

Expected: PASS if the earlier plans are complete.

## Task 2: Acceptance Test For Cancel Versus Close/Redeem Copy

**Files:**
- Modify: `agent-arena/apps/frontend/src/acceptance/agent-arena.acceptance.test.tsx`

- [ ] **Step 1: Add copy safety test**

Append:

```tsx
it("does not describe live Predict exits as free cancellation", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /Enter Live Arena/i }));

  expect(screen.getByText(/Close \/ Redeem/i)).toBeInTheDocument();
  expect(screen.queryByText(/free cancel/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run acceptance test**

Run:

```bash
cd agent-arena/apps/frontend
bun run test src/acceptance/agent-arena.acceptance.test.tsx
```

Expected: PASS.

## Task 3: Responsive Layout Hardening

**Files:**
- Modify: `agent-arena/apps/frontend/src/styles.css`

- [ ] **Step 1: Add text overflow rules**

Ensure compact cards and controls cannot expand the page horizontally:

```css
.truncate-line {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-scroll {
  min-height: 0;
  overflow: auto;
}
```

- [ ] **Step 2: Add button stability rules**

```css
.primary-button,
.secondary-button,
.nav-button,
.round-button {
  min-height: 2.5rem;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .primary-button,
  .secondary-button {
    width: 100%;
  }
}
```

- [ ] **Step 3: Run tests and typecheck**

Run:

```bash
cd agent-arena/apps/frontend
bun run typecheck
bun run test
```

Expected: PASS.

## Task 4: README Update

**Files:**
- Modify: `agent-arena/README.md`

- [ ] **Step 1: Update README product copy**

Ensure `agent-arena/README.md` includes:

```md
# Agent Arena

Agent Arena is a Sui Predict-native MVP where users back AI trading Agents in live market rounds.

The user-facing story:

1. Choose an Agent.
2. Back it before the T-30s lock.
3. Watch it trade through Predict-style positions.
4. Review settlement, fee, digest, and Agent attribution.

The MVP is mock-first for Agent execution and Predict-aware in the UI. It does not implement a custom prediction-market protocol.
```

- [ ] **Step 2: Keep run commands accurate**

README must include:

```bash
cd apps/frontend
bun install
bun run dev
```

and:

```bash
bun run typecheck
bun run test
bun run build
```

- [ ] **Step 3: Run markdown-free verification**

Run:

```bash
git diff --check
```

Expected: PASS.

## Task 5: Production Build

**Files:**
- Verify only.

- [ ] **Step 1: Run full frontend verification**

Run:

```bash
cd agent-arena/apps/frontend
bun run typecheck
bun run test
bun run build
```

Expected: PASS.

- [ ] **Step 2: Start local preview if visual verification is requested**

Run:

```bash
cd agent-arena/apps/frontend
bun run dev
```

Expected: Vite prints a local URL.

Use the in-app browser or the user's running browser to verify:

- Lobby first viewport explains the product.
- Arena chart, Agent rail, backing panel, and portfolio panel are visible.
- Workshop opens and is clearly marked demo-only.
- Desktop page does not have uncontrolled horizontal overflow.
- Mobile layout stacks without horizontal scrolling.

Do not leave a background dev server running after visual verification.

## Task 6: Final Diff Review

**Files:**
- Verify only.

- [ ] **Step 1: Review changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected: changed files match the completed plan phases.

- [ ] **Step 2: Search for unsafe placeholder language**

Run:

```bash
rg -n "TB[D]|TO[D]O|free cancel|guaranteed return|custom prediction-market protocol" agent-arena/apps/frontend agent-arena/README.md
```

Expected: no unresolved placeholder markers, no `free cancel`, no `guaranteed return`; the custom protocol phrase may appear only in negative wording such as "does not implement a custom prediction-market protocol."

- [ ] **Step 3: Commit this phase if committing is part of the execution session**

Run:

```bash
git add agent-arena/apps/frontend/src agent-arena/apps/frontend/package.json agent-arena/README.md
git commit -m "test: harden Agent Arena demo flow"
```

Expected: commit contains acceptance tests, styling polish, and README updates only.
