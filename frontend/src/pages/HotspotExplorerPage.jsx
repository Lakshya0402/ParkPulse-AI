import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getHotspots } from '../services/api'
import { Spinner, ErrorBanner, Badge, SectionHeader } from '../components/common/UI'
import { fmtN, pciColor } from '../utils/helpers'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'

const LABELS = ['ALL','CRITICAL','HIGH','MEDIUM','LOW']

export default function HotspotExplorerPage() {
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)

  const { data: hotspots, loading, error } = useFetch(getHotspots)

  const filtered = (hotspots || []).filter(h => {
    const labelMatch = filter === 'ALL' || h.pci_label === filter
    const q = search.toLowerCase()
    const textMatch = !q ||
      (h.junction_name || '').toLowerCase().includes(q) ||
      (h.police_station || '').toLowerCase().includes(q)
    return labelMatch && textMatch
  })

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-display font-bold">Hotspot Explorer</h1>
        <p className="text-sm text-pp-muted mt-1">Click any row to inspect PCI breakdown and violation distribution.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pp-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search junction or station…"
            className="pl-8 pr-3 py-1.5 text-sm bg-pp-surface border border-pp-border rounded-lg
              text-pp-text placeholder:text-pp-muted focus:outline-none focus:border-pp-accent/50 w-64"
          />
        </div>
        <div className="flex gap-1">
          {LABELS.map(l => (
            <button key={l} onClick={() => setFilter(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all
                ${filter === l
                  ? 'bg-pp-accent text-white'
                  : 'bg-pp-surface border border-pp-border text-pp-muted hover:text-pp-text'}`}>
              {l}
            </button>
          ))}
        </div>
        <span className="text-xs text-pp-muted ml-auto font-mono">
          {filtered.length} / {(hotspots||[]).length} hotspots
        </span>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}

      {!loading && (
        <div className="space-y-2">
          {filtered.map(h => (
            <HotspotRow
              key={h.cluster_id}
              hotspot={h}
              isOpen={expanded === h.cluster_id}
              onToggle={() => setExpanded(expanded === h.cluster_id ? null : h.cluster_id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="card text-center py-12 text-pp-muted text-sm">No hotspots match your filters.</div>
          )}
        </div>
      )}
    </div>
  )
}

function HotspotRow({ hotspot: h, isOpen, onToggle }) {
  return (
    <div className="card cursor-pointer hover:border-pp-accent/30 transition-colors" onClick={onToggle}>
      <div className="flex items-center gap-4">
        {/* Rank / label */}
        <div className="w-2 h-8 rounded-full shrink-0" style={{ background: pciColor(h.pci_label) }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">
              {h.junction_name !== 'No Junction' ? h.junction_name : `Cluster #${h.cluster_id}`}
            </p>
            <Badge label={h.pci_label} />
          </div>
          <p className="text-xs text-pp-muted mt-0.5">{h.police_station}</p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-mono font-bold" style={{ color: pciColor(h.pci_label) }}>
            {h.pci_score?.toFixed(1)}
          </p>
          <p className="text-xs text-pp-muted">{fmtN(h.violation_count)} violations</p>
        </div>

        <div className="text-pp-muted shrink-0">
          {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-pp-border grid grid-cols-3 gap-4">
          {/* PCI breakdown */}
          <div>
            <p className="text-xs font-mono text-pp-muted uppercase mb-2">PCI Components</p>
            <div className="space-y-2">
              {[
                ['Frequency', h.pci_frequency_score, 35],
                ['Time-of-day', h.pci_time_score, 25],
                ['Junction', h.pci_junction_score, 20],
                ['Recurrence', h.pci_recurrence_score, 15],
                ['Vehicle', h.pci_vehicle_score, 5],
              ].map(([label, val, weight]) => (
                <div key={label}>
                  <div className="flex justify-between text-[11px] text-pp-muted">
                    <span>{label} ({weight}%)</span>
                    <span>{val?.toFixed(0) ?? '—'}</span>
                  </div>
                  <div className="h-1 bg-pp-border rounded-full mt-0.5">
                    <div className="h-1 rounded-full bg-pp-accent transition-all"
                      style={{ width: `${Math.min(100, val || 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top violation types */}
          <div>
            <p className="text-xs font-mono text-pp-muted uppercase mb-2">Violation Types</p>
            <ul className="space-y-1">
              {Object.entries(h.violation_type_dist || {})
                .sort((a,b) => b[1]-a[1]).slice(0,6)
                .map(([k,v]) => (
                  <li key={k} className="flex justify-between text-xs">
                    <span className="text-pp-muted truncate max-w-[130px]">{k}</span>
                    <span className="font-mono">{v}</span>
                  </li>
                ))}
            </ul>
          </div>

          {/* Peak hours */}
          <div>
            <p className="text-xs font-mono text-pp-muted uppercase mb-2">Peak Hours (IST)</p>
            <ul className="space-y-1">
              {Object.entries(h.hour_dist || {})
                .sort((a,b) => b[1]-a[1]).slice(0,6)
                .map(([hr,cnt]) => (
                  <li key={hr} className="flex justify-between text-xs">
                    <span className="text-pp-muted">{hr}:00</span>
                    <span className="font-mono">{cnt}</span>
                  </li>
                ))}
            </ul>
            <p className="text-[10px] text-pp-muted mt-2">
              Coord: {h.center_lat?.toFixed(4)}, {h.center_lon?.toFixed(4)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
