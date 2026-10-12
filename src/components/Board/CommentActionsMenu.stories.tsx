/**
 * CommentActionsMenu Component Stories
 *
 * A dropdown menu for comment actions with color picker.
 * Tests color picker icons match actual applied colors
 * (using opacity-based backgrounds with borders).
 *
 * @see https://github.com/laststance/gitbox/issues/20
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { CommentActionsMenu } from './CommentActionsMenu'

const meta = {
  title: 'Board/CommentActionsMenu',
  component: CommentActionsMenu,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-card w-[320px] rounded-lg border p-4">
        <div className="group relative">
          <p className="text-muted-foreground mb-4 text-sm">
            Hover to show the menu trigger
          </p>
          <div className="absolute right-0 bottom-0">
            <Story />
          </div>
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof CommentActionsMenu>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default state with neutral color (theme-independent default)
 */
export const DefaultNeutral: Story = {
  args: {
    currentColor: 'neutral',
    onEdit: () => console.log('Edit clicked'),
    onColorChange: (color) => console.log('Color changed to:', color),
    onDelete: () => console.log('Delete clicked'),
  },
}

/**
 * With primary color selected
 */
export const PrimaryColor: Story = {
  args: {
    currentColor: 'primary',
    onEdit: () => console.log('Edit clicked'),
    onColorChange: (color) => console.log('Color changed to:', color),
    onDelete: () => console.log('Delete clicked'),
  },
}

/**
 * With blue color selected
 */
export const BlueColor: Story = {
  args: {
    currentColor: 'blue',
    onEdit: () => console.log('Edit clicked'),
    onColorChange: (color) => console.log('Color changed to:', color),
    onDelete: () => console.log('Delete clicked'),
  },
}

/**
 * With green color selected
 */
export const GreenColor: Story = {
  args: {
    currentColor: 'green',
    onEdit: () => console.log('Edit clicked'),
    onColorChange: (color) => console.log('Color changed to:', color),
    onDelete: () => console.log('Delete clicked'),
  },
}

/**
 * With amber color selected
 */
export const AmberColor: Story = {
  args: {
    currentColor: 'amber',
    onEdit: () => console.log('Edit clicked'),
    onColorChange: (color) => console.log('Color changed to:', color),
    onDelete: () => console.log('Delete clicked'),
  },
}

/**
 * Disabled state
 */
export const Disabled: Story = {
  args: {
    currentColor: 'neutral',
    disabled: true,
    onEdit: () => console.log('Edit clicked'),
    onColorChange: (color) => console.log('Color changed to:', color),
    onDelete: () => console.log('Delete clicked'),
  },
}

/**
 * Interactive test - color icons should display with opacity-based styling
 * that matches actual comment card appearance
 */
export const ColorIconsPreview: Story = {
  args: {
    currentColor: 'neutral',
    onEdit: () => console.log('Edit clicked'),
    onColorChange: (color) => console.log('Color changed to:', color),
    onDelete: () => console.log('Delete clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: `
Color icons use opacity-based styling to match actual comment appearance:
- Background: 50% opacity (e.g., bg-blue-500/50)
- Border: 70% opacity (e.g., border-blue-500/70)

This provides accurate visual preview while remaining visible in small dot size.
        `,
      },
    },
  },
}

/**
 * The check mark of the chosen color has the color of its menu item, also
 * while the pointer is on the item and the item is filled with the accent
 * color. Shown in Plum, whose theme color is the furthest from the color of
 * a highlighted item.
 */
export const CheckMarkHasTheColorOfItsItem: Story = {
  args: {
    currentColor: 'blue',
    onEdit: fn(),
    onColorChange: fn(),
    onDelete: fn(),
  },
  globals: {
    theme: 'plum',
  },
  // Value: protects=the check mark of the chosen comment color can be seen while the pointer or the keyboard is on its item; fails_when=the check mark gets a color of its own again, such as the theme color it had (1.3:1 on the highlighted item in Plum); why_new=no story and no test looked at the check mark; seam=none; no_claim=the contrast of an item's color on its fill, which accent-fill-contrast.test.ts computes for every theme
  play: async ({ canvasElement }) => {
    // Arrange: the page is in Plum and the list of colors is open
    const page = within(document.body)
    await waitFor(async () => {
      await expect(document.documentElement).toHaveAttribute(
        'data-theme',
        'plum',
      )
    })
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Comment actions' }),
    )
    await userEvent.click(await page.findByRole('menuitem', { name: 'Color' }))
    const chosenItem = await page.findByRole('menuitem', { name: 'Blue' })
    const checkMark = chosenItem.querySelector('.lucide-check')
    if (!checkMark) throw new Error('The chosen color has no check mark')

    // Act: the pointer goes to the item, which fills with the accent color
    await userEvent.hover(chosenItem)

    // Assert
    await expect(chosenItem).toHaveAttribute('data-highlighted')
    await waitFor(async () => {
      await expect(getComputedStyle(checkMark).color).toBe(
        getComputedStyle(chosenItem).color,
      )
    })
  },
}
