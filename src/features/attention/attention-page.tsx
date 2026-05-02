import { Link } from 'react-router-dom'
import { useDashboardSummaryQuery } from '../../lib/api'
import { translate, useAppLanguage } from '../../lib/i18n'
import { useAuth } from '../auth/auth-context'
import { StatusPill, EmptyState } from '../shared/components'

export const AttentionPage = () => {
  const auth = useAuth()
  const language = useAppLanguage(auth.profile?.language)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)
  const dashboardQuery = useDashboardSummaryQuery()
  const items =
    dashboardQuery.data?.attention_items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      tone: item.tone === 'danger' ? ('danger' as const) : item.tone === 'warning' ? ('warning' as const) : ('default' as const),
      href: item.pond_id ? `/ponds?pond=${item.pond_id}` : item.cycle_id ? `/cycles/${item.cycle_id}` : '/',
    })) ?? []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{t('dashboard.attention')}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('dashboard.attentionSubtitle')}</p>
      </div>

      {dashboardQuery.isLoading ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 transition hover:border-[var(--color-primary)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-text)]">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">{item.description}</p>
                </div>
                <StatusPill tone={item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : 'default'}>
                  {item.tone === 'danger' ? t('common.status.problem') : item.tone === 'warning' ? t('common.status.check') : t('common.status.info')}
                </StatusPill>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title={t('attention.emptyTitle')} description={t('attention.emptyDesc')} />
      )}
    </div>
  )
}
