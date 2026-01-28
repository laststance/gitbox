/**
 * Card Component Stories
 *
 * A flexible card component for displaying content in a contained format.
 * Consists of Card (container), CardHeader, CardTitle, CardDescription,
 * CardContent, and CardFooter subcomponents for structured layouts.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Button } from './button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card'

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content area</p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  ),
}

export const Simple: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Simple Card</CardTitle>
      </CardHeader>
      <CardContent>
        <p>This is a simple card without footer</p>
      </CardContent>
    </Card>
  ),
}

export const WithContent: Story = {
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Repository Card</CardTitle>
        <CardDescription>GitHub repository information</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm">
            <strong>Owner:</strong> octocat
          </p>
          <p className="text-sm">
            <strong>Name:</strong> example-repo
          </p>
          <p className="text-sm">
            <strong>Stars:</strong> 100
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">View Details</Button>
        <Button>Open</Button>
      </CardFooter>
    </Card>
  ),
}
