# Owner-Funded Claim Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add random registration codes and a clear owner-signed wallet funding prompt after claim.

**Architecture:** Registration code generation stays inside the platform store, preserving existing claim lookup and hash-only audit behavior. The claim panel remains a two-stage claim flow and adds a non-blocking funding section after claim finalization. Funding is a connected-owner wallet transfer to the generated trading wallet.

**Tech Stack:** Bun backend tests, Vitest/React Testing Library frontend tests, React + Sui wallet provider types.

---

### Task 1: Random Pairing Code

**Files:**
- Modify: `agent-arena/apps/backend/src/platform/api.test.ts`
- Modify: `agent-arena/apps/backend/src/platform/mock-store.ts`

- [x] Write a failing backend test that asserts `POST /api/arena/agent/init` returns a `PAIR-` code with random hex entropy and not the old `PAIR-####` format.
- [x] Run the targeted backend test and confirm it fails on the sequential code.
- [x] Replace sequential code construction in `PlatformMockStore.createPairingDraft()` with collision-checked random code generation.
- [x] Re-run the targeted backend test and confirm it passes.

### Task 2: Owner Funding Prompt

**Files:**
- Modify: `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.test.tsx`
- Modify: `agent-arena/apps/frontend/src/components/platform/AgentClaimPanel.tsx`

- [x] Write a failing frontend test that claim success renders owner funding guidance and a `Fund wallet` button.
- [x] Run the targeted frontend test and confirm it fails before implementation.
- [x] Add a funding section below the runtime credential result with `1 SUI`, `10 DUSDC`, wallet address, an optional-step note, and a button that opens the owner wallet transfer transaction.
- [x] Re-run the targeted frontend test and confirm it passes.

### Task 3: Verification

**Files:**
- No additional files.

- [x] Run backend platform tests covering pairing and claim.
- [x] Run frontend AgentClaimPanel tests.
- [x] Run relevant typecheck if the targeted tests do not compile all changed TypeScript paths.
