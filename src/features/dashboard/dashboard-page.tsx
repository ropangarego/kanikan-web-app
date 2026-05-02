import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDashboardSummaryQuery, useStockMovementsQuery } from '../../lib/api'
import { formatNumber, formatRupiah, formatWeightPerFish } from '../../lib/format'
import { translate, useAppLanguage } from '../../lib/i18n'
import { getCycleMovementTotals, getLatestSampleWeight } from '../../lib/stock'
import { useAppData } from '../app/app-data-context'
import { useAuth } from '../auth/auth-context'
import { StatusPill, Table } from '../shared/components'

const SummaryMetricCard = ({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) => (
  <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4">
    <div className="flex items-center gap-1.5">
      <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
    </div>
    <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{value}</p>
    <p className="mt-2 text-xs text-[var(--color-text-muted)]">{helper}</p>
  </div>
)

const SectionCard = ({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) => (
  <section className="border-t border-[var(--color-border)] pt-5">
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
    </div>
    {children}
  </section>
)

const getToday = () => new Date().toISOString().slice(0, 10)
const getDayDiff = (date: string) => Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
const formatPercent = (value: number) => `${value.toFixed(value < 10 ? 1 : 0)}%`

export const DashboardPage = () => {
  const appData = useAppData()
  const auth = useAuth()
  const language = useAppLanguage(auth.profile?.language)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)
  const dashboardQuery = useDashboardSummaryQuery()
  const stockOverviewQuery = useStockMovementsQuery({ period: 'all', limit: 1 })
  const apiDashboard = dashboardQuery.data
  const today = getToday()
  const currentMonth = today.slice(0, 7)
  const activeCycles = appData.snapshot.cycles.filter((cycle) => cycle.dateEnd === null)
  const activePonds = activeCycles.length

  const feedToday = appData.snapshot.dailyLogs
    .filter((log) => log.date === today)
    .reduce((sum, log) => sum + log.feedG, 0)

  const baselineStart = new Date()
  baselineStart.setDate(baselineStart.getDate() - 7)
  const baselineFeedLogs = appData.snapshot.dailyLogs.filter((log) => new Date(log.date) >= baselineStart)
  const dailyFeedAverage =
    baselineFeedLogs.length > 0
      ? baselineFeedLogs.reduce((sum, log) => sum + log.feedG, 0) /
        Math.max(new Set(baselineFeedLogs.map((log) => log.date)).size, 1)
      : 0
  const feedVsTarget = dailyFeedAverage > 0 ? (feedToday / dailyFeedAverage) * 100 : 0

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const deathsThisWeek = appData.snapshot.stockMovements
    .filter((movement) => movement.movementType === 'died' && new Date(movement.date) >= weekStart)
    .reduce((sum, movement) => sum + movement.count, 0)

  const liveFishTotal = activeCycles.reduce(
    (sum, cycle) => sum + Math.max(getCycleMovementTotals(cycle.id, appData.snapshot.stockMovements).alive, 0),
    0,
  )
  const mortalityRate = liveFishTotal + deathsThisWeek > 0 ? (deathsThisWeek / (liveFishTotal + deathsThisWeek)) * 100 : 0

  const activeInitialStock = activeCycles.reduce((sum, cycle) => sum + cycle.initialStock, 0)
  const survivalRate = activeInitialStock > 0 ? (liveFishTotal / activeInitialStock) * 100 : 0

  const localGrowthSeries = useMemo(() => {
    const entries = appData.snapshot.dailyLogs
      .filter((log) => log.sampleWeightG !== null)
      .reduce<Map<string, { total: number; count: number }>>((map, log) => {
        const current = map.get(log.date) ?? { total: 0, count: 0 }
        current.total += log.sampleWeightG ?? 0
        current.count += 1
        map.set(log.date, current)
        return map
      }, new Map())

    return Array.from(entries.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-14)
      .map(([date, value]) => ({
        date: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit' }).format(new Date(date)),
        avgWeight: value.total / value.count,
      }))
  }, [appData.snapshot.dailyLogs])
  const growthSeries =
    apiDashboard?.growth.points.map((point) => ({
      date: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit' }).format(new Date(point.date)),
      avgWeight: point.avg_weight_g,
    })) ?? localGrowthSeries

  const missingLogPonds = activeCycles
    .map((cycle) => appData.snapshot.ponds.find((pond) => pond.id === cycle.unitId))
    .filter((pond): pond is NonNullable<typeof pond> => Boolean(pond))
    .filter((pond) => !appData.snapshot.dailyLogs.some((log) => log.unitId === pond.id && log.date === today))

  const cyclesMissingTarget = activeCycles.filter((cycle) => cycle.targetWeightG === null)
  const staleWeightCycles = activeCycles.filter((cycle) => {
    const latestWeightLog = appData.snapshot.dailyLogs
      .filter((log) => log.cycleId === cycle.id && log.sampleWeightG !== null)
      .sort((left, right) => right.date.localeCompare(left.date))[0]
    return !latestWeightLog || getDayDiff(latestWeightLog.date) > 7
  })

  const localAttentionItems = [
    ...missingLogPonds.slice(0, 2).map((pond) => ({
      id: `missing-log-${pond.id}`,
      title: `${pond.name} needs a daily log today`,
      description: 'Open the pond and add today feed plus a short daily note.',
      tone: 'warning' as const,
      href: `/ponds?pond=${pond.id}`,
    })),
    ...(mortalityRate > 2
      ? [
          {
            id: 'high-mortality',
            title: 'Mortality this week needs review',
            description: `${formatPercent(mortalityRate)} of active stock was recorded as died this week.`,
            tone: 'danger' as const,
            href: '/stock-movements',
          },
        ]
      : []),
    ...cyclesMissingTarget.slice(0, 1).map((cycle) => ({
      id: `target-${cycle.id}`,
      title: `${appData.snapshot.ponds.find((pond) => pond.id === cycle.unitId)?.name ?? cycle.name} needs target weight`,
      description: 'Add a target weight so harvest prediction and growth review are clearer.',
      tone: 'default' as const,
      href: `/ponds?pond=${cycle.unitId}`,
    })),
    ...staleWeightCycles.slice(0, 2).map((cycle) => ({
      id: `stale-weight-${cycle.id}`,
      title: `${appData.snapshot.ponds.find((pond) => pond.id === cycle.unitId)?.name ?? cycle.name} needs a new sample weight`,
      description: 'Add a sample weight so the growth trend stays useful.',
      tone: 'warning' as const,
      href: `/ponds?pond=${cycle.unitId}`,
    })),
  ].slice(0, 5)

  const allAttentionItems = apiDashboard
    ? apiDashboard.attention_items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        tone: item.tone === 'danger' ? ('danger' as const) : item.tone === 'warning' ? ('warning' as const) : ('default' as const),
        href: item.pond_id ? `/ponds?pond=${item.pond_id}` : item.cycle_id ? `/cycles/${item.cycle_id}` : '/',
      }))
    : localAttentionItems
  const attentionItems = allAttentionItems.slice(0, 3)

  const localSalesThisMonth = appData.snapshot.sales
    .filter((sale) => sale.date.startsWith(currentMonth))
    .reduce((sum, sale) => sum + sale.totalRp, 0)
  const localExpenseThisMonth = appData.snapshot.cashEntries
    .filter((entry) => entry.type === 'Keluar' && entry.date.startsWith(currentMonth))
    .reduce((sum, entry) => sum + entry.amountRp, 0)
  const salesThisMonth = apiDashboard?.money_snapshot.sales_this_month_rp ?? localSalesThisMonth
  const expenseThisMonth = apiDashboard?.money_snapshot.expense_this_month_rp ?? localExpenseThisMonth
  const netThisMonth = apiDashboard?.money_snapshot.net_this_month_rp ?? salesThisMonth - expenseThisMonth

  const localPondRows = appData.snapshot.ponds.flatMap((pond) => {
    const cycle = appData.getCurrentCycleForPond(pond.id)
    if (!cycle) return []
    const totals = cycle ? getCycleMovementTotals(cycle.id, appData.snapshot.stockMovements) : null
    const alive = totals ? Math.max(totals.alive, 0) : 0
    const survival = cycle && cycle.initialStock > 0 ? (alive / cycle.initialStock) * 100 : 0
    const avgWeight = cycle ? getLatestSampleWeight(cycle.id, appData.snapshot.dailyLogs) : null
    const latestLog = appData.snapshot.dailyLogs
      .filter((log) => cycle && log.cycleId === cycle.id)
      .sort((left, right) => right.date.localeCompare(left.date))[0]
    const ageDays = cycle ? Math.max(getDayDiff(cycle.dateStart), 0) : 0

    let status: 'healthy' | 'needCheck' | 'problem' = 'needCheck'
    if (!cycle) {
      status = 'needCheck'
    } else if (survival < 85 || (latestLog && getDayDiff(latestLog.date) > 2)) {
      status = 'problem'
    } else if (!latestLog || !avgWeight || getDayDiff(latestLog.date) > 0) {
      status = 'needCheck'
    } else {
      status = 'healthy'
    }

    return {
      id: pond.id,
      name: pond.name,
      fish: cycle?.fishType ?? '-',
      age: cycle ? `${ageDays} ${t('dashboard.days')}` : '-',
      survival: cycle ? formatPercent(survival) : '-',
      avgWeight: cycle ? formatWeightPerFish(avgWeight, t('common.fish')) : '-',
      status,
    }
  })
  const pondRows =
    apiDashboard?.pond_overview.map((pond) => ({
      id: pond.pond_id,
      name: pond.pond_name,
      fish: pond.fish_species ?? '-',
      age: pond.days_since_stocking !== null && pond.days_since_stocking !== undefined ? `${pond.days_since_stocking} ${t('dashboard.days')}` : '-',
      survival: pond.survival_rate_pct !== null && pond.survival_rate_pct !== undefined ? formatPercent(pond.survival_rate_pct) : '-',
      avgWeight: formatWeightPerFish(pond.avg_weight_g ?? null, t('common.fish')),
      status:
        pond.status === 'healthy'
          ? ('healthy' as const)
          : pond.status === 'danger'
            ? ('problem' as const)
            : ('needCheck' as const),
    })) ?? localPondRows

  const summaryCards = apiDashboard
    ? [
        {
          label: t('dashboard.runningPonds'),
          value: formatNumber(
            stockOverviewQuery.data?.pond_cards.filter((pond) => pond.status === 'active').length ??
              apiDashboard.kpis.running_ponds,
          ),
          helper: t('dashboard.runningApiHelper'),
        },
        {
          label: t('dashboard.feedTodayVsTarget'),
          value: formatPercent(apiDashboard.kpis.feed_today_vs_target_pct),
          helper: t('dashboard.feedTodayHelper'),
        },
        {
          label: t('dashboard.survivalRate'),
          value: formatPercent(apiDashboard.kpis.survival_rate_pct),
          helper: t('dashboard.survivalHelper'),
        },
        {
          label: t('dashboard.mortalityThisWeek'),
          value: formatPercent(apiDashboard.kpis.mortality_this_week_pct),
          helper: `${formatNumber(apiDashboard.kpis.mortality_this_week_count)} ${t('common.fish')}`,
        },
      ]
    : [
      { label: t('dashboard.runningPonds'), value: formatNumber(activePonds), helper: t('dashboard.runningPondsHelper') },
      {
        label: t('dashboard.feedTodayVsTarget'),
        value: dailyFeedAverage > 0 ? formatPercent(feedVsTarget) : '-',
        helper: t('dashboard.feedLocalHelper'),
      },
      { label: t('dashboard.survivalRate'), value: formatPercent(survivalRate), helper: t('dashboard.survivalHelper') },
      { label: t('dashboard.mortalityThisWeek'), value: formatPercent(mortalityRate), helper: t('dashboard.mortalityHelper') },
    ]

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {summaryCards.map((card) => (
          <SummaryMetricCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <SectionCard title={t('dashboard.attention')} subtitle={t('dashboard.attentionSubtitle')}>
          <div className="space-y-3">
            {attentionItems.length > 0 ? (
              attentionItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 transition hover:border-[var(--color-primary)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--color-text)]">{item.title}</p>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{item.description}</p>
                    </div>
                    <StatusPill tone={item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : 'default'}>
                      {item.tone === 'danger' ? t('common.status.problem') : item.tone === 'warning' ? t('common.status.check') : t('common.status.info')}
                    </StatusPill>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 text-sm text-[var(--color-text-muted)]">
                {t('dashboard.noPriorityIssue')}
              </div>
            )}
            {allAttentionItems.length > 3 ? (
              <Link
                to="/attention"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
              >
                {t('dashboard.seeMore')}
              </Link>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title={t('dashboard.overallGrowth')} subtitle={t('dashboard.overallGrowthSubtitle')}>
          {growthSeries.length >= 2 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(value) => `${value}g`} width={46} />
                  <Tooltip formatter={(value) => `${formatNumber(Number(value))} g`} />
                  <Line type="monotone" dataKey="avgWeight" stroke="#3B82F6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-text-muted)]">
              {t('dashboard.notEnoughGrowth')}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={t('dashboard.moneySnapshot')} subtitle={t('dashboard.moneySnapshotSubtitle')}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4">
            <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.salesThisMonth')}</p>
            <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{formatRupiah(salesThisMonth)}</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4">
            <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.expenseThisMonth')}</p>
            <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{formatRupiah(expenseThisMonth)}</p>
          </div>
          <div className="col-span-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 md:col-span-1">
            <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.netProfitLoss')}</p>
            <p className={`mt-2 text-xl font-semibold ${netThisMonth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatRupiah(netThisMonth)}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('dashboard.pondOverview')} subtitle={t('dashboard.pondOverviewSubtitle')}>
        <div className="hidden md:block">
          <Table
            headers={[t('dashboard.pond'), t('dashboard.fish'), t('dashboard.stockingAge'), t('dashboard.survivalRate'), t('dashboard.avgWeight'), t('pond.status')]}
            rows={pondRows.map((row) => [
              <Link key={row.id} to={`/ponds?pond=${row.id}`} className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]">
                {row.name}
              </Link>,
              row.fish,
              row.age,
              row.survival,
              row.avgWeight,
              <StatusPill
                key={`${row.id}-status`}
                tone={row.status === 'healthy' ? 'success' : row.status === 'problem' ? 'danger' : 'warning'}
              >
                {row.status === 'healthy' ? t('common.status.healthy') : row.status === 'problem' ? t('common.status.problem') : t('common.status.needCheck')}
              </StatusPill>,
            ])}
          />
        </div>
        <div className="space-y-3 md:hidden">
          {pondRows.map((row) => (
            <Link
              key={row.id}
              to={`/ponds?pond=${row.id}`}
              className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-3 transition-all duration-150 hover:bg-[var(--color-surface-muted)] active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">{row.name}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">{row.fish}</p>
                </div>
                <StatusPill tone={row.status === 'healthy' ? 'success' : row.status === 'problem' ? 'danger' : 'warning'}>
                  {row.status === 'healthy' ? t('common.status.healthy') : row.status === 'problem' ? t('common.status.problem') : t('common.status.needCheck')}
                </StatusPill>
              </div>
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                {t('dashboard.survivalRate')}: {row.survival} | {t('dashboard.avgWeight')}: {row.avgWeight}
              </p>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
