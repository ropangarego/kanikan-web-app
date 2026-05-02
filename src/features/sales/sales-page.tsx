import { Link } from 'react-router-dom'
import { PageSection } from '../shared/components'

export const SalesPage = () => {
  return (
    <div className="space-y-6">
      <PageSection title="Sales" subtitle="Sales CRUD is parked for V2 so V1 stock and cash flows stay clean.">
        <div className="max-w-2xl space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            Sales is intentionally disabled in V1. For now, keep operational records in pond detail,
            stock movements, and cash ledger. This prevents a half-wired sale from changing cash or
            stock incorrectly.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            V2 scope: sale form, sold-count estimation, stock reduction, buyer history, and automatic
            cash-in integration.
          </div>
          <Link
            to="/ponds"
            className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Go to ponds
          </Link>
        </div>
      </PageSection>
    </div>
  )
}
