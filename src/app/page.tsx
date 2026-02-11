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
import React, {
  useState,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'

import { Button as SharedButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Base glow element styles for the larger outer glow */
const GLOW_OUTER_BASE =
  'absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_hsl(var(--primary)/.5)_10%,_hsl(var(--primary)/0)_60%)] sm:h-[512px]'

/** Base glow element styles for the smaller inner glow */
const GLOW_INNER_BASE =
  'absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-[2] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_hsl(var(--primary)/.3)_10%,_hsl(var(--primary)/0)_60%)] sm:h-[256px]'

/** Additional style for centering the glow vertically */
const GLOW_CENTER_TRANSLATE = '-translate-y-1/2'

// Use shared Button from @/components/ui/button (supports github variant + xl size)
const Button = SharedButton

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

function Glow({
  className,
  variant,
  ref,
  ...props
}: GlowProps & { ref?: React.Ref<HTMLDivElement> }) {
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
}

// Navigation Component
const Navigation = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()

  const handleSignIn = () => {
    router.push('/login')
  }

  return (
    <header className="border-border/50 bg-background/80 fixed top-0 z-50 w-full border-b backdrop-blur-md">
      <nav className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <Columns3 className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="text-foreground text-xl font-semibold">
              GitBox
            </span>
          </div>

          <div className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-8 md:flex">
            <a
              href="#features"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              How It Works
            </a>
            <a
              href="https://github.com/laststance/gitbox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <Button variant="github" size="default" onClick={handleSignIn}>
              <Github className="mr-2 h-4 w-4" />
              Sign in with GitHub
            </Button>
          </div>

          <button
            type="button"
            className="text-foreground flex min-h-11 min-w-11 items-center justify-center md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="bg-background/95 border-border/50 border-t backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-4 px-6 py-4">
            <a
              href="#features"
              className="text-muted-foreground hover:text-foreground py-2 text-sm transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-muted-foreground hover:text-foreground py-2 text-sm transition-colors"
            >
              How It Works
            </a>
            <a
              href="https://github.com/laststance/gitbox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 py-2 text-sm transition-colors"
            >
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
            <div className="border-border/50 border-t pt-4">
              <Button
                variant="github"
                size="default"
                className="w-full"
                onClick={handleSignIn}
              >
                <Github className="mr-2 h-4 w-4" />
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
 * Includes 6 columns: Idea, Planning, Design, Spec Review, Development, Production Release.
 * Displayed in a 2-column grid layout.
 */
/**
 * Initial columns data for the Kanban preview.
 * Layout (4 columns x 2 rows):
 * Row 1: Idea, Design, Development, Production Release
 * Row 2: Planning, Spec Review, (empty), (empty)
 */
const INITIAL_COLUMNS: KanbanColumn[] = [
  // Row 1
  {
    id: 'idea',
    title: 'Idea',
    cards: [
      {
        id: 'ai-agent',
        name: 'AI Agent',
        color: 'bg-violet-500/20 border-violet-500/30',
      },
      {
        id: 'smart-home',
        name: 'Smart Home',
        color: 'bg-teal-500/20 border-teal-500/30',
      },
    ],
  },
  {
    id: 'design',
    title: 'Design',
    cards: [
      {
        id: 'strawberry',
        name: 'Strawberry',
        color: 'bg-purple-500/20 border-purple-500/30',
      },
    ],
  },
  {
    id: 'development',
    title: 'Development',
    cards: [
      {
        id: 'lemonade',
        name: 'Lemonade',
        color: 'bg-amber-500/20 border-amber-500/30',
      },
    ],
  },
  {
    id: 'production-release',
    title: 'Production Release',
    cards: [
      {
        id: 'secret notes',
        name: 'Secret Notes',
        color: 'bg-cyan-500/20 border-cyan-500/30',
      },
      {
        id: 'lifelog app',
        name: 'Lifelog App',
        color: 'bg-rose-500/20 border-rose-500/30',
      },
    ],
  },
  // Row 2
  {
    id: 'planning',
    title: 'Planning',
    cards: [
      {
        id: 'dream board',
        name: 'Dream Board',
        color: 'bg-blue-500/20 border-blue-500/30',
      },
      {
        id: 'tiktok dashboard',
        name: 'TikTok Dashboard',
        color: 'bg-emerald-500/20 border-emerald-500/30',
      },
      {
        id: 'organify',
        name: 'Organify',
        color: 'bg-orange-500/20 border-orange-500/30',
      },
    ],
  },
  {
    id: 'spec-review',
    title: 'Spec Review',
    cards: [
      {
        id: 'api-gateway',
        name: 'API Gateway',
        color: 'bg-indigo-500/20 border-indigo-500/30',
      },
    ],
  },
  // Empty placeholder columns to fill the 4-column grid
  {
    id: 'empty-1',
    title: '',
    cards: [],
  },
  {
    id: 'empty-2',
    title: '',
    cards: [],
  },
]

/** Drag type constants to distinguish between card and column drags */
const DRAG_TYPE = {
  CARD: 'card',
  COLUMN: 'column',
} as const

/**
 * Interactive Kanban Preview Component with HTML5 Drag & Drop.
 * Demonstrates drag-and-drop functionality for both cards and columns.
 * Columns can be reordered by dragging their headers.
 */
const KanbanPreview = () => {
  const [columns, setColumns] = useState<KanbanColumn[]>(INITIAL_COLUMNS)
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  // Column drag state
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)
  const [dragOverColumnIndex, setDragOverColumnIndex] = useState<number | null>(
    null,
  )

  /**
   * Handles the start of a card drag operation.
   * @param e - The drag event
   * @param card - The card being dragged
   * @param sourceColumnId - The ID of the column the card is being dragged from
   */
  const handleCardDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    card: KanbanCard,
    sourceColumnId: string,
  ) => {
    setDraggedCard(card)
    e.dataTransfer.setData('dragType', DRAG_TYPE.CARD)
    e.dataTransfer.setData('cardId', card.id)
    e.dataTransfer.setData('sourceColumnId', sourceColumnId)
    e.dataTransfer.effectAllowed = 'move'

    // Capture the element reference BEFORE requestAnimationFrame
    const target = e.target as HTMLElement
    requestAnimationFrame(() => {
      if (target) {
        target.style.opacity = '0.5'
      }
    })
  }

  /**
   * Handles the end of a card drag operation.
   * @param e - The drag event
   */
  const handleCardDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target) {
      target.style.opacity = '1'
    }
    setDraggedCard(null)
    setDragOverColumn(null)
  }

  /**
   * Handles drag over event for card drops on columns.
   * @param e - The drag event
   * @param columnId - The ID of the column being dragged over
   */
  const handleCardDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    columnId: string,
  ) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!draggedColumnId) {
      setDragOverColumn(columnId)
    }
  }

  /**
   * Handles drag leave event for card drop zones.
   */
  const handleCardDragLeave = () => {
    setDragOverColumn(null)
  }

  /**
   * Handles drop event for cards on columns.
   * Moves the card from source column to target column.
   * @param e - The drag event
   * @param targetColumnId - The ID of the column where the card is dropped
   */
  const handleCardDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetColumnId: string,
  ) => {
    e.preventDefault()
    const dragType = e.dataTransfer.getData('dragType')

    if (dragType !== DRAG_TYPE.CARD) return

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

      const movedCard = sourceColumn.cards.splice(cardIndex, 1)[0]
      if (movedCard) {
        targetColumn.cards.push(movedCard)
      }

      return newColumns
    })

    setDragOverColumn(null)
  }

  /**
   * Handles the start of a column drag operation.
   * @param e - The drag event
   * @param columnId - The ID of the column being dragged
   */
  const handleColumnDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    columnId: string,
  ) => {
    setDraggedColumnId(columnId)
    e.dataTransfer.setData('dragType', DRAG_TYPE.COLUMN)
    e.dataTransfer.setData('columnId', columnId)
    e.dataTransfer.effectAllowed = 'move'

    // Capture the element reference BEFORE requestAnimationFrame
    // (e.currentTarget becomes null after event handler returns)
    const target = e.currentTarget as HTMLElement
    requestAnimationFrame(() => {
      if (target) {
        target.style.opacity = '0.5'
      }
    })
  }

  /**
   * Handles the end of a column drag operation.
   * @param e - The drag event
   */
  const handleColumnDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLElement
    if (target) {
      target.style.opacity = '1'
    }
    setDraggedColumnId(null)
    setDragOverColumnIndex(null)
  }

  /**
   * Handles drag over event for column reordering.
   * @param e - The drag event
   * @param targetIndex - The index where the column would be dropped
   */
  const handleColumnDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedColumnId) return

    const draggedIndex = columns.findIndex((col) => col.id === draggedColumnId)
    if (draggedIndex === targetIndex) {
      setDragOverColumnIndex(null)
      return
    }

    setDragOverColumnIndex(targetIndex)
  }

  /**
   * Handles drop event for column reordering.
   * Moves the column to the new position.
   * @param e - The drag event
   * @param targetIndex - The index where the column is dropped
   */
  const handleColumnDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const dragType = e.dataTransfer.getData('dragType')
    if (dragType !== DRAG_TYPE.COLUMN) return

    const columnId = e.dataTransfer.getData('columnId')
    const sourceIndex = columns.findIndex((col) => col.id === columnId)

    if (sourceIndex === -1 || sourceIndex === targetIndex) {
      setDragOverColumnIndex(null)
      setDraggedColumnId(null)
      return
    }

    setColumns((prevColumns) => {
      const newColumns = [...prevColumns]
      const movedColumn = newColumns.splice(sourceIndex, 1)[0]
      if (movedColumn) {
        newColumns.splice(targetIndex, 0, movedColumn)
      }
      return newColumns
    })

    setDragOverColumnIndex(null)
    setDraggedColumnId(null)
  }

  return (
    <div className="relative mx-auto mt-16 w-full max-w-4xl">
      {/* Browser chrome */}
      <div className="border-border/50 bg-background/50 overflow-hidden rounded-xl border shadow-2xl backdrop-blur-sm">
        {/* Title bar */}
        <div className="border-border/50 bg-muted/30 flex items-center gap-2 border-b px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/70" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <div className="h-3 w-3 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 text-center">
            <div className="bg-muted/50 text-muted-foreground inline-flex items-center gap-2 rounded-md px-4 py-1 text-xs">
              <Columns3 className="h-3 w-3" />
              My Projects Board
            </div>
          </div>
        </div>

        {/* Kanban board - 4 columns layout */}
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((column, idx) => (
            <div
              key={column.id}
              data-testid={`kanban-column-${column.id}`}
              draggable
              onDragStart={(e) => handleColumnDragStart(e, column.id)}
              onDragEnd={handleColumnDragEnd}
              onDragOver={(e) => {
                handleColumnDragOver(e, idx)
                handleCardDragOver(e, column.id)
              }}
              onDragLeave={handleCardDragLeave}
              onDrop={(e) => {
                const dragType = e.dataTransfer.getData('dragType')
                if (dragType === DRAG_TYPE.COLUMN) {
                  handleColumnDrop(e, idx)
                } else {
                  handleCardDrop(e, column.id)
                }
              }}
              className={cn(
                'rounded-lg border p-3 transition-all duration-200',
                // Empty placeholder column styling
                column.id.startsWith('empty-')
                  ? 'border-border/30 border-dashed bg-transparent'
                  : 'border-border/40 bg-muted/20 shadow-sm',
                // Card drop highlight
                dragOverColumn === column.id &&
                  !draggedColumnId &&
                  'border-primary/50 bg-primary/5 shadow-md',
                // Column being dragged
                draggedColumnId === column.id && 'scale-[0.98] opacity-50',
                // Column drop target indicator
                dragOverColumnIndex === idx &&
                  draggedColumnId &&
                  draggedColumnId !== column.id &&
                  'ring-primary ring-offset-background ring-2 ring-offset-2',
              )}
              style={{
                animation: `fadeInUp 0.5s ease-out ${idx * 0.08}s forwards`,
                opacity: 0,
                cursor: draggedColumnId ? 'grabbing' : 'grab',
              }}
            >
              {/* Column header - draggable handle */}
              <div
                className={cn(
                  'flex cursor-grab items-center justify-between active:cursor-grabbing',
                  column.id.startsWith('empty-')
                    ? 'mb-0 justify-center'
                    : 'mb-3',
                )}
              >
                {column.id.startsWith('empty-') ? null : (
                  // Regular column - show title and count
                  <>
                    <span className="text-muted-foreground text-xs font-medium">
                      {column.title}
                    </span>
                    <span
                      className="text-muted-foreground/60 text-xs"
                      data-testid={`column-count-${column.id}`}
                    >
                      {column.cards.length}
                    </span>
                  </>
                )}
              </div>
              {/* Cards container - hidden for empty placeholder columns */}
              {!column.id.startsWith('empty-') && (
                <div className="min-h-15 space-y-2">
                  {column.cards.map((card, cardIdx) => (
                    <div
                      key={card.id}
                      data-testid={`kanban-card-${card.id}`}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation()
                        handleCardDragStart(e, card, column.id)
                      }}
                      onDragEnd={handleCardDragEnd}
                      className={cn(
                        'rounded-lg border p-3 transition-all duration-200',
                        'cursor-grab hover:scale-[1.02] hover:shadow-md active:cursor-grabbing',
                        card.color,
                        draggedCard?.id === card.id && 'opacity-50',
                      )}
                      style={{
                        animation: `fadeInUp 0.4s ease-out ${idx * 0.08 + cardIdx * 0.04 + 0.15}s forwards`,
                        opacity: 0,
                      }}
                    >
                      <span className="text-foreground text-xs font-medium">
                        {card.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Decorative elements */}
      <div className="from-primary/5 absolute -bottom-8 left-1/2 h-16 w-2/3 -translate-x-1/2 bg-linear-to-b to-transparent blur-2xl" />
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
      className="from-background via-background to-muted relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-linear-to-br px-6 py-32"
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
        className="pointer-events-none absolute z-0 transition-opacity duration-300"
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
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center space-y-8 text-center">
        <h1 className="animate-fade-in from-foreground via-foreground to-muted-foreground bg-linear-to-b bg-clip-text text-4xl leading-tight font-bold text-transparent opacity-0 delay-100 sm:text-5xl md:text-6xl lg:text-7xl">
          Manage GitHub Repos
          <br />
          <span className="text-primary">Like Never Before</span>
        </h1>

        <p className="animate-fade-in text-muted-foreground max-w-2xl text-lg opacity-0 delay-200 md:text-xl">
          Organize your GitHub repositories in a beautiful Kanban board.
          Drag-and-drop to track progress, add notes, and keep your projects
          under control.
        </p>

        <div className="animate-fade-in flex flex-wrap items-center justify-center gap-4 pt-4 opacity-0 delay-300">
          <Button
            variant="github"
            size="xl"
            className="min-h-14 gap-2"
            onClick={() => router.push('/login')}
          >
            <Github className="h-5 w-5" />
            Sign in with GitHub
            <ArrowRight className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="min-h-12 gap-2"
            onClick={() => {
              document
                .getElementById('features')
                ?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Learn More
          </Button>
        </div>

        <p className="animate-fade-in text-muted-foreground/70 text-sm opacity-0 delay-500">
          Free and open source. Your data stays with you.
        </p>
      </div>

      {/* Kanban Preview */}
      <div className="animate-fade-in w-full opacity-0 delay-500">
        <KanbanPreview />
      </div>
    </section>
  )
}

// Features Section Component
const FEATURE_SUBTITLES = [
  'Tame the repo chaos from AI-powered development',
  'Your repos multiply faster than ever. We help you stay organized.',
  'Ship fast with AI. Stay organized with GitBox.',
  'In the age of vibe coding, chaos needs a home.',
  'Build more than ever. Lose track of nothing.',
] as const

/**
 * Module-level cache for random subtitle index.
 * Initialized once on first client render and remains stable.
 */
let clientSubtitleIndex: number | null = null

/**
 * Get client snapshot for subtitle index.
 * Initializes random value on first call, returns cached value on subsequent calls.
 * @returns Random subtitle index (0 to FEATURE_SUBTITLES.length - 1)
 */
const getClientSubtitleSnapshot = () => {
  if (clientSubtitleIndex === null) {
    clientSubtitleIndex = Math.floor(Math.random() * FEATURE_SUBTITLES.length)
  }
  return clientSubtitleIndex
}

/**
 * Server snapshot for subtitle index.
 * Returns 0 for consistent SSR output.
 * @returns 0 (first subtitle)
 */
const getServerSubtitleSnapshot = () => 0

/**
 * Empty subscribe function for useSyncExternalStore.
 * @returns Cleanup function (no-op)
 */
const emptySubtitleSubscribe = () => () => {}

const FeaturesSection = () => {
  // SSR-safe random subtitle using useSyncExternalStore
  // Server: Returns 0 (first subtitle)
  // Client: Returns random index (cached after first render)
  const subtitleIndex = useSyncExternalStore(
    emptySubtitleSubscribe,
    getClientSubtitleSnapshot,
    getServerSubtitleSnapshot,
  )

  const features = [
    {
      icon: <Columns3 className="h-8 w-8" />,
      title: 'Kanban Board',
      description:
        'Visual status-based organization for your ever-growing collection of repositories. Create custom columns like Backlog, In Progress, Review, and Done.',
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
        'Archive completed or experimental projects. Keep your board clean while preserving historical data.',
    },
  ]

  return (
    <section id="features" className="bg-muted/30 relative px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <h2 className="from-foreground to-muted-foreground mb-4 bg-linear-to-b bg-clip-text text-3xl font-bold text-transparent md:text-4xl lg:text-5xl">
            For AI Era Developers
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            {FEATURE_SUBTITLES[subtitleIndex]}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group border-border bg-background/50 hover:bg-background hover:border-primary/20 relative rounded-2xl border p-8 backdrop-blur-sm transition-all duration-300 hover:shadow-lg"
            >
              <div className="text-primary mb-4 transition-transform duration-300 group-hover:scale-110">
                {feature.icon}
              </div>
              <h3 className="text-foreground mb-2 text-xl font-semibold">
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
    <section id="how-it-works" className="relative px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <h2 className="from-foreground to-muted-foreground mb-4 bg-linear-to-b bg-clip-text text-3xl font-bold text-transparent md:text-4xl lg:text-5xl">
            How It Works
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Get started in minutes with a simple setup process
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {steps.map((item, index) => (
            <div
              key={index}
              className="border-border/50 bg-background/30 relative flex gap-4 rounded-xl border p-6"
            >
              <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold">
                {item.step}
              </div>
              <div>
                <h3 className="text-foreground mb-1 text-lg font-semibold">
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
    <section className="relative overflow-hidden px-6 py-24">
      <div className="from-primary/10 via-background to-primary/5 absolute inset-0 bg-linear-to-br" />
      <Glow variant="center" className="opacity-30" />

      <div className="relative z-10 mx-auto max-w-4xl space-y-8 text-center">
        <h2 className="from-foreground to-muted-foreground bg-linear-to-b bg-clip-text text-3xl font-bold text-transparent md:text-4xl lg:text-5xl">
          Ready to Organize Your Repos?
        </h2>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg md:text-xl">
          Start managing your GitHub repositories visually. It&apos;s free, open
          source, and your data stays with you.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Button
            variant="github"
            size="xl"
            className="min-h-14 gap-2"
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
    <footer className="border-border/50 border-t px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="bg-primary flex h-6 w-6 items-center justify-center rounded">
            <Columns3 className="text-primary-foreground h-4 w-4" />
          </div>
          <span className="text-foreground text-sm font-medium">GitBox</span>
        </div>
        <div className="text-muted-foreground flex items-center gap-6 text-sm">
          <a
            href="https://github.com/laststance/gitbox"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
          <span>
            Made by{' '}
            <a href="https://laststance.io/" target="_blank">
              Laststance.io
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}

// Main Landing Page Component
function GitBoxLandingPage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
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
