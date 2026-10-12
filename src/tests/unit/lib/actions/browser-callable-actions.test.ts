/**
 * Unit Tests: which functions of src/lib/actions a browser can call
 *
 * Every export of a `'use server'` file is an endpoint: a signed-in browser
 * can call it with arguments of its choice, whether or not a component
 * imports it. A helper that only server code calls therefore lives in a file
 * without the directive.
 *
 * This file reads the source and pins the list of endpoints. An export added
 * to a `'use server'` file, or a helper file that gains the directive, fails
 * here first, so it is looked at as an endpoint before it ships: does it
 * check who is calling, what it is given and how often it is called?
 *
 * @see src/lib/actions/auth-guard.ts
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import ts from 'typescript'
import { describe, expect, test } from 'vitest'

const ACTIONS_DIRECTORY = join(process.cwd(), 'src/lib/actions')

describe('what a browser can call in src/lib/actions', () => {
  test('exactly the listed Server Actions are endpoints', () => {
    // Arrange
    const actionFileNames = readdirSync(ACTIONS_DIRECTORY).filter((fileName) =>
      fileName.endsWith('.ts'),
    )

    // Act
    const endpointsByFile: Record<string, string[]> = {}
    for (const fileName of actionFileNames) {
      const endpoints = listEndpoints(fileName)
      if (endpoints.length > 0) endpointsByFile[fileName] = endpoints
    }

    // Assert
    expect(endpointsByFile).toEqual({
      'auth.ts': ['signInWithGitHub', 'signOut', 'deleteAccount'],
      'board-data.ts': ['getUserRepoPlacements', 'getBoardBundle'],
      'board.ts': [
        'createStatusList',
        'updateStatusList',
        'deleteStatusList',
        'updateStatusListPosition',
        'swapStatusListPositions',
        'batchUpdateStatusListPositions',
        'updateRepoCardPosition',
        'batchUpdateRepoCardOrders',
        'createBoard',
        'updateBoardPositions',
        'renameBoardAction',
        'deleteBoardAction',
        'toggleBoardFavorite',
        'updateBoardSettingsAction',
        'renameBoardDirect',
        'updateBoardSubtitle',
        'toggleBoardSubtitleVisibility',
        'toggleBoardPublic',
      ],
      'github.ts': ['getAuthenticatedRepositoryCatalog'],
      'project-info.ts': [
        'getProjectInfo',
        'upsertProjectInfo',
        'updateComment',
        'updateCommentColor',
        'deleteComment',
      ],
      'public-board.ts': ['getPublicBoardBySlug'],
      'repo-cards.ts': [
        'addRepositoriesToBoard',
        'deleteRepoCard',
        'getUserBoardsWithStatusLists',
        'moveCardToBoard',
      ],
      'user-presets.ts': ['getUserPresets', 'createUserPreset'],
      'user-settings.ts': ['updateBoardsPageTitle', 'updateBoardsPageSubtitle'],
    })
  })
})

/**
 * Lists what a `'use server'` file of src/lib/actions exports at run time.
 * Types are left out: they do not exist in the built code.
 *
 * @param fileName - File name inside src/lib/actions.
 * @returns The exported names in source order; empty for a file without the
 * `'use server'` directive, whose exports no browser can call.
 * @example
 * listEndpoints('public-board.ts') // => ['getPublicBoardBySlug']
 * listEndpoints('mappers.ts') // => [] (not a Server Actions file)
 */
function listEndpoints(fileName: string): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    readFileSync(join(ACTIONS_DIRECTORY, fileName), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )

  const [firstStatement] = sourceFile.statements
  const isServerActionsFile =
    firstStatement !== undefined &&
    ts.isExpressionStatement(firstStatement) &&
    ts.isStringLiteral(firstStatement.expression) &&
    firstStatement.expression.text === 'use server'
  if (!isServerActionsFile) return []

  return sourceFile.statements.flatMap((statement) => {
    // export { a, b } and export * from '…'
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) return []
      return statement.exportClause && ts.isNamedExports(statement.exportClause)
        ? statement.exportClause.elements.map((element) => element.name.text)
        : [`* from ${statement.moduleSpecifier?.getText() ?? 'unknown'}`]
    }
    if (ts.isExportAssignment(statement)) return ['default']

    const isExported =
      ts.canHaveModifiers(statement) &&
      ts
        .getModifiers(statement)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (!isExported) return []

    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement)
    ) {
      return [statement.name?.text ?? 'default']
    }
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.map((declaration) =>
        declaration.name.getText(),
      )
    }
    // Interfaces and type aliases
    return []
  })
}
