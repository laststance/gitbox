/**
 * Link Type Combobox Component Stories
 *
 * A searchable dropdown for selecting link types with:
 * - 55 built-in presets grouped by category
 * - User-defined custom presets
 * - Dynamic icon rendering from lucide-react
 * - Add custom type action
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { memo, useState } from 'react'

import { LinkTypeCombobox, type UserPresetOption } from './link-type-combobox'

const meta: Meta<typeof LinkTypeCombobox> = {
  title: 'UI/LinkTypeCombobox',
  component: LinkTypeCombobox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Currently selected value (kebab-case)',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the combobox',
    },
  },
}

export default meta
type Story = StoryObj<typeof LinkTypeCombobox>

/**
 * Default state with Vercel selected
 */
const DefaultStory = memo(function DefaultStory() {
  const [value, setValue] = useState('vercel')
  return <LinkTypeCombobox value={value} onValueChange={setValue} />
})

export const Default: Story = {
  render: () => <DefaultStory />,
}

/**
 * With different preset categories selected
 */
const DifferentPresetsStory = memo(function DifferentPresetsStory() {
  const [value1, setValue1] = useState('sentry')
  const [value2, setValue2] = useState('supabase')
  const [value3, setValue3] = useState('stripe')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm w-24">Monitoring:</span>
        <LinkTypeCombobox value={value1} onValueChange={setValue1} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm w-24">Database:</span>
        <LinkTypeCombobox value={value2} onValueChange={setValue2} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm w-24">Payment:</span>
        <LinkTypeCombobox value={value3} onValueChange={setValue3} />
      </div>
    </div>
  )
})

export const DifferentPresets: Story = {
  render: () => <DifferentPresetsStory />,
}

/**
 * With user custom presets
 */
const WithUserPresetsStory = memo(function WithUserPresetsStory() {
  const [value, setValue] = useState('my-internal-tool')
  const userPresets: UserPresetOption[] = [
    {
      id: '1',
      value: 'my-internal-tool',
      label: 'My Internal Tool',
      icon: 'Wrench',
    },
    { id: '2', value: 'company-wiki', label: 'Company Wiki', icon: 'Book' },
    {
      id: '3',
      value: 'slack-channel',
      label: 'Team Slack',
      icon: 'MessageSquare',
    },
  ]

  return (
    <LinkTypeCombobox
      value={value}
      onValueChange={setValue}
      userPresets={userPresets}
    />
  )
})

export const WithUserPresets: Story = {
  render: () => <WithUserPresetsStory />,
}

/**
 * With Add Custom action
 */
const WithAddCustomStory = memo(function WithAddCustomStory() {
  const [value, setValue] = useState('vercel')
  const [showLog, setShowLog] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <LinkTypeCombobox
        value={value}
        onValueChange={setValue}
        onAddCustomClick={() => setShowLog(true)}
      />
      {showLog && (
        <p className="text-sm text-muted-foreground">
          Add Custom clicked! (Dialog would open here)
        </p>
      )}
    </div>
  )
})

export const WithAddCustom: Story = {
  render: () => <WithAddCustomStory />,
}

/**
 * Disabled state
 */
export const Disabled: Story = {
  render: () => (
    <LinkTypeCombobox value="vercel" onValueChange={() => {}} disabled />
  ),
}

/**
 * Legacy value (backward compatibility with old format)
 */
const LegacyValueStory = memo(function LegacyValueStory() {
  const [value, setValue] = useState('production')
  return (
    <div className="flex flex-col gap-2">
      <LinkTypeCombobox value={value} onValueChange={setValue} />
      <p className="text-xs text-muted-foreground">
        Legacy production value is shown as Production
      </p>
    </div>
  )
})

export const LegacyValue: Story = {
  render: () => <LegacyValueStory />,
}

/**
 * Unknown value fallback
 */
const UnknownValueStory = memo(function UnknownValueStory() {
  const [value, setValue] = useState('unknown-service')
  return (
    <div className="flex flex-col gap-2">
      <LinkTypeCombobox value={value} onValueChange={setValue} />
      <p className="text-xs text-muted-foreground">
        Unknown values are converted to Title Case
      </p>
    </div>
  )
})

export const UnknownValue: Story = {
  render: () => <UnknownValueStory />,
}
