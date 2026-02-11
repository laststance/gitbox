/**
 * Theme CSS Variables Validation Script
 *
 * Validates that all theme CSS files define the required CSS variables.
 * Parses themes.css (14 named themes) and globals.css (:root / .dark bases),
 * plus any individual theme files in src/styles/themes/ subdirectories.
 *
 * @example
 *   pnpm validate:themes
 *   # ✅ themes.css - default: All 20 variables defined
 *   # ❌ themes.css - new-theme: Missing variables:
 *   #    - --theme-accent
 */

/* eslint-disable no-console */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, relative, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')
const STYLES_DIR = resolve(PROJECT_ROOT, 'src/styles')

/**
 * CSS variables that every named theme (html[data-theme='xxx']) must define.
 * These map to Tailwind v4 @theme inline tokens in globals.css.
 */
const REQUIRED_THEME_VARIABLES = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
  '--theme-accent',
] as const

/**
 * CSS variables that :root and .dark base selectors must define.
 * These exclude --theme-accent (only for named themes) but include
 * component-specific variables (sidebar, header, chart, etc.).
 */
const REQUIRED_BASE_VARIABLES = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
] as const

interface ThemeBlock {
  /** Display label for the selector (e.g. "default", ":root") */
  name: string
  /** Source file relative path */
  file: string
  /** CSS variables found in this block */
  variables: Set<string>
}

interface ValidationResult {
  theme: ThemeBlock
  missing: string[]
}

/**
 * Extracts CSS variable declarations from a CSS block body.
 *
 * @example
 *   extractVariables("--background: oklch(0.95 0.012 80); --foreground: ...")
 *   // Set(["--background", "--foreground"])
 */
function extractVariables(blockBody: string): Set<string> {
  const vars = new Set<string>()
  // Match `--variable-name:` (ignoring values, comments)
  const regex = /(--[\w-]+)\s*:/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(blockBody)) !== null) {
    vars.add(match[1]!)
  }
  return vars
}

/**
 * Parses a CSS file and extracts theme blocks with their variables.
 * Recognizes selectors: html[data-theme='xxx'], :root, .dark
 *
 * @example
 *   parseThemeBlocks("src/styles/themes.css", cssContent)
 *   // [{ name: "default", file: "...", variables: Set([...]) }, ...]
 */
function parseThemeBlocks(filePath: string, content: string): ThemeBlock[] {
  const blocks: ThemeBlock[] = []
  const relPath = relative(PROJECT_ROOT, filePath)

  // Match named themes: html[data-theme='xxx'] { ... }
  const namedThemeRegex = /html\[data-theme=['"]([\w-]+)['"]\]\s*\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = namedThemeRegex.exec(content)) !== null) {
    blocks.push({
      name: match[1]!,
      file: relPath,
      variables: extractVariables(match[2]!),
    })
  }

  // Match :root { ... }
  const rootRegex = /(?<!\w):root\s*\{([^}]+)\}/g
  while ((match = rootRegex.exec(content)) !== null) {
    blocks.push({
      name: ':root',
      file: relPath,
      variables: extractVariables(match[1]!),
    })
  }

  // Match .dark { ... }
  const darkRegex = /(?<!\w)\.dark\s*\{([^}]+)\}/g
  while ((match = darkRegex.exec(content)) !== null) {
    blocks.push({
      name: '.dark',
      file: relPath,
      variables: extractVariables(match[1]!),
    })
  }

  return blocks
}

/**
 * Discovers theme CSS files for named theme validation.
 * Includes themes.css and any files in themes/ subdirectories.
 * globals.css is handled separately (base selectors only).
 */
function discoverThemeFiles(): string[] {
  const files: string[] = []

  const themesFile = resolve(STYLES_DIR, 'themes.css')
  if (existsSync(themesFile)) files.push(themesFile)

  // Individual theme files in subdirectories (forward-compatible)
  const themeDirs = ['themes/light', 'themes/dark']
  for (const dir of themeDirs) {
    const dirPath = resolve(STYLES_DIR, dir)
    if (existsSync(dirPath)) {
      const entries = readdirSync(dirPath).filter((f) => f.endsWith('.css'))
      for (const entry of entries) {
        files.push(resolve(dirPath, entry))
      }
    }
  }

  return files
}

/**
 * Validates a theme block against the required variables list.
 */
function validateBlock(
  block: ThemeBlock,
  required: readonly string[],
): ValidationResult {
  const missing = required.filter((v) => !block.variables.has(v))
  return { theme: block, missing }
}

/** Main validation entry point */
function main(): void {
  const themeFiles = discoverThemeFiles()
  const globalsFile = resolve(STYLES_DIR, 'globals.css')

  if (themeFiles.length === 0) {
    console.error('❌ No theme CSS files found in src/styles/')
    process.exit(1)
  }

  // Parse named themes from theme files only (avoids @media override false positives)
  const allBlocks: ThemeBlock[] = []
  for (const file of themeFiles) {
    const content = readFileSync(file, 'utf-8')
    const blocks = parseThemeBlocks(file, content)
    // Only include named themes from theme files
    allBlocks.push(
      ...blocks.filter((b) => b.name !== ':root' && b.name !== '.dark'),
    )
  }

  // Parse :root and .dark base selectors from globals.css only
  if (existsSync(globalsFile)) {
    const content = readFileSync(globalsFile, 'utf-8')
    const blocks = parseThemeBlocks(globalsFile, content)
    allBlocks.push(
      ...blocks.filter((b) => b.name === ':root' || b.name === '.dark'),
    )
  }

  if (allBlocks.length === 0) {
    console.error('❌ No theme blocks found in CSS files')
    process.exit(1)
  }

  // Validate each block
  const results: ValidationResult[] = []
  for (const block of allBlocks) {
    const isBase = block.name === ':root' || block.name === '.dark'
    const required = isBase ? REQUIRED_BASE_VARIABLES : REQUIRED_THEME_VARIABLES
    results.push(validateBlock(block, required))
  }

  // Report results
  let hasErrors = false

  for (const { theme, missing } of results) {
    const label = `${basename(theme.file)} - ${theme.name}`

    if (missing.length === 0) {
      const requiredCount =
        theme.name === ':root' || theme.name === '.dark'
          ? REQUIRED_BASE_VARIABLES.length
          : REQUIRED_THEME_VARIABLES.length
      console.log(`✅ ${label}: All ${requiredCount} variables defined`)
    } else {
      hasErrors = true
      console.error(`❌ ${label}: Missing variables:`)
      for (const v of missing) {
        console.error(`   - ${v}`)
      }
    }
  }

  // Summary
  console.log('')
  const total = results.length
  const passed = results.filter((r) => r.missing.length === 0).length
  const failed = total - passed

  if (hasErrors) {
    console.error(
      `Theme validation failed: ${failed}/${total} theme blocks have missing variables`,
    )
    process.exit(1)
  } else {
    console.log(
      `Theme validation passed: ${passed}/${total} theme blocks validated`,
    )
  }
}

main()
