import { useFetch } from '../hooks/useFetch'
import {
  getViolationTypes, getByPoliceStation,
  getHourlyDistribution, getMonthlyTrend, getPciDistribution, getSummary
} from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import { Spinner, ErrorBanner, StatCard, SectionHeader } from '../components/common/UI'
import { fmtN, pciColor } from '../utils/helpers'

const CHART_COLORS = ['#f97316','#3b82f6','#22c55e','#eab308','#a855f7','#ec4899','#14b8a6']

export default function AnalyticsPage() {
  const { data: summary } = useFetch(getSummary)
  const { data: types,   loading: tL, error: tE } = useFetch(getViolationTypes)
  const { data: stations, loading: sL } = useFetch(getByPoliceStation)
  const { data: hourly,  loading: hL } = useFetch(getHourlyDistribution)
  const { data: monthly, loading: mL } = useFetch(getMonthlyTrend)
  const { data: pciDist, loading: pL } = useFetch(getPciDistribution)

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-display font-bold">Analytics</h1>
        <p className="text-sm text-pp-muted mt-1">
          Dataset: Nov 2023 – Apr 2024 · {fmtN(summary?.total_violations)} validated violations
        </p>
      </div>

      {tE && <ErrorBanner message={tE} />}

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Violations" value={fmtN(summary.total_violations)} />
          <StatCard label="Hotspots Found" value={fmtN(summary.total_hotspots)} />
          <StatCard label="Critical Zones" value={fmtN(summary.critical_zones)} accentColor="#ef4444" />
          <StatCard label="Avg PCI Score" value={summary.avg_pci?.toFixed(1)} />
        </div>
      )}

      {/* PCI distribution + Hourly */}
      <div className="grid grid-cols-2 gap-5">
        <div className="card">
          <SectionHeader title="PCI Risk Distribution" subtitle="Hotspots by risk label" />
          {pL ? <Spinner size="sm" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pciDist || []} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={({ label, percent }) => `${label} ${(percent*100).toFixed(0)}%`}>
                  {(pciDist || []).map((e, i) => (
                    <Cell key={i} fill={pciColor(e.label)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <SectionHeader title="Hourly Violation Pattern" subtitle="IST — peak 8–11 AM (ANPR active window)" />
          {hL ? <Spinner size="sm" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourly || []} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="hour" tick={{ fill: '#8b949e', fontSize: 10 }}
                  tickFormatter={h => `${h}h`} />
                <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} tickFormatter={fmtN} />
                <Tooltip formatter={v => fmtN(v)} labelFormatter={h => `${h}:00 IST`}
                  contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8 }} />
                <Bar dataKey="count" fill="#f97316" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-[10px] text-pp-muted mt-2">
            ⚠️ Near-zero data after 15:00 IST — enforcement camera blind spot, not absence of violations.
          </p>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="card">
        <SectionHeader title="Monthly Violation Trend" subtitle="Nov 2023 – Apr 2024" />
        {mL ? <Spinner size="sm" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthly || []} margin={{ top: 0, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="month" tick={{ fill: '#8b949e', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} tickFormatter={fmtN} />
              <Tooltip formatter={v => fmtN(v)}
                contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top violation types */}
      <div className="card">
        <SectionHeader title="Top Violation Categories" subtitle="Across all validated records" />
        {tL ? <Spinner size="sm" /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={(types || []).slice(0,12)} layout="vertical"
              margin={{ top: 0, right: 16, left: 160, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 10 }} tickFormatter={fmtN} />
              <YAxis type="category" dataKey="type" tick={{ fill: '#8b949e', fontSize: 10 }} width={155} />
              <Tooltip formatter={v => fmtN(v)}
                contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8 }} />
              <Bar dataKey="count" radius={[0,2,2,0]}
                fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* By police station */}
      <div className="card">
        <SectionHeader title="Top Police Stations by Violation Volume" />
        {sL ? <Spinner size="sm" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pp-border text-pp-muted text-xs font-mono">
                  <th className="text-left py-2 pr-4">Station</th>
                  <th className="text-right py-2 pr-4">Violations</th>
                  <th className="text-right py-2 pr-4">Hotspots</th>
                  <th className="text-right py-2">Avg PCI</th>
                </tr>
              </thead>
              <tbody>
                {(stations || []).map((s, i) => (
                  <tr key={i} className="border-b border-pp-border/40 hover:bg-pp-border/20 transition-colors">
                    <td className="py-2 pr-4">{s.station}</td>
                    <td className="text-right py-2 pr-4 font-mono">{fmtN(s.total_violations)}</td>
                    <td className="text-right py-2 pr-4 font-mono">{s.hotspot_count}</td>
                    <td className="text-right py-2 font-mono" style={{ color: s.avg_pci > 60 ? '#ef4444' : s.avg_pci > 40 ? '#f97316' : '#22c55e' }}>
                      {s.avg_pci?.toFixed(1)}
                    </td>
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
