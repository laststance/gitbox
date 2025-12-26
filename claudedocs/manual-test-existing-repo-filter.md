# Manual Browser Test: AddRepositoryCombobox Existing Repo Filtering

## Feature Overview

**Feature:** Filter out repositories already placed on the current board from the Combobox dropdown selection.

**Commit:** `bdc87e6 feat(AddRepositoryCombobox): filter out repos already on current board`

**Implementation:** Uses Redux `selectRepoCards` to get existing cards and creates a Set of `owner/repo` identifiers for O(1) lookup performance.

---

## Prerequisites

- Local development server running (`pnpm dev` on port 3008)
- GitHub OAuth authentication completed
- At least one board with some repositories already added

---

## Test Cases

### TC-01: Basic Filtering - Repos on Board Should NOT Appear

**Steps:**

1. Navigate to a board with existing repository cards (e.g., `/board/board-1`)
2. Click the "Add Repositories" button in the header
3. Wait for the repository list to load in the combobox dropdown
4. Observe the list of available repositories

**Expected Result:**

- Repositories that are already displayed as cards on the current board should NOT appear in the dropdown list
- Only repositories that have NOT been added to the board should be visible

**Verification:**

- Compare the repo cards visible on the Kanban board with the dropdown options
- None of the repos on the board should be selectable in the dropdown

---

### TC-02: Search Filtering - Searching for Existing Repo

**Steps:**

1. Navigate to a board with at least one repository card
2. Note the name of a repository already on the board (e.g., `testuser/test-repo`)
3. Click the "Add Repositories" button
4. Type the exact name of the existing repository in the search field
5. Wait for the debounced search (300ms) to complete

**Expected Result:**

- The repository that's already on the board should NOT appear in the search results
- If no other repos match the search query, the list should be empty

---

### TC-03: Case-Insensitive Matching

**Steps:**

1. Navigate to a board with a repository card (e.g., `testuser/test-repo`)
2. Click the "Add Repositories" button
3. Search for the repository using different case:
   - Try `TESTUSER/TEST-REPO`
   - Try `TestUser/Test-Repo`
   - Try `testuser/test-REPO`

**Expected Result:**

- All variations should be filtered out (case-insensitive matching)
- The existing repository should NOT appear regardless of the case used in search

---

### TC-04: Non-Existing Repos Should Appear

**Steps:**

1. Navigate to a board that does NOT have all your repositories
2. Click the "Add Repositories" button
3. Observe the repository list

**Expected Result:**

- Repositories that are NOT on the current board should appear in the dropdown
- You should be able to select and add these repositories

---

### TC-05: Empty Board - All Repos Available

**Steps:**

1. Create a new empty board or navigate to a board with no repository cards
2. Click the "Add Repositories" button
3. Observe the repository list

**Expected Result:**

- All repositories from your GitHub account should be available
- No filtering should occur since no repos are on the board

---

### TC-06: Dynamic Update After Adding Repo

**Steps:**

1. Navigate to a board
2. Click "Add Repositories"
3. Select and add a new repository
4. Close the combobox
5. Re-open the combobox by clicking "Add Repositories" again

**Expected Result:**

- The repository you just added should NO LONGER appear in the dropdown
- The filtering should update in real-time based on Redux state

---

### TC-07: Multiple Boards - Board-Specific Filtering

**Steps:**

1. Add `repoA` to Board 1 only
2. Add `repoB` to Board 2 only
3. Navigate to Board 1, open "Add Repositories"
4. Navigate to Board 2, open "Add Repositories"

**Expected Result:**

- On Board 1: `repoA` should NOT appear, but `repoB` should be available
- On Board 2: `repoB` should NOT appear, but `repoA` should be available
- Filtering is specific to the current board, not global

---

### TC-08: Large Board Performance (50+ cards)

**Steps:**

1. Create or use a board with 50+ repository cards
2. Click "Add Repositories"
3. Observe the loading time and responsiveness

**Expected Result:**

- The combobox should open within 1 second
- Filtering should be instant (O(1) Set lookup)
- No UI lag or jank when scrolling through available repos

---

## Claude Chrome Automation Notes

These tests can be automated using Claude Chrome MCP with the following approach:

```typescript
// Example automation steps (pseudo-code)
await page.goto('/board/board-1')
await page.click('button:has-text("Add Repositories")')
await page.waitForSelector('[placeholder="Search repositories..."]')

// Get visible repo options
const options = await page.locator('[role="option"]').allTextContents()

// Verify existing repos are NOT in list
const existingRepos = ['testuser/test-repo', 'testuser/another-repo']
for (const repo of existingRepos) {
  expect(options.some((o) => o.includes(repo))).toBe(false)
}
```

---

## Related Files

- **Component:** `components/Board/AddRepositoryCombobox.tsx`
- **Unit Tests:** `tests/unit/components/Board/AddRepositoryCombobox.test.tsx`
- **E2E Tests:** `tests/e2e/add-repository-combobox.spec.ts`
- **Redux Selector:** `lib/redux/slices/boardSlice.ts` (`selectRepoCards`)

---

## Test Environment

| Environment | URL                                  | Auth         |
| ----------- | ------------------------------------ | ------------ |
| Local       | http://localhost:3008                | GitHub OAuth |
| Production  | https://gitbox-laststance.vercel.app | GitHub OAuth |

---

## Revision History

| Date       | Author | Change                               |
| ---------- | ------ | ------------------------------------ |
| 2025-12-26 | Claude | Initial creation for bdc87e6 feature |
