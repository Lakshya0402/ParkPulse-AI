import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getOffenders, getOffenderStats } from '../services/api'
import { Spinner, ErrorBanner, StatCard } from '../components/common/UI'
import { fmtN } from '../utils/helpers'
import { Users, AlertOctagon } from 'lucide-react'

export default function OffendersPage() {
  const [minCitations, setMinCitations] = useState(5)
  const { data: stats } = useFetch(getOffenderStats)
  const { data: offenders, loading, error, refetch } = useFetch(
    () => getOffenders({ min_citations: minCitations }),
    [minCitations]
  )

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-display font-bold">Repeat Offender Watchlist</h1>
        <p className="text-sm text-pp-muted mt-1">
          Vehicles with multiple citations — independent from location hotspots.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Repeat Offenders" value={fmtN(stats.total_repeat_offenders)} />
          <StatCard label="10+ Citations" value={fmtN(stats.heavy_offenders_10plus)} accentColor="#ef4444" />
          <div className="stat-card">
            <p className="text-xs font-mono text-pp-muted uppercase tracking-wider">Most Cited Vehicle</p>
            <p className="text-xl font-display font-bold text-pp-accent font-mono truncate">
              {stats.most_cited_vehicle || '—'}
            </p>
            <p className="text-xs text-pp-muted">{stats.most_cited_count} citations</p>
          </div>
        </div>
      )}

      {/* Notable stat callout */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400">
        <AlertOctagon size={16} className="shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed">
          A single vehicle was cited <strong>55 times</strong> in 5 months.
          2,352 vehicles were cited more than 5 times. These represent driver behaviour patterns
          that location-based enforcement alone won't resolve — escalating fines or towing thresholds are required.
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-mono text-pp-muted mb-1.5 uppercase">Min Citations</label>
          <input type="number" value={minCitations} min={1}
            onChange={e => setMinCitations(+e.target.value)}
            className="input-field w-24" />
        </div>
        <p className="text-xs text-pp-muted mt-5 font-mono">
          {(offenders || []).length} vehicles shown
        </p>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}

      {!loading && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pp-border text-pp-muted text-xs font-mono">
                <th className="text-right py-2 pr-6 w-12">#</th>
                <th className="text-left py-2 pr-6">Vehicle Number</th>
                <th className="text-right py-2 pr-6">Citations</th>
                <th className="text-left py-2">Police Stations</th>
              </tr>
            </thead>
            <tbody>
              {(offenders || []).map((o, i) => (
                <tr key={i} className="border-b border-pp-border/40 hover:bg-pp-border/20 transition-colors">
                  <td className="py-2 pr-6 text-right font-mono text-xs text-pp-muted">{i+1}</td>
                  <td className="py-2 pr-6 font-mono text-pp-accent">{o.vehicle_number}</td>
                  <td className="py-2 pr-6 text-right font-mono font-bold"
                    style={{ color: o.citation_count >= 20 ? '#ef4444' : o.citation_count >= 10 ? '#f97316' : '#e6edf3' }}>
                    {o.citation_count}
                  </td>
                  <td className="py-2 text-xs text-pp-muted">
                    {(o.police_stations || []).slice(0,3).join(', ')}
                  </td>
                </tr>
              ))}
              {(offenders || []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-pp-muted text-xs">
                    No offenders found. Try lowering the minimum citations threshold.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
