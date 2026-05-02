import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../features/layout/app-shell'
import { useAuth } from '../features/auth/auth-context'
import { LoginPage } from '../features/auth/login-page'
import { translate, useAppLanguage } from '../lib/i18n'

const DashboardPage = lazy(async () => import('../features/dashboard/dashboard-page').then((module) => ({ default: module.DashboardPage })))
const AttentionPage = lazy(async () => import('../features/attention/attention-page').then((module) => ({ default: module.AttentionPage })))
const PondsPage = lazy(async () => import('../features/ponds/ponds-page').then((module) => ({ default: module.PondsPage })))
const PondDetailPage = lazy(async () => import('../features/ponds/pond-detail-page').then((module) => ({ default: module.PondDetailPage })))
const CyclesPage = lazy(async () => import('../features/cycles/cycles-page').then((module) => ({ default: module.CyclesPage })))
const CycleDetailPage = lazy(async () => import('../features/cycles/cycle-detail-page').then((module) => ({ default: module.CycleDetailPage })))
const DailyLogsPage = lazy(async () => import('../features/daily-logs/daily-logs-page').then((module) => ({ default: module.DailyLogsPage })))
const StockMovementsPage = lazy(async () => import('../features/stock-movements/stock-movements-page').then((module) => ({ default: module.StockMovementsPage })))
const SalesPage = lazy(async () => import('../features/sales/sales-page').then((module) => ({ default: module.SalesPage })))
const CashPage = lazy(async () => import('../features/cash/cash-page').then((module) => ({ default: module.CashPage })))
const SettingsPage = lazy(async () => import('../features/settings/settings-page').then((module) => ({ default: module.SettingsPage })))
const SimplePlaceholderPage = lazy(async () => import('../features/placeholders/simple-placeholder-page').then((module) => ({ default: module.SimplePlaceholderPage })))
const UiPreviewPage = lazy(async () => import('../features/design/ui-preview-page').then((module) => ({ default: module.UiPreviewPage })))

const PageLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" aria-label="Loading" />
  </div>
)

const ProtectedLayout = () => {
  const auth = useAuth()
  const language = useAppLanguage(auth.profile?.language)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)
  if (!auth.isAuthenticated) return <Navigate to="/login" replace />
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="attention" element={<AttentionPage />} />
          <Route path="ponds" element={<PondsPage />} />
          <Route path="ponds/:pondId" element={<PondDetailPage />} />
          <Route path="cycles" element={<CyclesPage />} />
          <Route path="cycles/:cycleId" element={<CycleDetailPage />} />
          <Route path="daily-logs" element={<DailyLogsPage />} />
          <Route path="stock-movements" element={<StockMovementsPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="cash" element={<CashPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="ui-preview" element={<UiPreviewPage />} />
          <Route path="predictions" element={<SimplePlaceholderPage title={t('placeholder.predictionsTitle')} description={t('placeholder.predictionsDesc')} subtitle={t('placeholder.subtitle')} stablePath={t('placeholder.stablePath')} />} />
          <Route path="reports" element={<SimplePlaceholderPage title={t('placeholder.reportsTitle')} description={t('placeholder.reportsDesc')} subtitle={t('placeholder.subtitle')} stablePath={t('placeholder.stablePath')} />} />
          <Route path="master-data" element={<SimplePlaceholderPage title={t('placeholder.masterDataTitle')} description={t('placeholder.masterDataDesc')} subtitle={t('placeholder.subtitle')} stablePath={t('placeholder.stablePath')} />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export const AppRouter = () => {
  const auth = useAuth()

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" aria-label="Loading" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={auth.isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  )
}
