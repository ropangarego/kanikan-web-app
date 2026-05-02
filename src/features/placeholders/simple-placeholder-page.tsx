import { PageSection } from '../shared/components'

export const SimplePlaceholderPage = ({
  title,
  description,
  subtitle,
  stablePath,
}: {
  title: string
  description: string
  subtitle: string
  stablePath: string
}) => (
  <div className="space-y-6">
    <PageSection title={title} subtitle={subtitle}>
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-8">
        <p className="font-medium text-[var(--color-text)]">{description}</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{stablePath}</p>
      </div>
    </PageSection>
  </div>
)
