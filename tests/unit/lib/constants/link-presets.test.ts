/**
 * Unit Tests: link-presets
 *
 * Tests for link type preset utility functions:
 * - LINK_TYPE_CATEGORIES constant
 * - LINK_TYPE_PRESETS constant
 * - LINK_TYPE_PRESETS_MAP
 * - getPresetsByCategory function
 * - findPresetByValue function
 * - isBuiltInPreset function
 * - labelToValue function
 */

import { describe, it, expect } from 'vitest'

import {
  LINK_TYPE_CATEGORIES,
  LINK_TYPE_PRESETS,
  LINK_TYPE_PRESETS_MAP,
  getPresetsByCategory,
  findPresetByValue,
  isBuiltInPreset,
  labelToValue,
} from '@/lib/constants/link-presets'

describe('link-presets', () => {
  describe('LINK_TYPE_CATEGORIES', () => {
    it('should have 13 categories', () => {
      expect(LINK_TYPE_CATEGORIES).toHaveLength(13)
    })

    it('should include all expected categories', () => {
      const expectedCategories = [
        'Hosting',
        'Cloud',
        'Database',
        'Storage',
        'Auth',
        'Email',
        'Monitoring',
        'Testing',
        'Project',
        'Docs',
        'Publishing',
        'Payment',
        'Custom',
      ]
      expect(LINK_TYPE_CATEGORIES).toEqual(expectedCategories)
    })
  })

  describe('LINK_TYPE_PRESETS', () => {
    it('should have 59 presets', () => {
      expect(LINK_TYPE_PRESETS).toHaveLength(59)
    })

    it('should have valid preset structure', () => {
      for (const preset of LINK_TYPE_PRESETS) {
        expect(preset).toHaveProperty('value')
        expect(preset).toHaveProperty('label')
        expect(preset).toHaveProperty('icon')
        expect(preset).toHaveProperty('category')
        expect(typeof preset.value).toBe('string')
        expect(typeof preset.label).toBe('string')
        expect(typeof preset.icon).toBe('string')
        expect(LINK_TYPE_CATEGORIES).toContain(preset.category)
      }
    })

    it('should have unique values', () => {
      const values = LINK_TYPE_PRESETS.map((p) => p.value)
      const uniqueValues = new Set(values)
      expect(uniqueValues.size).toBe(values.length)
    })
  })

  describe('LINK_TYPE_PRESETS_MAP', () => {
    it('should be a Map with 59 entries', () => {
      expect(LINK_TYPE_PRESETS_MAP).toBeInstanceOf(Map)
      expect(LINK_TYPE_PRESETS_MAP.size).toBe(59)
    })

    it('should allow O(1) lookup by value', () => {
      const vercel = LINK_TYPE_PRESETS_MAP.get('vercel')
      expect(vercel).toBeDefined()
      expect(vercel?.label).toBe('Vercel')
      expect(vercel?.icon).toBe('Triangle')
      expect(vercel?.category).toBe('Hosting')
    })
  })

  describe('getPresetsByCategory', () => {
    it('should return all categories', () => {
      const grouped = getPresetsByCategory()
      const keys = Object.keys(grouped)
      expect(keys).toHaveLength(13)
      for (const category of LINK_TYPE_CATEGORIES) {
        expect(grouped).toHaveProperty(category)
      }
    })

    it('should group presets correctly', () => {
      const grouped = getPresetsByCategory()

      // Check Hosting has 8 presets
      expect(grouped.Hosting).toHaveLength(8)
      expect(grouped.Hosting.map((p) => p.value)).toContain('vercel')
      expect(grouped.Hosting.map((p) => p.value)).toContain('netlify')

      // Check Database has 5 presets
      expect(grouped.Database).toHaveLength(5)
      expect(grouped.Database.map((p) => p.value)).toContain('supabase')

      // Check Custom is empty (no built-in presets)
      expect(grouped.Custom).toHaveLength(0)
    })

    it('should have total presets equal to 59', () => {
      const grouped = getPresetsByCategory()
      let total = 0
      for (const category of LINK_TYPE_CATEGORIES) {
        total += grouped[category].length
      }
      expect(total).toBe(59)
    })
  })

  describe('findPresetByValue', () => {
    it('should find existing preset', () => {
      const result = findPresetByValue('vercel')
      expect(result).toBeDefined()
      expect(result?.label).toBe('Vercel')
      expect(result?.icon).toBe('Triangle')
      expect(result?.category).toBe('Hosting')
    })

    it('should find preset with kebab-case value', () => {
      const result = findPresetByValue('docker-hub')
      expect(result).toBeDefined()
      expect(result?.label).toBe('Docker Hub')
    })

    it('should return undefined for non-existent preset', () => {
      const result = findPresetByValue('non-existent-preset')
      expect(result).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      const result = findPresetByValue('')
      expect(result).toBeUndefined()
    })
  })

  describe('isBuiltInPreset', () => {
    it('should return true for built-in preset', () => {
      expect(isBuiltInPreset('vercel')).toBe(true)
      expect(isBuiltInPreset('supabase')).toBe(true)
      expect(isBuiltInPreset('stripe')).toBe(true)
    })

    it('should return true for preset with kebab-case', () => {
      expect(isBuiltInPreset('docker-hub')).toBe(true)
      expect(isBuiltInPreset('google-cloud')).toBe(true)
      expect(isBuiltInPreset('lemon-squeezy')).toBe(true)
    })

    it('should return false for non-built-in value', () => {
      expect(isBuiltInPreset('my-custom-service')).toBe(false)
      expect(isBuiltInPreset('')).toBe(false)
      expect(isBuiltInPreset('random')).toBe(false)
    })

    it('should be case-sensitive', () => {
      expect(isBuiltInPreset('Vercel')).toBe(false)
      expect(isBuiltInPreset('VERCEL')).toBe(false)
    })
  })

  describe('labelToValue', () => {
    it('should convert simple label to kebab-case', () => {
      expect(labelToValue('My Service')).toBe('my-service')
    })

    it('should handle multiple spaces', () => {
      expect(labelToValue('My   Custom   Service')).toBe('my-custom-service')
    })

    it('should handle special characters', () => {
      expect(labelToValue('My @Service!')).toBe('my-service')
      expect(labelToValue('Service (v2.0)')).toBe('service-v2-0')
    })

    it('should handle leading and trailing spaces', () => {
      expect(labelToValue('  My Service  ')).toBe('my-service')
    })

    it('should handle numbers', () => {
      expect(labelToValue('Service123')).toBe('service123')
      expect(labelToValue('123 Service')).toBe('123-service')
    })

    it('should handle empty string', () => {
      expect(labelToValue('')).toBe('')
    })

    it('should handle only special characters', () => {
      expect(labelToValue('@#$%')).toBe('')
    })

    it('should handle mixed case', () => {
      expect(labelToValue('MyCustomService')).toBe('mycustomservice')
      expect(labelToValue('My CUSTOM Service')).toBe('my-custom-service')
    })

    it('should match docstring example', () => {
      expect(labelToValue('My Custom Service')).toBe('my-custom-service')
    })
  })
})
