import { useFetch } from '../hooks/useFetch'
import { getCoverageGaps, getCoverageSummary } from '../services/api'
import { Spinner, ErrorBanner, StatCard } from '../components/common/UI'
import { AlertTriangle, Eye, EyeOff } from 'lucide-react'

export default function CoveragePage() {
  const { data: summary, loading: sL } = useFetch(getCoverageSummary)
  const { data: gaps, loading: gL, error } = useFetch(getCoverageGaps)

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-display font-bold">Enforcement Coverage Gaps</h1>
        <p className="text-sm text-pp-muted mt-1">
          Analysis of camera/ANPR active hours — reveals where and when enforcement is blind.
        </p>
      </div>

      {/* Key finding banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-950/30 border border-yellow-900/40 text-yellow-300">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">Critical Finding: Evening Blind Spot</p>
          <p className="text-xs mt-1 leading-relaxed text-yellow-400/80">
            Camera-based enforcement operates primarily from <strong>00:00 – 15:00 IST</strong>.
            After 15:00, detection rates drop to &lt;0.2% of daily records — not because fewer violations occur,
            but because cameras are inactive. This is a documented infrastructure gap, not a natural traffic pattern.
          </p>
        </div>
      </div>

      {/* Summary KPIs */}
      {sL ? <Spinner size="sm" /> : summary && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Active Devices" value={summary.active_devices} />
          <StatCard label="City Min Hour" value={`${summary.city_min_hour}:00 IST`} />
          <StatCard label="City Max Hour" value={`${summary.city_max_hour}:00 IST`} />
          <StatCard label="Blind Spot Hours"
            value={summary.blind_spot_hours?.length}
            sub={`${summary.blind_spot_hours?.[0]}:00 – 23:00 IST`}
            accentColor="#ef4444" />
        </div>
      )}

      {/* Hour coverage heat bar */}
      <div className="card">
        <p className="text-xs font-mono text-pp-muted uppercase mb-3">24-Hour Coverage Map (City-wide)</p>
        <div className="flex gap-0.5">
          {Array.from({ length: 24 }, (_, h) => {
            const covered = summary ? h <= (summary.city_max_hour || 14) : true
            return (
              <div key={h} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-8 w-full rounded-sm ${covered ? 'bg-pp-low/70' : 'bg-pp-critical/40'}`}
                  title={`${h}:00 IST — ${covered ? 'Covered' : 'Blind spot'}`} />
                {h % 3 === 0 && (
                  <span className="text-[9px] font-mono text-pp-muted">{h}h</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-pp-muted">
          <span className="flex items-center gap-1.5"><Eye size={12} className="text-pp-low" /> Camera active (0–15)</span>
          <span className="flex items-center gap-1.5"><EyeOff size={12} className="text-pp-critical" /> Camera inactive (16–23)</span>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Per-device table */}
      <div className="card">
        <p className="text-sm font-display font-semibold mb-4">Per-Device Coverage</p>
        {gL ? <Spinner size="sm" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pp-border text-pp-muted text-xs font-mono">
                  <th className="text-left py-2 pr-4">Device ID</th>
                  <th className="text-left py-2 pr-4">Police Station</th>
                  <th className="text-right py-2 pr-4">Min Hour</th>
                  <th className="text-right py-2 pr-4">Max Hour</th>
                  <th className="text-right py-2">Records</th>
                </tr>
              </thead>
              <tbody>
                {(gaps || []).slice(0, 50).map((g, i) => (
                  <tr key={i} className="border-b border-pp-border/40 hover:bg-pp-border/20">
                    <td className="py-1.5 pr-4 font-mono text-xs text-pp-muted">{g.device_id}</td>
                    <td className="py-1.5 pr-4 text-xs">{g.police_station}</td>
                    <td className="py-1.5 pr-4 text-right font-mono text-xs">{g.min_hour}:00</td>
                    <td className="py-1.5 pr-4 text-right font-mono text-xs">{g.max_hour}:00</td>
                    <td className="py-1.5 text-right font-mono text-xs">{g.total_records?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
