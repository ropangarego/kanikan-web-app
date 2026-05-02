import { Link } from 'react-router-dom'
import { translate, useAppLanguage } from '../../lib/i18n'
import { useAuth } from '../auth/auth-context'
import { PageSection } from '../shared/components'

export const CyclesPage = () => {
  const auth = useAuth()
  const language = useAppLanguage(auth.profile?.language)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)

  return (
    <div className="space-y-6">
      <PageSection title={t('redirect.cyclesTitle')} subtitle={t('redirect.cyclesDesc')}>
        <div className="max-w-2xl space-y-4">
          <p className="text-sm leading-6 text-[var(--color-text-muted)]">{t('redirect.cyclesBody')}</p>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {t('redirect.cyclesHint')}
          </div>
          <Link
            to="/ponds"
            className="inline-flex rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-strong)]"
          >
            {t('redirect.openPonds')}
          </Link>
        </div>
      </PageSection>
    </div>
  )
}
