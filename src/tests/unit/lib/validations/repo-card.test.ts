/**
 * Unit Tests: "Add Repositories" request validation
 *
 * The repository list comes from the browser and its owner / name are echoed in
 * messages and stored on cards, so malformed entries must be rejected before
 * any query runs.
 *
 * @see src/lib/validations/repo-card.ts
 */

import { describe, test, expect } from 'vitest'

import { addRepositoriesRequestSchema } from '@/lib/validations/repo-card'

describe('addRepositoriesRequestSchema', () => {
  test('accepts a real GitHub repository', () => {
    // Arrange
    const request = [
      { id: 123456, name: 'next.js', owner: { login: 'vercel' } },
      { id: 7, name: 'create-react-app_vite', owner: { login: 'Laststance' } },
    ]

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(true)
  })

  test('rejects a repository name carrying markup', () => {
    // Arrange
    const request = [
      {
        id: 1,
        name: '<script>alert(1)</script>',
        owner: { login: 'laststance' },
      },
    ]

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('rejects an owner login containing a slash', () => {
    // Arrange
    const request = [{ id: 1, name: 'gitbox', owner: { login: 'a/b' } }]

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('rejects a non-integer repository id', () => {
    // Arrange
    const request = [
      { id: 1.5, name: 'gitbox', owner: { login: 'laststance' } },
    ]

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('rejects a repository with an empty name', () => {
    // Arrange
    const request = [{ id: 1, name: '', owner: { login: 'laststance' } }]

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('accepts a repository name of exactly 100 characters', () => {
    // Arrange
    const request = [
      { id: 1, name: 'a'.repeat(100), owner: { login: 'laststance' } },
    ]

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(true)
  })

  test('rejects a repository name of 101 characters', () => {
    // Arrange
    const request = [
      { id: 1, name: 'a'.repeat(101), owner: { login: 'laststance' } },
    ]

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('rejects a repository name with non-ASCII letters', () => {
    // Arrange
    const request = [
      { id: 1, name: '日本語-repo', owner: { login: 'laststance' } },
    ]

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('rejects a repository id of zero', () => {
    // Arrange
    const request = [{ id: 0, name: 'gitbox', owner: { login: 'laststance' } }]

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('rejects a repository without an owner', () => {
    // Arrange
    const request = [{ id: 1, name: 'gitbox' }]

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('rejects an empty request', () => {
    // Arrange
    const request: unknown[] = []

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('rejects more than 100 repositories in one request', () => {
    // Arrange
    const request = Array.from({ length: 101 }, (_, index) => ({
      id: index + 1,
      name: `repo-${index}`,
      owner: { login: 'laststance' },
    }))

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(false)
  })

  test('accepts exactly 100 repositories in one request', () => {
    // Arrange
    const request = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      name: `repo-${index}`,
      owner: { login: 'laststance' },
    }))

    // Act
    const result = addRepositoriesRequestSchema.safeParse(request)

    // Assert
    expect(result.success).toBe(true)
  })
})
