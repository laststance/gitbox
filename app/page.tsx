'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import {
  ArrowRight,
  Menu,
  X,
  Columns3,
  GripVertical,
  FileText,
  Archive,
  Github,
  ExternalLink,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useState, useEffect, useMemo } from 'react'

/**
 * Utility function to join class names, filtering out falsy values.
 * @param classes - Class names to join.
 * @returns The joined class name string.
 */
const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ')
}

/** Base glow element styles for the larger outer glow */
const GLOW_OUTER_BASE =
  'absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_hsl(var(--primary)/.5)_10%,_hsl(var(--primary)/0)_60%)] sm:h-[512px]'

/** Base glow element styles for the smaller inner glow */
const GLOW_INNER_BASE =
  'absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-[2] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_hsl(var(--primary)/.3)_10%,_hsl(var(--primary)/0)_60%)] sm:h-[256px]'

/** Additional style for centering the glow vertically */
const GLOW_CENTER_TRANSLATE = '-translate-y-1/2'

// Button Component
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        github:
          'bg-[#24292f] text-white hover:bg-[#24292f]/90 shadow-lg hover:shadow-xl dark:bg-white dark:text-[#24292f] dark:hover:bg-white/90',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-12 px-8 text-base',
        xl: 'h-14 px-10 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        type="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

// Glow Component
const glowVariants = cva('absolute w-full', {
  variants: {
    variant: {
      top: 'top-0',
      above: '-top-32',
      bottom: 'bottom-0',
      below: '-bottom-32',
      center: 'top-[50%]',
    },
  },
  defaultVariants: {
    variant: 'top',
  },
})

interface GlowProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glowVariants> {}

const Glow = React.forwardRef<HTMLDivElement, GlowProps>(
  ({ className, variant, ...props }, ref) => {
    const outerGlowClassName = useMemo(
      () =>
        variant === 'center'
          ? `${GLOW_OUTER_BASE} ${GLOW_CENTER_TRANSLATE}`
          : GLOW_OUTER_BASE,
      [variant],
    )

    const innerGlowClassName = useMemo(
      () =>
        variant === 'center'
          ? `${GLOW_INNER_BASE} ${GLOW_CENTER_TRANSLATE}`
          : GLOW_INNER_BASE,
      [variant],
    )

    return (
      <div
        ref={ref}
        className={cn(glowVariants({ variant }), className)}
        {...props}
      >
        <div className={outerGlowClassName} />
        <div className={innerGlowClassName} />
      </div>
    )
  },
)
Glow.displayName = 'Glow'

// Navigation Component
const Navigation = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()

  const handleSignIn = () => {
    router.push('/login')
  }

  return (
    <header className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Columns3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">
              GitBox
            </span>
          </div>

          <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </a>
            <a
              href="https://github.com/laststance/gitbox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Button variant="github" size="default" onClick={handleSignIn}>
              <Github className="h-4 w-4 mr-2" />
              Sign in with GitHub
            </Button>
          </div>

          <button
            type="button"
            className="md:hidden text-foreground min-w-11 min-h-11 flex items-center justify-center"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-md border-t border-border/50">
          <div className="px-6 py-4 flex flex-col gap-4">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              How It Works
            </a>
            <a
              href="https://github.com/laststance/gitbox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center gap-1"
            >
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
            <div className="pt-4 border-t border-border/50">
              <Button
                variant="github"
                size="default"
                className="w-full"
                onClick={handleSignIn}
              >
                <Github className="h-4 w-4 mr-2" />
                Sign in with GitHub
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

/**
 * Card data structure for the Kanban preview.
 */
interface KanbanCard {
  /** Unique identifier for the card */
  id: string
  /** Display name of the card */
  name: string
  /** Tailwind CSS classes for background and border colors */
  color: string
}

/**
 * Column data structure for the Kanban preview.
 */
interface KanbanColumn {
  /** Unique identifier for the column */
  id: string
  /** Display title of the column */
  title: string
  /** Cards contained in this column */
  cards: KanbanCard[]
}

/**
 * Initial columns data for the Kanban preview.
 * Includes Backlog (3 cards), In Progress (1), Review (1), Done (2).
 */
const INITIAL_COLUMNS: KanbanColumn[] = [
  {
    id: 'backlog',
    title: 'Backlog',
    cards: [
      {
        id: 'react',
        name: 'react',
        color: 'bg-blue-500/20 border-blue-500/30',
      },
      {
        id: 'vue',
        name: 'vue',
        color: 'bg-emerald-500/20 border-emerald-500/30',
      },
      {
        id: 'angular',
        name: 'angular',
        color: 'bg-orange-500/20 border-orange-500/30',
      },
    ],
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    cards: [
      {
        id: 'nextjs',
        name: 'next.js',
        color: 'bg-purple-500/20 border-purple-500/30',
      },
    ],
  },
  {
    id: 'review',
    title: 'Review',
    cards: [
      {
        id: 'typescript',
        name: 'typescript',
        color: 'bg-amber-500/20 border-amber-500/30',
      },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    cards: [
      {
        id: 'tailwind',
        name: 'tailwind',
        color: 'bg-cyan-500/20 border-cyan-500/30',
      },
      {
        id: 'prisma',
        name: 'prisma',
        color: 'bg-rose-500/20 border-rose-500/30',
      },
    ],
  },
]

/**
 * Interactive Kanban Preview Component with HTML5 Drag & Drop.
 * Demonstrates drag-and-drop functionality for the landing page hero section.
 */
const KanbanPreview = () => {
  const [columns, setColumns] = useState<KanbanColumn[]>(INITIAL_COLUMNS)
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  /**
   * Handles the start of a drag operation.
   * @param e - The drag event
   * @param card - The card being dragged
   * @param sourceColumnId - The ID of the column the card is being dragged from
   */
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    card: KanbanCard,
    sourceColumnId: string,
  ) => {
    setDraggedCard(card)
    e.dataTransfer.setData('cardId', card.id)
    e.dataTransfer.setData('sourceColumnId', sourceColumnId)
    e.dataTransfer.effectAllowed = 'move'

    // Apply drag styling after a brief delay to ensure visual feedback
    requestAnimationFrame(() => {
      const target = e.target as HTMLElement
      target.style.opacity = '0.5'
    })
  }

  /**
   * Handles the end of a drag operation.
   * @param e - The drag event
   */
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    target.style.opacity = '1'
    setDraggedCard(null)
    setDragOverColumn(null)
  }

  /**
   * Handles drag over event for columns.
   * @param e - The drag event
   * @param columnId - The ID of the column being dragged over
   */
  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    columnId: string,
  ) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  /**
   * Handles drag leave event for columns.
   */
  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  /**
   * Handles drop event for columns.
   * Moves the card from source column to target column.
   * @param e - The drag event
   * @param targetColumnId - The ID of the column where the card is dropped
   */
  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetColumnId: string,
  ) => {
    e.preventDefault()
    const cardId = e.dataTransfer.getData('cardId')
    const sourceColumnId = e.dataTransfer.getData('sourceColumnId')

    if (sourceColumnId === targetColumnId) {
      setDragOverColumn(null)
      return
    }

    setColumns((prevColumns) => {
      const newColumns = prevColumns.map((col) => ({
        ...col,
        cards: [...col.cards],
      }))

      const sourceColumn = newColumns.find((col) => col.id === sourceColumnId)
      const targetColumn = newColumns.find((col) => col.id === targetColumnId)

      if (!sourceColumn || !targetColumn) return prevColumns

      const cardIndex = sourceColumn.cards.findIndex(
        (card) => card.id === cardId,
      )
      if (cardIndex === -1) return prevColumns

      const [movedCard] = sourceColumn.cards.splice(cardIndex, 1)
      targetColumn.cards.push(movedCard)

      return newColumns
    })

    setDragOverColumn(null)
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto mt-16">
      {/* Browser chrome */}
      <div className="rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm shadow-2xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
              <Columns3 className="h-3 w-3" />
              My Projects Board
            </div>
          </div>
        </div>

        {/* Kanban board */}
        <div className="p-6 grid grid-cols-4 gap-4">
          {columns.map((column, idx) => (
            <div
              key={column.id}
              data-testid={`kanban-column-${column.id}`}
              className={cn(
                'p-3 rounded-lg border border-border/40 shadow-sm bg-muted/20',
                'transition-all duration-200',
                dragOverColumn === column.id &&
                  'border-primary/50 bg-primary/5 shadow-md',
              )}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              style={{
                animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s forwards`,
                opacity: 0,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {column.title}
                </span>
                <span
                  className="text-xs text-muted-foreground/60"
                  data-testid={`column-count-${column.id}`}
                >
                  {column.cards.length}
                </span>
              </div>
              <div className="space-y-2 min-h-15">
                {column.cards.map((card, cardIdx) => (
                  <div
                    key={card.id}
                    data-testid={`kanban-card-${card.id}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card, column.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'p-3 rounded-lg border transition-all duration-200',
                      'hover:scale-[1.02] hover:shadow-md cursor-grab active:cursor-grabbing',
                      card.color,
                      draggedCard?.id === card.id && 'opacity-50',
                    )}
                    style={{
                      animation: `fadeInUp 0.4s ease-out ${idx * 0.1 + cardIdx * 0.05 + 0.2}s forwards`,
                      opacity: 0,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-3 w-3 text-muted-foreground/40" />
                      <span className="text-xs font-medium text-foreground">
                        {card.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2/3 h-16 bg-linear-to-b from-primary/5 to-transparent blur-2xl" />
    </div>
  )
}

// Hero Section Component
const HeroSection = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const router = useRouter()

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const heroElement = document.getElementById('hero-section')
      if (heroElement) {
        const rect = heroElement.getBoundingClientRect()
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      }
    }

    const heroElement = document.getElementById('hero-section')
    if (heroElement) {
      heroElement.addEventListener('mousemove', handleMouseMove)
      return () => heroElement.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <section
      id="hero-section"
      className="relative min-h-screen flex flex-col items-center justify-center px-6 py-32 overflow-hidden bg-linear-to-br from-background via-background to-muted"
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }
        .animate-fade-in-scale {
          animation: fadeInScale 0.8s ease-out forwards;
        }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        .delay-300 { animation-delay: 300ms; }
        .delay-500 { animation-delay: 500ms; }
      `}</style>

      {/* Background Grid */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--foreground) / 0.1) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--foreground) / 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Mouse Follow Glow */}
      <div
        className="absolute pointer-events-none z-0 transition-opacity duration-300"
        style={{
          left: mousePosition.x,
          top: mousePosition.y,
          width: '300px',
          height: '300px',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)',
        }}
      />

      <Glow variant="center" className="opacity-40" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-5xl mx-auto space-y-8">
        <h1 className="animate-fade-in opacity-0 delay-100 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight bg-linear-to-b from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
          Manage GitHub Repos
          <br />
          <span className="text-primary">Like Never Before</span>
        </h1>

        <p className="animate-fade-in opacity-0 delay-200 text-lg md:text-xl text-muted-foreground max-w-2xl">
          Organize your GitHub repositories in a beautiful Kanban board.
          Drag-and-drop to track progress, add notes, and keep your projects
          under control.
        </p>

        <div className="animate-fade-in opacity-0 delay-300 flex flex-wrap items-center justify-center gap-4 pt-4">
          <Button
            variant="github"
            size="xl"
            className="gap-2 min-h-14"
            onClick={() => router.push('/login')}
          >
            <Github className="h-5 w-5" />
            Sign in with GitHub
            <ArrowRight className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2 min-h-12"
            onClick={() => {
              document
                .getElementById('features')
                ?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Learn More
          </Button>
        </div>

        <p className="animate-fade-in opacity-0 delay-500 text-sm text-muted-foreground/70">
          Free and open source. Your data stays with you.
        </p>
      </div>

      {/* Kanban Preview */}
      <div className="animate-fade-in opacity-0 delay-500 w-full">
        <KanbanPreview />
      </div>
    </section>
  )
}

// Features Section Component
const FeaturesSection = () => {
  const features = [
    {
      icon: <Columns3 className="h-8 w-8" />,
      title: 'Kanban Board',
      description:
        'Visual status-based organization for all your GitHub repositories. Create custom columns like Backlog, In Progress, Review, and Done.',
    },
    {
      icon: <GripVertical className="h-8 w-8" />,
      title: 'Drag & Drop',
      description:
        'Intuitive reordering and status changes. Simply drag repositories between columns to update their status instantly.',
    },
    {
      icon: <FileText className="h-8 w-8" />,
      title: 'Project Info',
      description:
        'Add quick notes, important links, and secure credentials to each repository. Keep all project context in one place.',
    },
    {
      icon: <Archive className="h-8 w-8" />,
      title: 'Maintenance Mode',
      description:
        'Archive completed or deprecated projects. Keep your board clean while preserving historical data.',
    },
  ]

  return (
    <section id="features" className="relative py-24 px-6 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 bg-linear-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">
            Built for Developers
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to organize and track your GitHub repositories
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-8 rounded-2xl border border-border bg-background/50 backdrop-blur-sm hover:bg-background transition-all duration-300 hover:shadow-lg hover:border-primary/20"
            >
              <div className="mb-4 text-primary group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// How It Works Section
const HowItWorksSection = () => {
  const steps = [
    {
      step: '01',
      title: 'Connect GitHub',
      description:
        'Sign in with your GitHub account. We only request read access to your public profile and repositories.',
    },
    {
      step: '02',
      title: 'Create Your Board',
      description:
        'Set up a Kanban board with custom status columns that match your workflow.',
    },
    {
      step: '03',
      title: 'Add Repositories',
      description:
        'Search and add your GitHub repositories to the board. Organize them by dragging between columns.',
    },
    {
      step: '04',
      title: 'Stay Organized',
      description:
        'Add notes, links, and credentials. Track progress and keep your projects under control.',
    },
  ]

  return (
    <section id="how-it-works" className="relative py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 bg-linear-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started in minutes with a simple setup process
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {steps.map((item, index) => (
            <div
              key={index}
              className="relative flex gap-4 p-6 rounded-xl border border-border/50 bg-background/30"
            >
              <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                {item.step}
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1 text-foreground">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// CTA Section Component
const CTASection = () => {
  const router = useRouter()

  return (
    <section className="relative py-24 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-primary/10 via-background to-primary/5" />
      <Glow variant="center" className="opacity-30" />

      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-linear-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">
          Ready to Organize Your Repos?
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Start managing your GitHub repositories visually. It&apos;s free, open
          source, and your data stays with you.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Button
            variant="github"
            size="xl"
            className="gap-2 min-h-14"
            onClick={() => router.push('/login')}
          >
            <Github className="h-5 w-5" />
            Get Started with GitHub
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  )
}

// Footer Component
const Footer = () => {
  return (
    <footer className="border-t border-border/50 py-8 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <Columns3 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-medium text-foreground">GitBox</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <a
            href="https://github.com/laststance/gitbox"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
          <span>Made by Laststance.io</span>
        </div>
      </div>
    </footer>
  )
}

// Main Landing Page Component
function GitBoxLandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CTASection />
      <Footer />
    </div>
  )
}

export default GitBoxLandingPage
