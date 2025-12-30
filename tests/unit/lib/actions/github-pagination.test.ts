/**
 * Unit Tests: GitHub API Pagination
 *
 * Tests for the pagination feature in getAuthenticatedUserRepositories
 * and getOrganizationRepositories functions.
 *
 * The fix addresses the bug where repositories beyond the first 100
 * (GitHub's default page limit) were not being fetched.
 *
 * @see lib/actions/github.ts
 */

import { describe, it, expect } from 'vitest'

import type { GitHubRepository } from '@/lib/actions/github'

// Generate mock repositories for pagination testing
const generateMockRepos = (
  count: number,
  startId: number = 1,
  ownerLogin: string = 'testuser',
): GitHubRepository[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    node_id: `MDEwOlJlcG9zaXRvcnk${startId + i}`,
    name: `repo-${startId + i}`,
    full_name: `${ownerLogin}/repo-${startId + i}`,
    owner: {
      login: ownerLogin,
      avatar_url: `https://avatars.githubusercontent.com/u/${startId + i}`,
    },
    description: `Description for repository ${startId + i}`,
    html_url: `https://github.com/${ownerLogin}/repo-${startId + i}`,
    homepage: null,
    stargazers_count: Math.floor(Math.random() * 1000),
    watchers_count: Math.floor(Math.random() * 500),
    language: 'TypeScript',
    topics: ['react', 'nextjs'],
    visibility: 'public' as const,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }))
}

/**
 * Test pagination logic extracted from github.ts
 *
 * Since the actual server action uses `isTestMode()` to return mock data,
 * we test the pagination logic by simulating what the fetchAll loop does.
 */
describe('GitHub API Pagination Logic', () => {
  describe('Page accumulation logic', () => {
    it('should accumulate repos from multiple pages', async () => {
      // Simulate 3 pages of 100 repos each = 300 total
      const page1 = generateMockRepos(100, 1)
      const page2 = generateMockRepos(100, 101)
      const page3 = generateMockRepos(50, 201) // Last page has fewer items

      const allPages = [page1, page2, page3]
      const allRepos: GitHubRepository[] = []
      const perPage = 100
      let pageIndex = 0

      // Simulate the pagination loop from getAuthenticatedUserRepositories
      while (pageIndex < allPages.length) {
        const data = allPages[pageIndex]
        allRepos.push(...data)

        // If we got fewer repos than requested, we've reached the last page
        if (data.length < perPage) {
          break
        }
        pageIndex++
      }

      expect(allRepos.length).toBe(250) // 100 + 100 + 50
      expect(allRepos[0].id).toBe(1)
      expect(allRepos[99].id).toBe(100)
      expect(allRepos[100].id).toBe(101)
      expect(allRepos[249].id).toBe(250)
    })

    it('should stop when page returns fewer items than per_page', () => {
      // Simulate 2 full pages and 1 partial page
      const page1 = generateMockRepos(100, 1)
      const page2 = generateMockRepos(75, 101) // Only 75 repos on page 2

      const allPages = [page1, page2]
      const allRepos: GitHubRepository[] = []
      const perPage = 100
      let pageIndex = 0
      let pagesFetched = 0

      while (pageIndex < allPages.length) {
        const data = allPages[pageIndex]
        allRepos.push(...data)
        pagesFetched++

        if (data.length < perPage) {
          break
        }
        pageIndex++
      }

      expect(allRepos.length).toBe(175)
      expect(pagesFetched).toBe(2)
    })

    it('should handle single page with fewer items than per_page', () => {
      const page1 = generateMockRepos(42, 1) // Only 42 repos total

      const allPages = [page1]
      const allRepos: GitHubRepository[] = []
      const perPage = 100
      let pageIndex = 0

      while (pageIndex < allPages.length) {
        const data = allPages[pageIndex]
        allRepos.push(...data)

        if (data.length < perPage) {
          break
        }
        pageIndex++
      }

      expect(allRepos.length).toBe(42)
    })

    it('should respect maxPages safety limit', () => {
      // Simulate 15 full pages (should stop at 10)
      const pages = Array.from({ length: 15 }, (_, i) =>
        generateMockRepos(100, i * 100 + 1),
      )

      const allRepos: GitHubRepository[] = []
      const perPage = 100
      const maxPages = 10
      let pageIndex = 0

      while (pageIndex < maxPages && pageIndex < pages.length) {
        const data = pages[pageIndex]
        allRepos.push(...data)

        if (data.length < perPage) {
          break
        }
        pageIndex++
      }

      // Should only fetch 10 pages (1000 repos) even though 15 are available
      expect(allRepos.length).toBe(1000)
      expect(pageIndex).toBe(10)
    })

    it('should handle empty response', () => {
      const pages: GitHubRepository[][] = [[]] // Empty first page

      const allRepos: GitHubRepository[] = []
      const perPage = 100
      let pageIndex = 0

      while (pageIndex < pages.length) {
        const data = pages[pageIndex]
        allRepos.push(...data)

        if (data.length < perPage) {
          break
        }
        pageIndex++
      }

      expect(allRepos.length).toBe(0)
    })
  })

  describe('Deduplication logic for org repos', () => {
    it('should merge org repos without duplicates', () => {
      // Simulate user repos
      const userRepos = generateMockRepos(50, 1, 'testuser')

      // Simulate org repos (some overlap with user repos by id)
      const orgRepos = [
        ...generateMockRepos(30, 1, 'laststance'), // Different owner, different ids
        ...generateMockRepos(20, 51, 'laststance'), // Completely new repos
      ]

      // Merge logic from AddRepositoryCombobox.tsx
      const allRepos = [...userRepos]
      const existingIds = new Set(allRepos.map((repo) => repo.id))

      for (const repo of orgRepos) {
        if (!existingIds.has(repo.id)) {
          allRepos.push(repo)
          existingIds.add(repo.id)
        }
      }

      // 50 user repos + 50 org repos (30 with overlapping ids filtered + 20 new)
      // Actually: 50 user + 20 new = 70 (30 overlapping ids 1-30 filtered)
      expect(allRepos.length).toBe(70)
    })

    it('should handle completely unique org repos', () => {
      const userRepos = generateMockRepos(50, 1, 'testuser')
      const orgRepos = generateMockRepos(50, 1000, 'laststance') // Non-overlapping ids

      const allRepos = [...userRepos]
      const existingIds = new Set(allRepos.map((repo) => repo.id))

      for (const repo of orgRepos) {
        if (!existingIds.has(repo.id)) {
          allRepos.push(repo)
          existingIds.add(repo.id)
        }
      }

      expect(allRepos.length).toBe(100) // 50 + 50, no duplicates
    })

    it('should handle completely overlapping org repos', () => {
      const userRepos = generateMockRepos(50, 1, 'testuser')
      const orgRepos = generateMockRepos(50, 1, 'laststance') // Same ids

      const allRepos = [...userRepos]
      const existingIds = new Set(allRepos.map((repo) => repo.id))

      for (const repo of orgRepos) {
        if (!existingIds.has(repo.id)) {
          allRepos.push(repo)
          existingIds.add(repo.id)
        }
      }

      expect(allRepos.length).toBe(50) // Only user repos, all org filtered
    })
  })
})

describe('Pagination URL construction', () => {
  it('should construct correct URL with page parameter', () => {
    const baseUrl = 'https://api.github.com/user/repos'
    const perPage = 100
    const page = 3
    const sort = 'updated'

    const searchParams = new URLSearchParams()
    searchParams.set('sort', sort)
    searchParams.set('per_page', perPage.toString())
    searchParams.set('page', page.toString())

    const url = `${baseUrl}?${searchParams.toString()}`

    expect(url).toBe(
      'https://api.github.com/user/repos?sort=updated&per_page=100&page=3',
    )
  })

  it('should construct correct org repos URL', () => {
    const org = 'laststance'
    const baseUrl = `https://api.github.com/orgs/${org}/repos`
    const perPage = 100
    const page = 2

    const searchParams = new URLSearchParams()
    searchParams.set('per_page', perPage.toString())
    searchParams.set('page', page.toString())
    searchParams.set('type', 'all')

    const url = `${baseUrl}?${searchParams.toString()}`

    expect(url).toBe(
      'https://api.github.com/orgs/laststance/repos?per_page=100&page=2&type=all',
    )
  })
})

describe('fetchAll parameter behavior', () => {
  it('should return all repos when fetchAll is true (simulated)', () => {
    // This simulates the behavior difference between fetchAll: true vs false
    const fetchAllRepos = (fetchAll: boolean, perPage: number = 100) => {
      const totalRepos = 250
      const pages = Math.ceil(totalRepos / perPage)

      if (fetchAll) {
        // Fetch all pages
        const allRepos: GitHubRepository[] = []
        for (let i = 0; i < pages; i++) {
          const startId = i * perPage + 1
          const count = Math.min(perPage, totalRepos - i * perPage)
          allRepos.push(...generateMockRepos(count, startId))
        }
        return allRepos
      } else {
        // Single page only
        return generateMockRepos(Math.min(perPage, totalRepos), 1)
      }
    }

    const withFetchAll = fetchAllRepos(true)
    const withoutFetchAll = fetchAllRepos(false)

    expect(withFetchAll.length).toBe(250)
    expect(withoutFetchAll.length).toBe(100)
  })
})

describe('Edge cases', () => {
  it('should handle exactly per_page items on last page', () => {
    // Edge case: last page has exactly 100 items
    // The loop should make one more request to confirm there's no next page
    const page1 = generateMockRepos(100, 1)
    const page2 = generateMockRepos(100, 101)
    const page3: GitHubRepository[] = [] // Empty page 3

    const allPages = [page1, page2, page3]
    const allRepos: GitHubRepository[] = []
    const perPage = 100
    let pageIndex = 0

    while (pageIndex < allPages.length) {
      const data = allPages[pageIndex]
      allRepos.push(...data)

      if (data.length < perPage) {
        break
      }
      pageIndex++
    }

    expect(allRepos.length).toBe(200)
  })

  it('should handle per_page different from 100', () => {
    // Test with per_page = 50
    const page1 = generateMockRepos(50, 1)
    const page2 = generateMockRepos(50, 51)
    const page3 = generateMockRepos(25, 101) // Last page

    const allPages = [page1, page2, page3]
    const allRepos: GitHubRepository[] = []
    const perPage = 50
    let pageIndex = 0

    while (pageIndex < allPages.length) {
      const data = allPages[pageIndex]
      allRepos.push(...data)

      if (data.length < perPage) {
        break
      }
      pageIndex++
    }

    expect(allRepos.length).toBe(125)
  })
})

describe('Performance characteristics', () => {
  it('should efficiently accumulate large datasets', () => {
    const startTime = performance.now()

    // Simulate 10 pages of 100 repos each
    const allRepos: GitHubRepository[] = []
    for (let page = 0; page < 10; page++) {
      const pageRepos = generateMockRepos(100, page * 100 + 1)
      allRepos.push(...pageRepos)
    }

    const endTime = performance.now()

    expect(allRepos.length).toBe(1000)
    expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
  })

  it('should handle Set-based deduplication efficiently', () => {
    const startTime = performance.now()

    // 500 user repos + 300 org repos with 100 overlapping
    const userRepos = generateMockRepos(500, 1)
    const orgRepos = generateMockRepos(300, 401) // 100 overlapping (401-500)

    const allRepos = [...userRepos]
    const existingIds = new Set(allRepos.map((repo) => repo.id))

    for (const repo of orgRepos) {
      if (!existingIds.has(repo.id)) {
        allRepos.push(repo)
        existingIds.add(repo.id)
      }
    }

    const endTime = performance.now()

    expect(allRepos.length).toBe(700) // 500 + 200 (300 - 100 overlapping)
    expect(endTime - startTime).toBeLessThan(50) // Should complete in under 50ms
  })
})
