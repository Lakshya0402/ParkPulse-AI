import { useState } from 'react'
import { getPatrolPlan } from '../services/api'
import { Spinner, ErrorBanner, Badge } from '../components/common/UI'
import { pciColor } from '../utils/helpers'
import { Shield, MapPin, Clock, Users } from 'lucide-react'

export default function PlannerPage() {
  const [officers, setOfficers] = useState(20)
  const [topN, setTopN] = useState(10)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function generate() {
    setLoading(true); setError(null)
    try {
      const res = await getPatrolPlan(officers, topN)
      setPlan(res)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-display font-bold">Patrol Planner</h1>
        <p className="text-sm text-pp-muted mt-1">
          AI-generated officer deployment plan based on PCI scores and violation frequency.
        </p>
      </div>

      {/* Config */}
      <div className="card flex items-end gap-6">
        <div>
          <label className="block text-xs font-mono text-pp-muted mb-1.5 uppercase">Officers Available</label>
          <input type="number" value={officers} min={1} max={200}
            onChange={e => setOfficers(+e.target.value)}
            className="input-field w-28" />
        </div>
        <div>
          <label className="block text-xs font-mono text-pp-muted mb-1.5 uppercase">Top N Zones</label>
          <input type="number" value={topN} min={1} max={30}
            onChange={e => setTopN(+e.target.value)}
            className="input-field w-24" />
        </div>
        <button onClick={generate} disabled={loading}
          className="btn-primary mb-0.5">
          <Shield size={15} />
          {loading ? 'Generating…' : 'Generate Plan'}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}

      {plan && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-display font-semibold">
              Today's Enforcement Plan — {plan.total_officers} Officers → {plan.zones_covered} Zones
            </p>
            <span className="text-xs font-mono text-pp-muted">Priority ranked by PCI + frequency</span>
          </div>

          {plan.plan.map(zone => (
            <div key={zone.cluster_id} className="card border-l-4"
              style={{ borderLeftColor: pciColor(zone.pci_label) }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="text-center min-w-[2.5rem]">
                    <p className="text-2xl font-display font-bold text-pp-muted">#{zone.rank}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display font-semibold">
                        {zone.junction_name !== 'No Junction' ? zone.junction_name : `Cluster #${zone.cluster_id}`}
                      </p>
                      <Badge label={zone.pci_label} />
                    </div>
                    <p className="text-xs text-pp-muted flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {zone.police_station}
                    </p>
                    <p className="text-xs text-pp-muted mt-2 leading-relaxed max-w-xl">
                      {zone.rationale}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right space-y-2">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Users size={13} className="text-pp-accent" />
                    <span className="text-sm font-display font-bold text-pp-accent">
                      {zone.recommended_officers} officer{zone.recommended_officers !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <Clock size={13} className="text-pp-muted" />
                    <span className="text-xs font-mono text-pp-muted">
                      {zone.patrol_window_start.toString().padStart(2,'0')}:00 –{' '}
                      {zone.patrol_window_end.toString().padStart(2,'0')}:00 IST
                    </span>
                  </div>
                  <div className="text-xs font-mono text-pp-muted">
                    PCI {zone.pci_score?.toFixed(1)} · Priority {zone.priority_score?.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
