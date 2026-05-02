import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/auth-context'
import { useAppData } from '../app/app-data-context'
import { useToast } from '../feedback/toast-provider'
import { usePersistentState } from '../../lib/local-storage'
import { getStoredLanguage, setStoredLanguage, translate } from '../../lib/i18n'
import { updateProfile } from '../../lib/api'
import { isSupabaseConfigured } from '../../lib/supabase'
import { DangerConfirmModal } from '../shared/danger-confirm-modal'

const fieldClassName =
  'h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] disabled:bg-[var(--color-surface-muted)] disabled:text-[var(--color-text-muted)]'

const dividerClassName = 'border-t border-[var(--color-border)] pt-5'

const Toggle = ({
  checked,
  onChange,
  disabled = false,
  emoji = false,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  emoji?: boolean
}) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    aria-pressed={checked}
    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition ${
      checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-muted)]'
    } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
  >
    <span
      className={`relative z-10 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] shadow-sm transition ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    >
      {emoji ? (checked ? '🌙' : '☀️') : null}
    </span>
  </button>
)

const SettingsRow = ({
  label,
  hint,
  action,
}: {
  label: string
  hint: string
  action: React.ReactNode
}) => (
  <div className="flex items-start justify-between gap-4 py-3">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-[var(--color-text)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
    </div>
    <div className="flex shrink-0 items-center justify-end pt-0.5">{action}</div>
  </div>
)

export const SettingsPage = () => {
  const auth = useAuth()
  const appData = useAppData()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [language, setLanguage] = useState(getStoredLanguage(auth.profile?.language ?? 'id'))
  const [telegramId, setTelegramId] = useState(auth.profile?.telegramId ?? '')
  const [guidedTutorial, setGuidedTutorial] = usePersistentState('kanikan-guided-tutorial', true)
  const [darkMode, setDarkMode] = usePersistentState('kanikan-dark-mode', false)
  const [saved, setSaved] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    document.documentElement.dataset.tutorialMode = guidedTutorial ? 'enabled' : 'disabled'
  }, [guidedTutorial])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const saveProfile = async () => {
    const previousLanguage = getStoredLanguage(auth.profile?.language ?? 'id')
    setIsSaving(true)
    setIsEditingProfile(false)
    setStoredLanguage(language)
    appData.updateCurrentProfile(language, telegramId)
    try {
      if (isSupabaseConfigured) {
        await updateProfile({ language, telegramId })
        await queryClient.invalidateQueries({ queryKey: ['read-api', 'profile-me'] })
      }
      setSaved(true)
      showToast(
        language !== previousLanguage
          ? language === 'en'
            ? 'Language changed'
            : 'Bahasa diubah'
          : t('settings.profileUpdated'),
        'success',
        language !== previousLanguage
          ? language === 'en'
            ? 'The web app is now using English.'
            : 'Web app sekarang menggunakan Bahasa Indonesia.'
          : undefined,
      )
      window.setTimeout(() => setSaved(false), 1600)
    } catch {
      setTelegramId(auth.profile?.telegramId ?? telegramId)
      showToast(
        language !== previousLanguage
          ? language === 'en'
            ? 'Language changed locally'
            : 'Bahasa diubah lokal'
          : t('settings.couldNotSave'),
        language !== previousLanguage ? 'info' : 'error',
        language !== previousLanguage
          ? language === 'en'
            ? 'Supabase profile sync failed, but this device will keep English.'
            : 'Sync profile Supabase gagal, tapi device ini tetap memakai Bahasa Indonesia.'
          : undefined,
      )
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (isEditingProfile || isSaving) return
    setTelegramId(auth.profile?.telegramId ?? '')
  }, [auth.profile?.telegramId, isEditingProfile, isSaving])

  useEffect(() => {
    if (isEditingProfile || isSaving) return
    setLanguage(getStoredLanguage(auth.profile?.language ?? 'id'))
    setTelegramId(auth.profile?.telegramId ?? '')
  }, [auth.profile?.id])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">{t('settings.title')}</h1>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--color-text)]">{t('settings.profile')}</h2>
        </div>

        <div className="border-t border-[var(--color-border)] pt-4">
          <div className="grid max-w-[860px] gap-3 md:grid-cols-2">
            <label className="max-w-[400px] space-y-1.5">
              <span className="text-sm font-medium text-[var(--color-text)]">{t('settings.name')}</span>
              <input value={auth.profile?.fullName ?? ''} readOnly disabled className={fieldClassName} />
            </label>
            <label className="max-w-[400px] space-y-1.5">
              <span className="text-sm font-medium text-[var(--color-text)]">{t('settings.email')}</span>
              <input value={auth.profile?.email ?? ''} readOnly disabled className={fieldClassName} />
            </label>
            <label className="max-w-[400px] space-y-1.5">
              <span className="text-sm font-medium text-[var(--color-text)]">{t('settings.role')}</span>
              <input value={auth.profile?.role ?? ''} readOnly disabled className={fieldClassName} />
            </label>
            <label className="max-w-[400px] space-y-1.5">
              <span className="text-sm font-medium text-[var(--color-text)]">{t('settings.language')}</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as 'id' | 'en')}
                disabled={!isEditingProfile}
                className={fieldClassName}
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="max-w-[400px] space-y-1.5">
              <span className="text-sm font-medium text-[var(--color-text)]">{t('settings.telegramId')}</span>
              <input
                value={telegramId}
                onChange={(event) => setTelegramId(event.target.value)}
                disabled={!isEditingProfile}
                className={fieldClassName}
                placeholder={t('settings.telegramPlaceholder')}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!isEditingProfile ? (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-[var(--color-primary-strong)] active:scale-95"
              >
                {t('settings.updateProfile')}
              </button>
            ) : (
              <button
                type="button"
                onClick={saveProfile}
                disabled={isSaving}
                className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-[var(--color-primary-strong)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? t('settings.saving') : t('settings.saveProfile')}
              </button>
            )}
            {isEditingProfile ? (
              <button
                type="button"
                onClick={() => {
                  setLanguage(getStoredLanguage(auth.profile?.language ?? 'id'))
                  setTelegramId(auth.profile?.telegramId ?? '')
                  setIsEditingProfile(false)
                }}
                className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)] transition-all duration-150 hover:bg-[var(--color-surface-muted)] active:scale-95"
              >
                {t('settings.cancel')}
              </button>
            ) : null}
          </div>

          {saved ? <div className="mt-3 text-sm text-emerald-600">{t('settings.profileUpdated')}</div> : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className={dividerClassName}>
          <h2 className="text-base font-semibold text-[var(--color-text)]">{t('settings.preferences')}</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          <SettingsRow
            label={t('settings.tutorialMode')}
            hint={t('settings.tutorialHint')}
            action={<Toggle checked={guidedTutorial} onChange={() => setGuidedTutorial((value) => !value)} />}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className={dividerClassName}>
          <h2 className="text-base font-semibold text-[var(--color-text)]">{t('settings.appearance')}</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          <SettingsRow
            label={t('settings.darkMode')}
            hint={t('settings.darkModeHint')}
            action={<Toggle checked={darkMode} onChange={() => setDarkMode((value) => !value)} />}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className={dividerClassName}>
          <h2 className="text-base font-semibold text-[var(--color-text)]">{t('settings.security')}</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          <SettingsRow
            label={t('settings.resetPassword')}
            hint={t('settings.resetPasswordHint')}
            action={
              <button
                type="button"
                disabled
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text-muted)] disabled:cursor-not-allowed"
              >
                {t('settings.resetPassword')}
              </button>
            }
          />
        </div>
      </section>

      <div className="pt-2 md:hidden">
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-danger-soft)] px-4 text-sm font-semibold text-rose-700 transition-all duration-150 hover:bg-[#ffd6dc] active:scale-[0.98]"
        >
          {t('auth.logout')}
        </button>
      </div>

      <DangerConfirmModal
        open={showLogoutConfirm}
        title={t('auth.logoutTitle')}
        message={t('auth.logoutMessage')}
        detail={t('auth.logoutDetail')}
        confirmLabel={t('auth.logout')}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => void auth.signOut()}
      />
    </div>
  )
}
