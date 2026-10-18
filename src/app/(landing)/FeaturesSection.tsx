import { Columns3, GripVertical, FileText, ArrowRightLeft } from 'lucide-react'
import { memo } from 'react'

const FEATURES_SUBTITLE =
  'Add repositories, drag them between columns, and keep a note with each one.'

const FEATURES = [
  {
    testId: 'feature-card-kanban-board',
    icon: <Columns3 className="h-8 w-8" />,
    title: 'Kanban Board',
    description:
      'Visual status-based organization for your ever-growing collection of repositories. Create custom columns like Backlog, In Progress, Review, and Done.',
  },
  {
    testId: 'feature-card-drag-drop',
    icon: <GripVertical className="h-8 w-8" />,
    title: 'Drag & Drop',
    description:
      'Intuitive reordering and status changes. Simply drag repositories between columns to update their status instantly.',
  },
  {
    testId: 'feature-card-project-info',
    icon: <FileText className="h-8 w-8" />,
    title: 'Project Info',
    description:
      'Add notes and important links to each repository. Keep all project context in one place.',
  },
  {
    testId: 'feature-card-set-work-aside',
    icon: <ArrowRightLeft className="h-8 w-8" />,
    title: 'Set Work Aside',
    description:
      'Move finished or paused repositories to a board of their own. Notes, links and comments stay with each card, so nothing is lost when you bring it back.',
  },
] as const

const [featuredFeature, ...supportingFeatures] = FEATURES

const FEATURE_CARD_BASE_CLASS =
  'border-border bg-background/50 hover:bg-background hover:border-primary/20 relative rounded-2xl border backdrop-blur-sm transition-colors duration-300'

/**
 * Features section: one product headline, a featured Kanban card, and three
 * supporting cards.
 *
 * Rendered from {@link GitBoxLandingPage}. Stays a Server Component so the
 * locked subtitle is the same on the server document and after hydration.
 */
export const FeaturesSection = memo(function FeaturesSection() {
  return (
    <section id="features" className="bg-muted/30 relative px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <h2 className="text-foreground mb-4 font-[family-name:var(--font-landing-display)] text-3xl font-bold md:text-4xl lg:text-5xl">
            A Kanban board for your GitHub repositories
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            {FEATURES_SUBTITLE}
          </p>
        </div>

        <div
          data-testid={featuredFeature.testId}
          className={`${FEATURE_CARD_BASE_CLASS} mb-8 p-8`}
        >
          <div className="text-primary mb-4">{featuredFeature.icon}</div>
          <h3 className="text-foreground mb-2 text-2xl font-semibold">
            {featuredFeature.title}
          </h3>
          <p className="text-muted-foreground">{featuredFeature.description}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {supportingFeatures.map((feature) => (
            <div
              key={feature.title}
              data-testid={feature.testId}
              className={`${FEATURE_CARD_BASE_CLASS} p-6`}
            >
              <div className="text-primary mb-4">{feature.icon}</div>
              <h3 className="text-foreground mb-2 text-lg font-semibold">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
})
