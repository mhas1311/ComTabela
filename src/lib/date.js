/**
 * Utilitários de data sem desvio de fuso horário (UTC vs horário local).
 */

const pad2 = (n) => String(n).padStart(2, '0')

export function todayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function currentMonthISO() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

export function parseLocalDate(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return null
  const clean = isoDate.slice(0, 10)
  const parts = clean.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null
  const [year, month, day] = parts
  return new Date(year, month - 1, day, 12, 0, 0)
}

export function formatDateBR(isoDate) {
  const parsed = parseLocalDate(isoDate)
  if (!parsed) return '-'
  return parsed.toLocaleDateString('pt-BR')
}

export function formatMonthShortBR(yyyyMm) {
  if (!yyyyMm || typeof yyyyMm !== 'string') return ''
  const [year, month] = yyyyMm.split('-').map(Number)
  if (!year || !month) return yyyyMm
  const date = new Date(year, month - 1, 15, 12, 0, 0)
  const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  return label.replace('.', '')
}

export function formatMonthFullBR(yyyyMm) {
  if (!yyyyMm || typeof yyyyMm !== 'string') return ''
  const [year, month] = yyyyMm.split('-').map(Number)
  if (!year || !month) return yyyyMm
  const date = new Date(year, month - 1, 15, 12, 0, 0)
  const formatted = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function getRecentMonthsISO(anchorMonthISO, count = 6) {
  const base = anchorMonthISO || currentMonthISO()
  const [year, month] = base.split('-').map(Number)
  const result = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const d = new Date(year, month - 1 - offset, 15, 12, 0, 0)
    result.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
  }
  return result
}

export function addMonthsISO(isoDate, monthsToAdd) {
  const parsed = parseLocalDate(isoDate) || parseLocalDate(todayISO())
  const year = parsed.getFullYear()
  const month = parsed.getMonth()
  const day = parsed.getDate()

  const targetMonthDate = new Date(year, month + monthsToAdd, 1, 12, 0, 0)
  const maxDayInTargetMonth = new Date(
    targetMonthDate.getFullYear(),
    targetMonthDate.getMonth() + 1,
    0,
    12,
    0,
    0
  ).getDate()

  const clampedDay = Math.min(day, maxDayInTargetMonth)
  return `${targetMonthDate.getFullYear()}-${pad2(targetMonthDate.getMonth() + 1)}-${pad2(clampedDay)}`
}
