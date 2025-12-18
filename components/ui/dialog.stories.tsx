/**
 * Dialog Component Stories
 *
 * A modal dialog component built on Radix UI Dialog primitive.
 * Provides accessible modal dialogs with overlay, proper focus management,
 * and keyboard navigation. Includes subcomponents: DialogTrigger, DialogContent,
 * DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Button } from './button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog'

const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            This is a dialog description. It provides context about the dialog
            content.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>Dialog content goes here</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

export const Simple: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open Simple Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simple Dialog</DialogTitle>
          <DialogDescription>
            A simple dialog without footer actions
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>This dialog only has a close button in the header.</p>
        </div>
      </DialogContent>
    </Dialog>
  ),
}

export const WithForm: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Form Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Item</DialogTitle>
          <DialogDescription>
            Fill in the form below to create a new item
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border px-3 py-2"
              placeholder="Enter name"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="mt-1 w-full rounded-md border px-3 py-2"
              placeholder="Enter description"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
