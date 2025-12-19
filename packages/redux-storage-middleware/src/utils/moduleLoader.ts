/**
 * Module Loader Utility
 *
 * Generic utility for lazy loading optional dependencies
 * Used for optional packages like superjson, lz-string, etc.
 */

/**
 * Module loader configuration
 *
 * @typeParam T - Type of module to load
 */
export interface ModuleLoaderConfig<T> {
  /**
   * Module name (for error messages)
   */
  moduleName: string

  /**
   * Function to import the module
   */
  importFn: () => Promise<unknown>

  /**
   * Function to extract module from import result
   * Used to support both default export and named exports
   *
   * @param imported - Result of import()
   * @returns Extracted module
   */
  extractModule?: (imported: unknown) => T
}

/**
 * Module loader interface
 *
 * @typeParam T - Type of module to load
 */
export interface ModuleLoader<T> {
  /**
   * Loads module asynchronously
   *
   * @returns Loaded module
   * @throws If module is not found
   */
  load: () => Promise<T>

  /**
   * Gets loaded module synchronously
   *
   * @returns Module
   * @throws If module is not loaded
   */
  get: () => T

  /**
   * Checks if module is loaded
   */
  isLoaded: () => boolean
}

/**
 * Default module extraction function
 *
 * Prioritizes default export to support both ESM and CommonJS
 */
function defaultExtractor<T>(imported: unknown): T {
  const mod = imported as Record<string, unknown>
  return (mod.default || mod) as T
}

/**
 * Creates generic module loader
 *
 * @typeParam T - Type of module to load
 * @param config - Loader configuration
 * @returns Module loader
 *
 * @example
 * ```ts
 * interface SuperJSONModule {
 *   stringify: (value: unknown) => string
 *   parse: <T>(str: string) => T
 * }
 *
 * const superJsonLoader = createModuleLoader<SuperJSONModule>({
 *   moduleName: 'superjson',
 *   importFn: () => import('superjson'),
 * })
 *
 * // During initialization
 * await superJsonLoader.load()
 *
 * // During use
 * const superjson = superJsonLoader.get()
 * superjson.stringify({ date: new Date() })
 * ```
 */
export function createModuleLoader<T>(
  config: ModuleLoaderConfig<T>,
): ModuleLoader<T> {
  const { moduleName, importFn, extractModule = defaultExtractor } = config

  let cachedModule: T | null = null

  return {
    load: async (): Promise<T> => {
      if (cachedModule) {
        return cachedModule
      }

      try {
        const imported = await importFn()
        // eslint-disable-next-line require-atomic-updates -- Safe to operate in single-threaded environment
        cachedModule = extractModule(imported)
        return cachedModule
      } catch {
        throw new Error(
          `[redux-storage-middleware] ${moduleName} is not installed. ` +
            `Please install it with: pnpm add ${moduleName}`,
        )
      }
    },

    get: (): T => {
      if (!cachedModule) {
        throw new Error(
          `[redux-storage-middleware] ${moduleName} not loaded. ` +
            `Call the init function first.`,
        )
      }
      return cachedModule
    },

    isLoaded: (): boolean => {
      return cachedModule !== null
    },
  }
}
