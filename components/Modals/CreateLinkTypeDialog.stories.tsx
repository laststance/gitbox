/**
 * Create Link Type Dialog Component Stories
 *
 * A dialog for creating custom link type presets.
 * Users can specify a name and icon for their custom link type.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { memo, useState } from 'react'

import { Button } from '@/components/ui/button'

import { CreateLinkTypeDialog } from './CreateLinkTypeDialog'

const meta: Meta<typeof CreateLinkTypeDialog> = {
  title: 'Modals/CreateLinkTypeDialog',
  component: CreateLinkTypeDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof CreateLinkTypeDialog>

/**
 * Default state with dialog closed
 */
const DefaultStory = memo(function DefaultStory() {
  const [open, setOpen] = useState(false)
  const [createdPreset, setCreatedPreset] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4 items-center">
      <Button onClick={() => setOpen(true)}>Add Custom Link Type</Button>
      <CreateLinkTypeDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(preset) => setCreatedPreset(preset.label)}
      />
      {createdPreset && (
        <p className="text-sm text-green-600">Created: {createdPreset}</p>
      )}
    </div>
  )
})

export const Default: Story = {
  render: () => <DefaultStory />,
}

/**
 * Dialog open state (for visual testing)
 */
export const Open: Story = {
  render: () => <CreateLinkTypeDialog open={true} onOpenChange={() => {}} />,
}
