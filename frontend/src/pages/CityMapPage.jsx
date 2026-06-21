import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getHotspots, getHeatmapPoints, getSummary } from '../services/api'
import MapContainer from '../components/map/MapContainer'
import { Spinner, ErrorBanner, StatCard, Badge } from '../components/common/UI'
import { fmtN, pciColor } from '../utils/helpers'
import { X, MapPin, Activity } from 'lucide-react'

export default function CityMapPage() {
  const [selected, setSelected] = useState(null)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showMarkers, setShowMarkers] = useState(true)

  const { data: summary, loading: sLoading } = useFetch(getSummary)
  const { data: hotspots, loading: hLoading, error: hError } = useFetch(getHotspots)
  const { data: heatmapPts, loading: mLoading } = useFetch(getHeatmapPoints)

  const loading = sLoading || hLoading || mLoading

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-pp-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-display font-bold">City Intelligence Map</h1>
          <p className="text-xs text-pp-muted mt-0.5">Live hotspot heatmap — Bengaluru Traffic Police data</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-pp-muted cursor-pointer">
            <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)}
              className="accent-pp-accent" />
            Heatmap
          </label>
          <label className="flex items-center gap-2 text-xs text-pp-muted cursor-pointer">
            <input type="checkbox" checked={showMarkers} onChange={e => setShowMarkers(e.target.checked)}
              className="accent-pp-accent" />
            Markers
          </label>
        </div>
      </div>

      {/* KPI row */}
      {summary && (
        <div className="grid grid-cols-5 gap-3 px-6 py-3 border-b border-pp-border">
          <StatCard label="Total Violations" value={fmtN(summary.total_violations)} />
          <StatCard label="Hotspots" value={fmtN(summary.total_hotspots)} />
          <StatCard label="Critical Zones" value={fmtN(summary.critical_zones)} accentColor="#ef4444" />
          <StatCard label="High Zones" value={fmtN(summary.high_zones)} accentColor="#f97316" />
          <StatCard label="Avg PCI" value={summary.avg_pci?.toFixed(1)} sub="0 – 100 scale" />
        </div>
      )}

      {hError && <div className="px-6 py-3"><ErrorBanner message={hError} /></div>}

      {/* Map + side panel */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 p-4">
          <div className="map-container h-full">
            <MapContainer
              heatmapPoints={heatmapPts || []}
              hotspots={hotspots || []}
              showHeatmap={showHeatmap}
              showMarkers={showMarkers}
              onHotspotClick={setSelected}
              height="100%"
            />
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1">
          {selected && (
            <div className="w-100 border-l border-pp-border bg-pp-surface overflow-y-auto p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display font-semibold text-sm leading-tight">
                    {selected.junction_name !== 'No Junction' ? selected.junction_name : `Cluster #${selected.cluster_id}`}
                  </p>
                  <p className="text-xs text-pp-muted mt-0.5 flex items-center gap-1">
                    <MapPin size={10} /> {selected.police_station}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="text-pp-muted hover:text-pp-text">
                  <X size={16} />
                </button>
              </div>

              {/* PCI */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-pp-muted font-mono uppercase">PCI Score</span>
                  <Badge label={selected.pci_label} />
                </div>
                <p className="text-3xl font-display font-bold" style={{ color: pciColor(selected.pci_label) }}>
                  {selected.pci_score?.toFixed(1)}
                </p>
                <div className="mt-3 space-y-1.5">
                  {[
                    ['Frequency (35%)', selected.pci_frequency_score],
                    ['Time-of-day (25%)', selected.pci_time_score],
                    ['Junction (20%)', selected.pci_junction_score],
                    ['Recurrence (15%)', selected.pci_recurrence_score],
                    ['Vehicle (5%)', selected.pci_vehicle_score],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div className="flex justify-between text-[11px] text-pp-muted mb-0.5">
                        <span>{label}</span>
                        <span>{val?.toFixed(0)}</span>
                      </div>
                      <div className="h-1 bg-pp-border rounded-full">
                        <div className="h-1 rounded-full bg-pp-accent"
                          style={{ width: `${Math.min(100, val || 0)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="card space-y-2 text-sm">
                <Row label="Violations" value={selected.violation_count?.toLocaleString()} />
                <Row label="Dominant type" value={selected.dominant_violation} />
                <Row label="Rejection rate" value={`${((selected.rejection_rate || 0) * 100).toFixed(1)}%`} />
              </div>

              {/* Top violation types */}
              {selected.violation_type_dist && (
                <div className="card">
                  <p className="text-xs font-mono text-pp-muted uppercase mb-2">Violation Types</p>
                  <ul className="space-y-1">
                    {Object.entries(selected.violation_type_dist)
                      .sort((a, b) => b[1] - a[1]).slice(0, 5)
                      .map(([k, v]) => (
                        <li key={k} className="flex justify-between text-xs">
                          <span className="text-pp-muted truncate max-w-[160px]">{k}</span>
                          <span className="font-mono text-pp-text">{v}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div >
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-pp-muted text-xs">{label}</span>
      <span className="text-xs font-mono">{value || '—'}</span>
    </div>
  )
}
