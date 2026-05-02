import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { primaryNav, secondaryNav } from './nav-config'
import { useAuth } from '../auth/auth-context'
import { usePersistentState } from '../../lib/local-storage'
import { translate, useAppLanguage } from '../../lib/i18n'
import { QuickActionModal, quickActionEventName } from './quick-action-modals'
import type { QuickActionState } from './quick-action-modals'
import { DangerConfirmModal } from '../shared/danger-confirm-modal'

type IconProps = {
  className?: string
}

const DashboardIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 13h6v7H4zM14 4h6v16h-6zM4 4h6v5H4zM4 13h6v7H4z" />
  </svg>
)

const AttentionIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 4.5 3.5 19h17L12 4.5Z" />
    <path d="M12 9v4" />
    <path d="M12 16.5h.01" />
  </svg>
)

const PondIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 15c2.2 0 2.8-1.5 5-1.5s2.8 1.5 5 1.5 2.8-1.5 5-1.5" />
    <path d="M4 18c2.2 0 2.8-1.5 5-1.5s2.8 1.5 5 1.5 2.8-1.5 5-1.5" />
    <path d="M7 10a5 5 0 0 1 10 0" />
  </svg>
)

const StockIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M5 7.5h14M5 12h14M5 16.5h14" />
    <path d="M7 5v14M17 5v14" />
  </svg>
)

const CashIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 7.5h16v9H4z" />
    <path d="M16 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
    <path d="M7 10h.01M17 14h.01" />
  </svg>
)

const SettingsIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1.2 1.2a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.7a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1.2-1.2a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.7a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1.2-1.2a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.7a1 1 0 0 1 1 1v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1 1 0 0 1 1 1v1.7a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.7Z" />
  </svg>
)

const ComponentsIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
)

const SignOutIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M9 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H9" />
    <path d="M13 8.5 17.5 12 13 15.5" />
    <path d="M10 12h7.5" />
  </svg>
)

const ChevronLeftIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="m15 18-6-6 6-6" />
  </svg>
)

const ChevronRightIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="m9 18 6-6-6-6" />
  </svg>
)

const PlusIcon = ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const navIcons: Record<string, (props: IconProps) => ReactNode> = {
  '/': DashboardIcon,
  '/attention': AttentionIcon,
  '/ponds': PondIcon,
  '/stock-movements': StockIcon,
  '/cash': CashIcon,
  '/settings': SettingsIcon,
  '/ui-preview': ComponentsIcon,
}

const desktopNavClassName = ({ isActive }: { isActive: boolean;}) =>
  `group flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border-l-[5px] px-3 text-sm font-medium transition ${
    isActive
      ? `border-[var(--color-primary)] bg-white`
      : 'border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'
  }`

const mobileNavClassName = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-1 text-center transition-all duration-150 ${
    isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
  }`

export const AppShell = () => {
  const auth = useAuth()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [quickAction, setQuickAction] = useState<QuickActionState | null>(null)
  const [guidedTutorial] = usePersistentState('kanikan-guided-tutorial', true)
  const [darkMode] = usePersistentState('kanikan-dark-mode', false)
  const language = useAppLanguage(auth.profile?.language)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isActionPage = useMemo(
    () => ['/', '/ponds', '/stock-movements', '/cash'].includes(location.pathname),
    [location.pathname],
  )

  useEffect(() => {
    document.documentElement.dataset.tutorialMode = guidedTutorial ? 'enabled' : 'disabled'
  }, [guidedTutorial])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    const listener = (event: Event) => {
      const quickEvent = event as CustomEvent<QuickActionState>
      setQuickAction(quickEvent.detail)
      setShowQuickActions(false)
    }

    window.addEventListener(quickActionEventName, listener)
    return () => window.removeEventListener(quickActionEventName, listener)
  }, [])

  const handleQuickAction = (action: QuickActionState) => {
    setShowQuickActions(false)
    setQuickAction(action)
  }

  const mobileNav = [
    { to: '/', label: t('nav.dashboard'), icon: DashboardIcon },
    { to: '/ponds', label: t('nav.ponds'), icon: PondIcon },
    { to: '/stock-movements', label: t('nav.stock'), icon: StockIcon },
    { to: '/cash', label: t('nav.cash'), icon: CashIcon },
    { to: '/settings', label: t('nav.settings'), icon: SettingsIcon },
  ]

  const isNavActive = (to: string) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  const renderMenuLabel = (label: string) =>
    !sidebarCollapsed ? (
      <span className="truncate">{label}</span>
    ) : guidedTutorial ? (
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    ) : null

  const getNavLabel = (to: string, fallback: string) => {
    if (to === '/') return t('nav.dashboard')
    if (to === '/ponds') return t('nav.ponds')
    if (to === '/stock-movements') return t('nav.stock')
    if (to === '/cash') return t('nav.cash')
    if (to === '/settings') return t('nav.settings')
    if (to === '/ui-preview') return t('nav.uiPreview')
    return fallback
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden overflow-visible border-r border-[var(--color-border)] bg-white px-3 py-5 transition-[width] duration-200 ease-out md:flex md:flex-col ${
          sidebarCollapsed ? 'w-[96px]' : 'w-[210px]'
        }`}
      >
        <div className={`relative flex min-h-0 flex-1 flex-col ${sidebarCollapsed ? 'items-center' : ''}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between gap-2'}`}>
            <div className={`min-w-0 ${sidebarCollapsed ? 'flex flex-col items-center gap-2' : 'flex items-center gap-3'}`}>
              <img
                src="/logo.png"
                alt="Kanikan"
                className={sidebarCollapsed ? 'h-12 w-12 object-contain' : 'h-12 w-auto max-w-[140px] object-contain'}
              />
              {!sidebarCollapsed ? <p className="truncate text-sm font-semibold text-[var(--color-text)]">KANIKAN</p> : null}
            </div>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
            className="absolute top-6 -right-3 z-10 inline-flex h-7 w-7 translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-primary)] shadow-sm transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)] active:scale-95"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          </div>

          <nav className="mt-8 space-y-1">
            {primaryNav.map((item) => {
              const Icon = navIcons[item.to] ?? ComponentsIcon
              const isActive = isNavActive(item.to)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={() =>
                    `${desktopNavClassName({ isActive })} ${sidebarCollapsed ? 'flex-col justify-center py-2 text-center' : ''}`
                  }
                >
                  <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-[var(--color-primary)]' : ''}`} />
                  {sidebarCollapsed ? (
                    guidedTutorial ? (
                      <span className={`text-[10px] font-medium leading-tight ${isActive ? 'text-[var(--color-primary)]' : ''}`}>
                        {getNavLabel(item.to, item.label)}
                      </span>
                    ) : null
                  ) : (
                    <span className={`truncate ${isActive ? 'text-[var(--color-primary)]' : ''}`}>{getNavLabel(item.to, item.label)}</span>
                  )}
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-8 border-t border-[var(--color-border)] pt-5">
            {!sidebarCollapsed ? (
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
                {t('nav.preview')}
              </p>
            ) : null}
            <nav className="space-y-1">
              {secondaryNav.map((item) => {
                const Icon = navIcons[item.to] ?? ComponentsIcon
                const isActive = isNavActive(item.to)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={() =>
                      `${desktopNavClassName({ isActive })} ${sidebarCollapsed ? 'flex-col justify-center py-2 text-center' : ''}`
                    }
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-[var(--color-primary)]' : ''}`} />
                    {sidebarCollapsed ? (
                      guidedTutorial ? (
                        <span className={`text-[10px] font-medium leading-tight ${isActive ? 'text-[var(--color-primary)]' : ''}`}>
                          {getNavLabel(item.to, item.label)}
                        </span>
                      ) : null
                    ) : (
                      <span className={`truncate ${isActive ? 'text-[var(--color-primary)]' : ''}`}>{getNavLabel(item.to, item.label)}</span>
                    )}
                  </NavLink>
                )
              })}
            </nav>

            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className={`mt-3 flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border-l-4 border-transparent px-3 text-sm font-medium text-rose-700 transition hover:bg-[var(--color-danger-soft)] ${
                sidebarCollapsed ? 'flex-col justify-center py-2 text-center' : ''
              }`}
            >
              <SignOutIcon className="h-5 w-5 shrink-0" />
              {renderMenuLabel(t('auth.logout'))}
            </button>
          </div>

        </div>
      </aside>

      <div className={`flex min-h-screen min-w-0 flex-col transition-[margin-left] duration-200 ease-out ${sidebarCollapsed ? 'md:ml-[96px]' : 'md:ml-[220px]'}`}>
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 pb-28 sm:px-6 md:px-8 md:py-6 md:pb-8">
          <div className="mx-auto min-w-0 w-full max-w-[1280px]">
            <Outlet />
          </div>
        </main>

        {isActionPage ? (
          <div className="pointer-events-none fixed bottom-24 right-4 z-30 md:bottom-6 md:right-6">
            <div className="pointer-events-auto relative">
              {showQuickActions ? (
                <div className="sheet-up absolute bottom-14 right-0 flex w-56 flex-col gap-2 rounded-[var(--radius-shell)] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-strong)]">
                  <button
                    type="button"
                    onClick={() => handleQuickAction({ type: 'log' })}
                    className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-left text-sm font-medium text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-[0.98]"
                  >
                    {t('action.newLog')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAction({ type: 'stock' })}
                    className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-left text-sm font-medium text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-[0.98]"
                  >
                    {t('action.updateStock')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAction({ type: 'cash' })}
                    className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-left text-sm font-medium text-[var(--color-text)] transition-all duration-150 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] active:scale-[0.98]"
                  >
                    {t('action.addCash')}
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setShowQuickActions((value) => !value)}
                className="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-[var(--shadow-strong)] transition-all duration-150 hover:bg-[var(--color-primary-strong)] hover:shadow-[0_18px_42px_rgba(37,99,235,0.24)] active:scale-95"
                aria-label={t('action.openQuickActions')}
              >
                <PlusIcon className={`h-5 w-5 transition-transform duration-150 ${showQuickActions ? 'rotate-45' : ''}`} />
              </button>
            </div>
          </div>
        ) : null}

        <nav className="fixed inset-x-0 bottom-0 z-20 px-0 pb-0 pt-2 md:hidden">
          <div className="mx-auto max-w-md rounded-t-[18px] border border-b-0 border-[var(--color-border)] bg-white px-3 py-3 shadow-[0_-10px_26px_rgba(15,23,42,0.08)]">
            <div className="grid grid-cols-5 gap-1">
              {mobileNav.map((item) => {
                const Icon = item.icon
                const isActive = isNavActive(item.to)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={scrollToTop}
                    className={() => mobileNavClassName({ isActive })}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`text-[11px] font-medium leading-tight ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                      {item.label}
                    </span>
                  </NavLink>
                )
              })}
            </div>
          </div>
        </nav>
      </div>

      {showQuickActions ? (
        <button
          type="button"
          onClick={() => setShowQuickActions(false)}
          className="overlay-fade fixed inset-0 z-20 bg-slate-950/10"
          aria-label={t('action.closeQuickActions')}
        />
      ) : null}

      <DangerConfirmModal
        open={showLogoutConfirm}
        title={t('auth.logoutTitle')}
        message={t('auth.logoutMessage')}
        detail={t('auth.logoutDetail')}
        confirmLabel={t('auth.logout')}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => void auth.signOut()}
      />

      <QuickActionModal action={quickAction} onClose={() => setQuickAction(null)} />
    </div>
  )
}
