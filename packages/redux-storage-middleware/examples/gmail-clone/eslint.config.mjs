import { fixupConfigRules } from '@eslint/compat'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

/**
 * Merge ESLint configs and deduplicate plugins to avoid conflicts.
 * @param {...Array} configArrays - ESLint config arrays to merge
 * @returns {Array} - Merged config array with deduplicated plugins
 */
function mergeConfigs(...configArrays) {
  const merged = []
  const allPlugins = {}

  for (const configArray of configArrays) {
    const fixed = fixupConfigRules(configArray)
    for (const config of fixed) {
      if (config.plugins) {
        Object.assign(allPlugins, config.plugins)
        const { plugins: _plugins, ...rest } = config
        if (Object.keys(rest).length > 0) {
          merged.push(rest)
        }
      } else {
        merged.push(config)
      }
    }
  }

  if (Object.keys(allPlugins).length > 0) {
    merged.push({ plugins: allPlugins })
  }

  return merged
}

const eslintConfig = [
  ...mergeConfigs(nextVitals, nextTs),
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
]

export default eslintConfig
