import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import clsx from 'clsx'

export function Spinner({ size = 'md' }) {
  const sz = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }[size]
  return (
    <div className="flex items-center justify-center p-8">
      <div className={clsx('animate-spin rounded-full border-2 border-pp-border border-t-pp-accent', sz)} />
    </div>
  )
}

export function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-red-950/30 border border-red-900/50 text-red-400">
      <AlertTriangle className="shrink-0 mt-0.5" size={16} />
      <span className="text-sm">{message}</span>
    </div>
  )
}

export function StatCard({ label, value, sub, trend, accentColor }) {
  return (
    <div className="stat-card">
      <p className="text-xs font-mono text-pp-muted uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-display font-bold" style={accentColor ? { color: accentColor } : {}}>
        {value ?? '—'}
      </p>
      {sub && <p className="text-xs text-pp-muted">{sub}</p>}
    </div>
  )
}

export function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-display font-semibold text-pp-text">{title}</h2>
      {subtitle && <p className="text-sm text-pp-muted mt-0.5">{subtitle}</p>}
    </div>
  )
}

export function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-pp-muted">
      {Icon && <Icon size={32} className="opacity-40" />}
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function Badge({ label }) {
  const cls = {
    CRITICAL: 'badge-critical',
    HIGH:     'badge-high',
    MEDIUM:   'badge-medium',
    LOW:      'badge-low',
  }[label?.toUpperCase()] || 'badge-unknown'
  return <span className={cls}>{label}</span>
}
