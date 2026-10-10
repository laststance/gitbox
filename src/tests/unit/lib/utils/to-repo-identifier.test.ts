/**
 * Unit Tests: the identity of a GitHub repository
 *
 * Every "is this repository already placed?" check compares the string built
 * here. If it stops ignoring letter case, the same repository can be offered
 * and added twice; if it mangles a character, two different repositories are
 * treated as one and the second can never be added.
 *
 * @see src/lib/utils/to-repo-identifier.ts
 */

import { describe, test, expect } from 'vitest'

import { toRepoIdentifier } from '@/lib/utils/to-repo-identifier'

describe('toRepoIdentifier', () => {
  test('treats the same repository written in a different letter case as one identity', () => {
    // Arrange
    const owner = 'Laststance'
    const name = 'GitBox'

    // Act
    const identifier = toRepoIdentifier(owner, name)

    // Assert
    expect(identifier).toBe('laststance/gitbox')
  })

  test('keeps dashes, underscores and dots of a repository name', () => {
    // Arrange & Act
    const dashedIdentifier = toRepoIdentifier('user', 'repo-with-dashes')
    const underscoredIdentifier = toRepoIdentifier(
      'org',
      'repo_with_underscores',
    )
    const dottedIdentifier = toRepoIdentifier('vercel', 'next.js')

    // Assert
    expect(dashedIdentifier).toBe('user/repo-with-dashes')
    expect(underscoredIdentifier).toBe('org/repo_with_underscores')
    expect(dottedIdentifier).toBe('vercel/next.js')
  })

  test('tells apart a repository whose name merely starts with the name of another', () => {
    // Arrange
    const placedIdentifiers = new Set([
      toRepoIdentifier('facebook', 'react-native'),
    ])

    // Act
    const reactIdentifier = toRepoIdentifier('facebook', 'react')

    // Assert
    expect(reactIdentifier).toBe('facebook/react')
    expect(placedIdentifiers.has(reactIdentifier)).toBe(false)
  })
})
