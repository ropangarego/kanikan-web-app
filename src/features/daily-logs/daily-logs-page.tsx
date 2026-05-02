import { Link } from 'react-router-dom'
import { translate, useAppLanguage } from '../../lib/i18n'
import { useAuth } from '../auth/auth-context'
import { EmptyState } from '../shared/components'

export const DailyLogsPage = () => {
  const auth = useAuth()
  const language = useAppLanguage(auth.profile?.language)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{t('redirect.dailyLogsTitle')}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{t('redirect.dailyLogsDesc')}</p>
      </div>
      <EmptyState title={t('redirect.usePondDetail')} description={t('redirect.usePondDetailDesc')} />
      <Link
        to="/ponds"
        className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-strong)]"
      >
        {t('redirect.openPonds')}
      </Link>
    </div>
  )
}
