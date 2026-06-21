/** Return Tailwind class name for a PCI label */
export function pciClass(label) {
  const map = {
    CRITICAL: 'badge-critical',
    HIGH:     'badge-high',
    MEDIUM:   'badge-medium',
    LOW:      'badge-low',
  }
  return map[label?.toUpperCase()] || 'badge-unknown'
}

/** Return hex colour for a PCI label */
export function pciColor(label) {
  const map = {
    CRITICAL: '#ef4444',
    HIGH:     '#f97316',
    MEDIUM:   '#eab308',
    LOW:      '#22c55e',
  }
  return map[label?.toUpperCase()] || '#8b949e'
}

/** Compact number formatter: 1234 → "1.2K" */
export function fmtN(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Hour to IST label */
export function hourLabel(h) {
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:00 ${ampm}`
}

/** Truncate string */
export function trunc(s, n = 30) {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}
