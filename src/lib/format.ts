export const formatNumber = (value: number) =>
  new Intl.NumberFormat('id-ID').format(value)

export const formatRupiah = (value: number) =>
  `Rp ${new Intl.NumberFormat('id-ID').format(value)}`

export const formatWeight = (grams: number | null) => {
  if (grams === null) return '-'
  if (grams >= 1000) return `${formatNumber(Number((grams / 1000).toFixed(1)))} kg`
  return `${formatNumber(grams)} g`
}

export const formatWeightPerFish = (grams: number | null, unit = 'ekor') => {
  const weight = formatWeight(grams)
  return weight === '-' ? '-' : `${weight}/${unit}`
}

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

export const formatRelativeFromNow = (value: string) => {
  const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} jam yang lalu`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} hari yang lalu`
}

export const formatRelativeShortDate = (value: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value))
