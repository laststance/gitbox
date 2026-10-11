/**
 * Unit Tests: Client Components that Server Components render
 *
 * A Client Component that a Server Component renders is built anew, with its
 * state and everything below it, each time the server sends its element again
 * when it is wrapped in `memo()` without a comparison function
 * (vercel/next.js#44901). The root layout renders such components right under
 * `<body>`, so `router.refresh()` rebuilt every page: open dialogs closed and
 * the undo history of the board was emptied.
 *
 * Passing {@link areServerRenderedPropsEqual} to `memo()` avoids it. This file
 * reads the source: it finds every Client Component that a file without
 * `'use client'` renders and checks how that component is exported. The E2E
 * spec `e2e/logged-in/refetch-keeps-client-state.spec.ts` checks the effect in
 * a browser for the board page and the root layout.
 *
 * @see src/lib/utils/are-server-rendered-props-equal.ts
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, test } from 'vitest'

const REPO_ROOT = process.cwd()
const SOURCE_ROOT = join(REPO_ROOT, 'src')

/** A Client Component and the Server Component file that renders it. */
interface ServerRenderedClientComponent {
  /** `<file>#<export name>`, the file relative to the repository root. */
  component: string
  /** Server Component file that renders it. */
  renderedBy: string
  /** How the component is exported. */
  memoComparison: 'none: not wrapped in memo()' | 'missing' | string
}

/** Every `.ts` and `.tsx` file below a directory, tests and stories left out. */
function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry)
    if (statSync(entryPath).isDirectory()) {
      return entry === 'tests' ? [] : listSourceFiles(entryPath)
    }
    const isSource = /\.tsx?$/.test(entry) && !/\.(test|stories)\./.test(entry)
    return isSource ? [entryPath] : []
  })
}

const parsedFiles = new Map<string, ts.SourceFile>()

/** Parses a file once and keeps the syntax tree. */
function parse(file: string): ts.SourceFile {
  const cached = parsedFiles.get(file)
  if (cached) return cached
  const sourceFile = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  parsedFiles.set(file, sourceFile)
  return sourceFile
}

/** Tells whether a file starts with the `'use client'` directive. */
function isClientModule(sourceFile: ts.SourceFile): boolean {
  const firstStatement = sourceFile.statements[0]
  return (
    firstStatement !== undefined &&
    ts.isExpressionStatement(firstStatement) &&
    ts.isStringLiteral(firstStatement.expression) &&
    firstStatement.expression.text === 'use client'
  )
}

/** Resolves `@/…` and relative import paths to a file; packages give `null`. */
function resolveImport(fromFile: string, specifier: string): string | null {
  let basePath: string
  if (specifier.startsWith('@/'))
    basePath = join(SOURCE_ROOT, specifier.slice(2))
  else if (specifier.startsWith('.')) {
    basePath = resolve(dirname(fromFile), specifier)
  } else return null

  const candidates = [
    `${basePath}.tsx`,
    `${basePath}.ts`,
    join(basePath, 'index.tsx'),
    join(basePath, 'index.ts'),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

/** Follows `export { a as b } from` and `export * from` to the defining file. */
function findDefinition(
  file: string,
  exportName: string,
  depth = 0,
): { file: string; exportName: string } {
  if (depth > 5) return { file, exportName }

  for (const statement of parse(file).statements) {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) {
      continue
    }
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    const target = resolveImport(file, statement.moduleSpecifier.text)
    if (target === null) continue

    // `export * from './x'`: the name may be defined there
    if (!statement.exportClause) {
      const found = findDefinition(target, exportName, depth + 1)
      if (declaresExport(found.file, found.exportName)) return found
      continue
    }
    if (!ts.isNamedExports(statement.exportClause)) continue
    for (const element of statement.exportClause.elements) {
      if (element.name.text !== exportName) continue
      const originalName = element.propertyName?.text ?? element.name.text
      return findDefinition(target, originalName, depth + 1)
    }
  }
  return { file, exportName }
}

/** Tells whether a file declares a top-level variable or function of a name. */
function declaresExport(file: string, exportName: string): boolean {
  return parse(file).statements.some((statement) => {
    if (ts.isFunctionDeclaration(statement)) {
      return statement.name?.text === exportName
    }
    if (!ts.isVariableStatement(statement)) return false
    return statement.declarationList.declarations.some(
      (declaration) =>
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportName,
    )
  })
}

/** Reads how a component is exported: the second argument of its `memo()`. */
function readMemoComparison(
  file: string,
  exportName: string,
): ServerRenderedClientComponent['memoComparison'] {
  for (const statement of parse(file).statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue
      if (declaration.name.text !== exportName) continue
      const initializer = declaration.initializer
      if (initializer === undefined || !ts.isCallExpression(initializer)) {
        return 'none: not wrapped in memo()'
      }
      // Both `memo(…)` and `React.memo(…)`
      const callee = initializer.expression
      const isMemoCall =
        (ts.isIdentifier(callee) && callee.text === 'memo') ||
        (ts.isPropertyAccessExpression(callee) && callee.name.text === 'memo')
      if (!isMemoCall) return 'none: not wrapped in memo()'

      const comparison = initializer.arguments[1]
      return comparison ? comparison.getText() : 'missing'
    }
  }
  return 'none: not wrapped in memo()'
}

/** Lists every Client Component that a Server Component file renders as JSX. */
function findServerRenderedClientComponents(): ServerRenderedClientComponent[] {
  const found: ServerRenderedClientComponent[] = []

  for (const file of listSourceFiles(SOURCE_ROOT)) {
    if (!file.endsWith('.tsx')) continue
    const sourceFile = parse(file)
    if (isClientModule(sourceFile)) continue

    // Names this Server Component file uses as JSX tags
    const renderedTagNames = new Set<string>()
    const collectTagNames = (node: ts.Node): void => {
      const isJsxTag =
        ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
      if (isJsxTag && ts.isIdentifier(node.tagName)) {
        renderedTagNames.add(node.tagName.text)
      }
      ts.forEachChild(node, collectTagNames)
    }
    collectTagNames(sourceFile)

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) continue
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
      const importedFile = resolveImport(file, statement.moduleSpecifier.text)
      const namedBindings = statement.importClause?.namedBindings
      if (importedFile === null || !namedBindings) continue
      if (!ts.isNamedImports(namedBindings)) continue

      for (const element of namedBindings.elements) {
        if (!renderedTagNames.has(element.name.text)) continue
        const importedName = element.propertyName?.text ?? element.name.text
        const definition = findDefinition(importedFile, importedName)
        if (!isClientModule(parse(definition.file))) continue

        found.push({
          component: `${relative(REPO_ROOT, definition.file)}#${definition.exportName}`,
          renderedBy: relative(REPO_ROOT, file),
          memoComparison: readMemoComparison(
            definition.file,
            definition.exportName,
          ),
        })
      }
    }
  }
  return found
}

describe('Client Components that Server Components render', () => {
  test('keep their state when the server renders them again: none is wrapped in memo() without areServerRenderedPropsEqual', () => {
    // Arrange
    const serverRenderedClientComponents = findServerRenderedClientComponents()

    // Act: the ones a refetch would build anew
    const rebuiltOnEveryServerRender = serverRenderedClientComponents
      .filter(
        ({ memoComparison }) =>
          memoComparison !== 'areServerRenderedPropsEqual' &&
          memoComparison !== 'none: not wrapped in memo()',
      )
      .map(
        ({ component, renderedBy, memoComparison }) =>
          `${component} (rendered by ${renderedBy}): memo() comparison is ${memoComparison}`,
      )

    // Assert
    expect(rebuiltOnEveryServerRender).toEqual([])
  })

  test('include the four components the root layout renders, so the check above reads real files', () => {
    // Arrange / Act
    const renderedByRootLayout = findServerRenderedClientComponents()
      .filter(({ renderedBy }) => renderedBy === 'src/app/layout.tsx')
      .map(({ component, memoComparison }) => `${component}: ${memoComparison}`)
      .sort()

    // Assert
    expect(renderedByRootLayout).toEqual([
      'src/app/msw-provider.tsx#MSWProvider: areServerRenderedPropsEqual',
      'src/components/CommandPalette/CommandPalette.tsx#CommandPalette: areServerRenderedPropsEqual',
      'src/components/ShortcutsHelp.tsx#ShortcutsHelp: areServerRenderedPropsEqual',
      'src/lib/redux/reduxProvider.tsx#ReduxProvider: areServerRenderedPropsEqual',
    ])
  })

  test('include the page components of the board, the boards list and Maintenance', () => {
    // Arrange / Act
    const components = findServerRenderedClientComponents().map(
      ({ component }) => component,
    )

    // Assert
    expect(components).toContain(
      'src/app/board/[id]/BoardPageClient.tsx#BoardPageClient',
    )
    expect(components).toContain(
      'src/components/Boards/BoardGrid.tsx#BoardGrid',
    )
    expect(components).toContain(
      'src/app/maintenance/MaintenanceClient.tsx#MaintenanceClient',
    )
  })
})
