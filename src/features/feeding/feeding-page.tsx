import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { FeedingInputStatus, FeedingSessionLabel } from '../../types/api-contract'
import { createFeedingSession, useFeedingPageQuery } from '../../lib/api'
import { formatDate, formatNumber } from '../../lib/format'
import { translate, useAppLanguage } from '../../lib/i18n'
import { useAuth } from '../auth/auth-context'
import { useToast } from '../feedback/toast-provider'
import { EmptyState, StatusPill } from '../shared/components'

type EntryDraft = {
  unitId: string
  feedG: string
  status: FeedingInputStatus
}

const getToday = () => new Date().toISOString().slice(0, 10)

const fieldClassName =
  'w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-base text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] md:text-sm'

const buttonClassName =
  'inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50'

const primaryButtonClassName =
  'inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-strong)] disabled:cursor-not-allowed disabled:opacity-50'

const sessions: FeedingSessionLabel[] = ['morning', 'noon', 'evening']

export const FeedingPage = () => {
  const auth = useAuth()
  const language = useAppLanguage(auth.profile?.language)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [date, setDate] = useState(getToday())
  const [sessionLabel, setSessionLabel] = useState<FeedingSessionLabel>('morning')
  const [note, setNote] = useState('')
  const [drafts, setDrafts] = useState<EntryDraft[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const feedingQuery = useFeedingPageQuery({ date, session_label: sessionLabel })
  const page = feedingQuery.data

  const pondMap = useMemo(
    () => new Map(page?.active_ponds.map((pond) => [pond.pond_id, pond]) ?? []),
    [page?.active_ponds],
  )

  useEffect(() => {
    if (!page?.active_ponds) return
    setDrafts(
      page.active_ponds.map((pond) => ({
        unitId: pond.pond_id,
        feedG:
          pond.suggested_feed_g !== null && pond.suggested_feed_g !== undefined
            ? String(Math.round(pond.suggested_feed_g))
            : '',
        status: pond.suggested_feed_g ? 'suggested_confirmed' : 'manual',
      })),
    )
  }, [page?.active_ponds])

  const sessionName = (value: FeedingSessionLabel) => {
    if (value === 'morning') return t('feeding.session.morning')
    if (value === 'noon') return t('feeding.session.noon')
    if (value === 'evening') return t('feeding.session.evening')
    return t('feeding.session.custom')
  }

  const updateDraft = (unitId: string, patch: Partial<EntryDraft>) => {
    setDrafts((items) => items.map((item) => (item.unitId === unitId ? { ...item, ...patch } : item)))
  }

  const applyTemplate = (template: 'normal' | 'low' | 'sample') => {
    if (template === 'normal') setNote(t('feeding.template.normal'))
    if (template === 'low') setNote(t('feeding.template.low'))
    if (template === 'sample') setNote(t('feeding.template.sample'))
  }

  const isOutsideRange = (draft: EntryDraft) => {
    const pond = pondMap.get(draft.unitId)
    const value = Number(draft.feedG || 0)
    if (!pond || draft.status === 'skipped' || value <= 0) return false
    if (pond.min_feed_g !== null && pond.min_feed_g !== undefined && value < pond.min_feed_g) return true
    if (pond.max_feed_g !== null && pond.max_feed_g !== undefined && value > pond.max_feed_g) return true
    return false
  }

  const submit = async () => {
    const entries = drafts
      .map((draft) => ({
        unitId: draft.unitId,
        feedG: draft.status === 'skipped' ? null : Number(draft.feedG || 0),
        inputStatus: draft.status,
      }))
      .filter((entry) => entry.inputStatus === 'skipped' || (entry.feedG ?? 0) > 0)

    if (entries.length === 0) {
      showToast(t('common.validationFailed'), 'error', t('feeding.noEntries'))
      return
    }

    setIsSaving(true)
    try {
      await createFeedingSession({
        date,
        sessionLabel,
        note,
        entries,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['read-api', 'feeding-page'] }),
        queryClient.invalidateQueries({ queryKey: ['read-api', 'dashboard-summary'] }),
      ])
      showToast(t('feeding.saved'), 'success', t('feeding.savedDesc'))
    } catch {
      showToast(t('feeding.couldNotSave'), 'error', t('cash.checkConnection'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{t('feeding.title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('feeding.subtitle')}</p>
      </div>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">{t('feeding.date')}</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClassName} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">{t('feeding.session')}</span>
            <select value={sessionLabel} onChange={(event) => setSessionLabel(event.target.value as FeedingSessionLabel)} className={fieldClassName}>
              {sessions.map((session) => (
                <option key={session} value={session}>
                  {sessionName(session)}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <span className="text-sm font-semibold text-[var(--color-text)]">{t('feeding.template')}</span>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => applyTemplate('normal')} className={buttonClassName}>
                Normal
              </button>
              <button type="button" onClick={() => applyTemplate('low')} className={buttonClassName}>
                Low
              </button>
              <button type="button" onClick={() => applyTemplate('sample')} className={buttonClassName}>
                Sample
              </button>
            </div>
          </div>
        </div>
        <label className="mt-4 block space-y-2">
          <span className="text-sm font-semibold text-[var(--color-text)]">{t('feeding.note')}</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className={`${fieldClassName} min-h-[72px] py-3`} />
        </label>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t('feeding.activePonds')}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{sessionName(sessionLabel)} - {formatDate(date)}</p>
          </div>
          <button type="button" disabled={isSaving || feedingQuery.isLoading} onClick={() => void submit()} className={primaryButtonClassName}>
            {isSaving ? t('common.saving') : t('feeding.submit')}
          </button>
        </div>

        {feedingQuery.isError ? (
          <EmptyState title={t('feeding.couldNotSave')} description={t('cash.checkConnection')} />
        ) : feedingQuery.isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
          </div>
        ) : drafts.length === 0 ? (
          <EmptyState title={t('feeding.noActivePonds')} description={t('pond.emptyDesc')} />
        ) : (
          <div className="space-y-3">
            {drafts.map((draft) => {
              const pond = pondMap.get(draft.unitId)
              if (!pond) return null
              const warning = isOutsideRange(draft)
              return (
                <div key={draft.unitId} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--color-text)]">{pond.pond_name}</p>
                        <StatusPill tone={pond.already_recorded ? 'success' : 'default'}>
                          {pond.already_recorded ? t('common.status.active') : pond.fish_species ?? t('common.fish')}
                        </StatusPill>
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {pond.suggested_feed_g
                          ? t('feeding.suggestedAmount').replace('{amount}', formatNumber(Math.round(pond.suggested_feed_g)))
                          : pond.last_feed_g
                            ? t('feeding.lastUsed').replace('{amount}', formatNumber(Math.round(pond.last_feed_g)))
                            : '-'}
                      </p>
                    </div>
                    <div className="grid min-w-0 gap-2 md:w-[360px] md:grid-cols-[1fr_auto_auto]">
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={draft.feedG}
                        disabled={draft.status === 'skipped'}
                        onChange={(event) =>
                          updateDraft(draft.unitId, {
                            feedG: Number(event.target.value) < 0 ? '' : event.target.value,
                            status: 'manual',
                          })
                        }
                        className={fieldClassName}
                        placeholder={t('feeding.feedAmount')}
                      />
                      <button
                        type="button"
                        disabled={!pond.suggested_feed_g}
                        onClick={() =>
                          updateDraft(draft.unitId, {
                            feedG: pond.suggested_feed_g ? String(Math.round(pond.suggested_feed_g)) : '',
                            status: 'suggested_confirmed',
                          })
                        }
                        className={buttonClassName}
                      >
                        {t('feeding.useSuggestion')}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft(draft.unitId, { feedG: '', status: 'skipped' })}
                        className={buttonClassName}
                      >
                        {t('common.skip')}
                      </button>
                    </div>
                  </div>
                  {warning ? <p className="mt-2 text-xs font-medium text-amber-700">{t('feeding.rangeWarning')}</p> : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t('feeding.missingTitle')}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{t('feeding.missingDesc')}</p>
        </div>
        {page?.missing_items.length ? (
          <div className="space-y-2">
            {page.missing_items.slice(0, 8).map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-[var(--color-text)]">{item.pond_name} - {sessionName(item.session_label)}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatDate(item.date)} - {item.fish_species ?? t('common.fish')}</p>
                </div>
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {item.suggested_feed_g ? `${formatNumber(Math.round(item.suggested_feed_g))} g` : t('feeding.estimated')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={t('attention.emptyTitle')} description={t('attention.emptyDesc')} />
        )}
      </section>
    </div>
  )
}
