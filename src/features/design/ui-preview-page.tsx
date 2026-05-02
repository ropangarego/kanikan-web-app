import type { PropsWithChildren } from 'react'
import { useState } from 'react'
import { PageSection, StatCard, StatusPill, Table } from '../shared/components'
import {
  CalendarIcon,
  CalendarModal,
  CashItem,
  InputField,
  InlineCalendarGrid,
  LoadingSkeleton,
  LoadingSummaryCard,
  LogItem,
  MainToggleCard,
  MobileBottomNav,
  NoActiveCycleState,
  NoCashRecordsState,
  NotesField,
  SearchBar,
  SearchField,
  SegmentedCashControl,
  StepSelector,
  StockItem,
} from './ui-showcase-components'

const sections = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'selection-controls', label: 'Selection Controls' },
  { id: 'list-items', label: 'List Items' },
  { id: 'empty-states', label: 'Empty States' },
  { id: 'loading-states', label: 'Loading States' },
  { id: 'search-and-fields', label: 'Search & Fields' },
  { id: 'date-pickers', label: 'Date Pickers' },
  { id: 'mobile-patterns', label: 'Mobile Patterns' },
  { id: 'page-templates', label: 'Page Templates' },
]

const colorTokens = [
  { label: 'Primary', value: '#3B82F6', className: 'bg-[#3B82F6] text-white' },
  { label: 'Primary Soft', value: '#DBEAFE', className: 'bg-[#DBEAFE] text-[#1E293B]' },
  { label: 'Text', value: '#1E293B', className: 'bg-[#1E293B] text-white' },
  { label: 'Background', value: '#F8FAFC', className: 'bg-[#F8FAFC] text-[#1E293B] border border-[var(--color-border)]' },
  { label: 'Surface', value: '#FFFFFF', className: 'bg-white text-[#1E293B] border border-[var(--color-border)]' },
  { label: 'Border', value: '#E2E8F0', className: 'bg-[#E2E8F0] text-[#1E293B]' },
]

const ColorSwatch = ({ label, value, className }: { label: string; value: string; className: string }) => (
  <div className={`rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-soft)] ${className}`}>
    <p className="text-sm font-semibold">{label}</p>
    <p className="mt-6 text-xs opacity-80">{value}</p>
  </div>
)

const DocCard = ({
  title,
  description,
  children,
}: PropsWithChildren<{
  title: string
  description: string
}>) => (
  <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
    <div className="mb-4 space-y-1">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>
    </div>
    {children}
  </div>
)

export const UiPreviewPage = () => {
  const [cashType, setCashType] = useState<'masuk' | 'keluar'>('masuk')
  const [selectedDate, setSelectedDate] = useState('2026-04-22')
  const [dateModalOpen, setDateModalOpen] = useState(false)

  return (
    <>
      <div className="space-y-6">
        <PageSection
          title="UI Components"
          subtitle="Katalog ini hanya berisi komponen yang kamu minta dari file referensi, lalu sudah saya sesuaikan ke style KANIKAN biar gampang dipilih satu-satu."
          action={<StatusPill tone="brand">Docs mode</StatusPill>}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-primary)]">Sumber</p>
              <p className="mt-2 text-sm text-[var(--color-text)]">Komponen diambil dari referensi V1, lalu dirapikan ke token biru, radius kecil, dan density medium.</p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-primary)]">Isi katalog</p>
              <p className="mt-2 text-sm text-[var(--color-text)]">Toggle, selector, list item, empty state, loading, field, date picker, dan mobile bottom nav.</p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-primary)]">Catatan</p>
              <p className="mt-2 text-sm text-[var(--color-text)]">Mock login form sudah dihapus dari halaman ini supaya fokusnya benar-benar ke library komponen.</p>
            </div>
          </div>
        </PageSection>

        <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-primary)]">On This Page</p>
              <nav className="mt-4 space-y-1">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block rounded-[var(--radius-control)] px-3 py-2 text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
                  >
                    {section.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <div className="space-y-6">
            <PageSection
              title="Foundations"
              subtitle="Panduan warna dan tipografi dasar supaya arah visualnya stabil sebelum dipakai ke halaman produksi."
              action={<div id="foundations" className="h-0" />}
            >
              <div className="space-y-4">
                <DocCard title="Color Guide" description="Palet utama yang sekarang kita pakai di app: biru sebagai aksen, slate untuk teks, dan netral terang untuk surface.">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {colorTokens.map((item) => (
                      <ColorSwatch key={item.label} label={item.label} value={item.value} className={item.className} />
                    ))}
                  </div>
                </DocCard>

                <DocCard title="Typography" description="Sans-serif, angka penting dibuat tegas, dan label kecil tetap mudah dibaca untuk konteks operasional.">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-primary)]">Eyebrow / breadcrumb</p>
                      <p className="text-sm font-medium text-[var(--color-text-muted)]">Pages / Dashboard</p>
                      <h3 className="text-3xl font-semibold text-[var(--color-text)]">Dashboard</h3>
                      <p className="max-w-xl text-sm leading-6 text-[var(--color-text-muted)]">
                        Dipakai untuk heading halaman, helper text, dan ringkasan pendek di atas section utama.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <StatCard label="Angka utama" value="Rp 12.450.000" helper="Saldo kas berjalan" />
                      <StatCard label="Sub metric" value="1.280" helper="Ekor hidup" />
                      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                        <p className="text-sm text-[var(--color-text-muted)]">Body text</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--color-text)]">
                          Teks isi normal dipakai untuk deskripsi operasional, helper form, dan catatan singkat.
                        </p>
                      </div>
                      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                        <p className="text-sm text-[var(--color-text-muted)]">Label kecil</p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-primary)]">KANIKAN UI</p>
                      </div>
                    </div>
                  </div>
                </DocCard>
              </div>
            </PageSection>

            <PageSection
              title="Selection Controls"
              subtitle="Pilihan komponen untuk menentukan tipe kas atau step utama dalam form."
              action={<div id="selection-controls" className="h-0" />}
            >
              <div className="grid gap-4 xl:grid-cols-3">
                <DocCard
                  title="Main Toggle Card"
                  description="Versi utama untuk pilihan yang perlu penjelasan singkat dan bobot visual lebih kuat."
                >
                  <div className="space-y-3">
                    <MainToggleCard
                      title="Masuk"
                      description="Uang masuk ke kas dari penjualan, top up modal, atau setoran lain."
                      selected={cashType === 'masuk'}
                      tone="success"
                      onClick={() => setCashType('masuk')}
                    />
                    <MainToggleCard
                      title="Keluar"
                      description="Pengeluaran operasional seperti pakan, listrik, transport, atau obat."
                      selected={cashType === 'keluar'}
                      tone="danger"
                      onClick={() => setCashType('keluar')}
                    />
                  </div>
                </DocCard>

                <DocCard
                  title="Segmented Control Tipe Kas"
                  description="Pilihan ringkas kalau ruangnya terbatas, tapi tetap perlu toggle cepat."
                >
                  <SegmentedCashControl value={cashType} onChange={setCashType} />
                </DocCard>

                <DocCard
                  title="Step Selector"
                  description="Cocok untuk onboarding action atau form bertahap yang perlu konteks lebih jelas."
                >
                  <div className="space-y-3">
                    <StepSelector
                      title="Add Income"
                      description="Use this when money comes in from sales or new capital."
                      selected={cashType === 'masuk'}
                      onClick={() => setCashType('masuk')}
                    />
                    <StepSelector
                      title="Record Expense"
                      description="Use this when paying for feed, electricity, transport, or supplies."
                      selected={cashType === 'keluar'}
                      onClick={() => setCashType('keluar')}
                    />
                  </div>
                </DocCard>
              </div>
            </PageSection>

            <PageSection
              title="List Items"
              subtitle="Komponen item untuk log, stok, dan arus kas, semua dibuat card-based agar cepat dipindai."
              action={<div id="list-items" className="h-0" />}
            >
              <div className="grid gap-4 xl:grid-cols-3">
                <DocCard title="Log Item" description="Item standar untuk activity list pada log harian.">
                  <LogItem date="20 Apr" title="Feed 2.000 g" description="Water agak keruh - added probiotic" />
                </DocCard>
                <DocCard title="Stock Item" description="Dipakai untuk mutasi stok seperti tebar, panen, mati, atau pindah.">
                  <StockItem date="19 Apr" type="Death" count="12 ekor" note="After heavy rain" />
                </DocCard>
                <DocCard title="Cash Item" description="Versi bersih untuk arus kas yang tetap enak dipakai di desktop dan mobile.">
                  <CashItem date="18 Apr" title="Penjualan Kolam A1" type="Masuk" amount="Rp 1.782.000" category="Penjualan" />
                </DocCard>
              </div>
            </PageSection>

            <PageSection
              title="Empty States"
              subtitle="Dua empty state penting yang akan sering muncul di halaman kolam dan arus kas."
              action={<div id="empty-states" className="h-0" />}
            >
              <div className="grid gap-4 xl:grid-cols-2">
                <DocCard title="No Active Cycle" description="State kosong untuk detail kolam yang belum punya siklus aktif.">
                  <NoActiveCycleState />
                </DocCard>
                <DocCard title="No Cash Records Yet" description="State kosong untuk halaman atau section arus kas yang belum memiliki transaksi.">
                  <NoCashRecordsState />
                </DocCard>
              </div>
            </PageSection>

            <PageSection
              title="Loading States"
              subtitle="Loading card untuk ringkasan, dan skeleton untuk area yang lebih tabular."
              action={<div id="loading-states" className="h-0" />}
            >
              <div className="grid gap-4 xl:grid-cols-2">
                <DocCard title="Loading Summary" description="Dipakai untuk summary card atau panel ringkasan.">
                  <LoadingSummaryCard />
                </DocCard>
                <DocCard title="Loading Skeleton" description="Cocok untuk section list atau table yang masih loading.">
                  <LoadingSkeleton />
                </DocCard>
              </div>
            </PageSection>

            <PageSection
              title="Search & Fields"
              subtitle="Field dasar yang bisa dipakai di halaman list, form input, dan note singkat."
              action={<div id="search-and-fields" className="h-0" />}
            >
              <div className="space-y-4">
                <DocCard title="Search Bar" description="Versi lengkap dengan field pencarian dan dua trigger filter.">
                  <SearchBar />
                </DocCard>

                <div className="grid gap-4 xl:grid-cols-2">
                  <DocCard title="Search Field" description="Versi minimal untuk area yang hanya butuh input pencarian.">
                    <SearchField />
                  </DocCard>
                  <DocCard title="Input Field" description="Field dasar untuk text, angka, atau trigger selector.">
                    <div className="space-y-4">
                      <InputField label="Nama Kolam" placeholder="Contoh: Kolam A1" helperText="Use a short and clear name." />
                      <InputField label="Tanggal Mulai" placeholder={selectedDate} helperText="Tap untuk buka date picker." trailing={<CalendarIcon className="h-4 w-4 text-[var(--color-text-muted)]" />} onClick={() => setDateModalOpen(true)} readOnly />
                    </div>
                  </DocCard>
                </div>

                <DocCard title="Notes" description="Textarea sederhana untuk catatan tambahan atau observasi harian.">
                  <NotesField label="Notes" placeholder="Optional notes..." helperText="Keep it short for V1." />
                </DocCard>
              </div>
            </PageSection>

            <PageSection
              title="Date Pickers"
              subtitle="Dua pola tanggal yang kamu minta: inline calendar grid dan modal calendar."
              action={<div id="date-pickers" className="h-0" />}
            >
              <div className="grid gap-4 xl:grid-cols-2">
                <DocCard title="Inline Calendar Grid" description="Cocok untuk desktop atau area filter yang ingin langsung terlihat.">
                  <InlineCalendarGrid value={selectedDate} onChange={setSelectedDate} />
                </DocCard>
                <DocCard title="Modal Calendar" description="Pola utama untuk mobile dan form input dengan ruang terbatas.">
                  <div className="space-y-4">
                    <InputField
                      label="Tanggal"
                      placeholder={selectedDate}
                      helperText="Open custom calendar modal."
                      trailing={<CalendarIcon className="h-4 w-4 text-[var(--color-text-muted)]" />}
                      onClick={() => setDateModalOpen(true)}
                      readOnly
                    />
                    <button
                      type="button"
                      onClick={() => setDateModalOpen(true)}
                      className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white"
                    >
                      Open Modal Calendar
                    </button>
                  </div>
                </DocCard>
              </div>
            </PageSection>

            <PageSection
              title="Mobile Patterns"
              subtitle="Bottom navigation mobile dengan outline icon dan active state sederhana tanpa kapsul biru."
              action={<div id="mobile-patterns" className="h-0" />}
            >
              <DocCard title="Nav Bottom Mobile" description="Pola ini mengikuti keputusan kita: clean, mudah dijangkau jempol, dan active state hanya lewat warna icon serta label.">
                <div className="mx-auto max-w-sm rounded-[26px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                  <MobileBottomNav />
                </div>
              </DocCard>
            </PageSection>

            <PageSection
              title="Page Templates"
              subtitle="Template layout untuk halaman data seperti master data, jadi nanti lebih gampang dijadikan base page."
              action={<div id="page-templates" className="h-0" />}
            >
              <DocCard title="Template Page" description="Contoh halaman data-management dengan breadcrumb di luar card content, header page di atas, lalu panel isi di bawahnya.">
                <div className="space-y-4 rounded-[var(--radius-shell)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                      <span>Pages</span>
                      <span>/</span>
                      <span>Master Data</span>
                      <span>/</span>
                      <span className="font-semibold text-[var(--color-text)]">Template</span>
                    </div>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                      <div>
                        <h3 className="text-2xl font-semibold text-[var(--color-text)]">Master Data Template</h3>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Gunakan pola ini untuk halaman data, pengaturan, atau daftar referensi.</p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white"
                      >
                        Tambah Data
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
                    <div className="space-y-4">
                      <SearchBar />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <StatCard label="Total item" value="24" helper="Semua data aktif" />
                        <StatCard label="Butuh review" value="3" helper="Perlu update" />
                        <StatCard label="Terakhir diubah" value="Hari ini" helper="09:24 WIB" />
                      </div>
                      <Table
                        headers={['Nama', 'Kategori', 'Status', 'Update']}
                        rows={[
                          ['Pakan Starter', 'Inventaris', <StatusPill key="aktif-1" tone="brand">Aktif</StatusPill>, 'Hari ini'],
                          ['Kolam A1', 'Kolam', <StatusPill key="aktif-2" tone="success">Siap</StatusPill>, 'Kemarin'],
                          ['Supplier Utama', 'Relasi', <StatusPill key="review" tone="warning">Review</StatusPill>, '18 Apr'],
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </DocCard>
            </PageSection>
          </div>
        </div>
      </div>

      <CalendarModal
        open={dateModalOpen}
        title="Pilih Tanggal"
        value={selectedDate}
        onClose={() => setDateModalOpen(false)}
        onChange={setSelectedDate}
        onConfirm={() => setDateModalOpen(false)}
      />
    </>
  )
}
