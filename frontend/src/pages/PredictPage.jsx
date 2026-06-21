import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getHotspots, predictRisk, getModelInfo } from '../services/api'
import { Spinner, ErrorBanner, Badge } from '../components/common/UI'
import { pciColor, fmtN } from '../utils/helpers'
import { Activity, Info } from 'lucide-react'

const VEHICLE_TYPES = [
  'CAR','TWO WHEELER','BUS','TRUCK','AUTO RICKSHAW','VAN',
  'LIGHT MOTOR VEHICLE','MAXI CAB','MOTOR CYCLE','OTHER'
]

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Only hours with real coverage
const COVERED_HOURS = Array.from({ length: 16 }, (_, i) => i)

export default function PredictPage() {
  const { data: hotspots, loading: hL } = useFetch(getHotspots)
  const { data: modelInfo } = useFetch(getModelInfo)

  const [clusterId, setClusterId] = useState('')
  const [hour, setHour] = useState(9)
  const [dow, setDow] = useState(0)
  const [month, setMonth] = useState(1)
  const [vehicleType, setVehicleType] = useState('CAR')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const topHotspots = (hotspots || []).slice(0, 50)

  async function run() {
    if (!clusterId) { setError('Select a hotspot cluster.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await predictRisk({
        cluster_id: parseInt(clusterId),
        hour,
        day_of_week: dow,
        month,
        vehicle_type: vehicleType,
      })
      setResult(res)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold">Risk Prediction</h1>
        <p className="text-sm text-pp-muted mt-1">
          XGBoost-based violation risk for a cluster + time window.
        </p>
      </div>

      {/* Model info banner */}
      {modelInfo && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-950/30 border border-blue-900/40 text-blue-400 text-xs">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            Model trained on {fmtN(modelInfo.meta?.n_samples)} records across {modelInfo.meta?.n_clusters} clusters.
            Macro F1: <strong>{modelInfo.meta?.f1_macro}</strong>.
            {' '}Only hours <strong>0–15 IST</strong> have reliable coverage.
          </span>
        </div>
      )}

      {/* Inputs */}
      <div className="card space-y-4">
        <p className="text-sm font-display font-semibold">Configure Prediction</p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Hotspot Cluster">
            {hL ? <Spinner size="sm" /> : (
              <select value={clusterId} onChange={e => setClusterId(e.target.value)}
                className="input-field w-full">
                <option value="">— Select a hotspot —</option>
                {topHotspots.map(h => (
                  <option key={h.cluster_id} value={h.cluster_id}>
                    #{h.cluster_id} · {h.junction_name !== 'No Junction' ? h.junction_name : h.police_station}
                    {' '}({h.pci_label})
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Hour (IST) — 0–15 covered">
            <select value={hour} onChange={e => setHour(+e.target.value)}
              className="input-field w-full">
              {COVERED_HOURS.map(h => (
                <option key={h} value={h}>{h}:00 IST</option>
              ))}
            </select>
            <p className="text-[10px] text-pp-muted mt-1">Hours 16–23 have &lt;0.2% coverage — predictions unavailable.</p>
          </Field>

          <Field label="Day of Week">
            <select value={dow} onChange={e => setDow(+e.target.value)} className="input-field w-full">
              {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </Field>

          <Field label="Month">
            <select value={month} onChange={e => setMonth(+e.target.value)} className="input-field w-full">
              {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </Field>

          <Field label="Dominant Vehicle Type">
            <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className="input-field w-full">
              {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
        </div>

        <button onClick={run} disabled={loading}
          className="btn-primary disabled:opacity-50">
          <Activity size={15} />
          {loading ? 'Predicting…' : 'Predict Risk'}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Result */}
      {result && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-display font-semibold">Prediction Result</p>
            <Badge label={result.risk_label} />
          </div>

          {!result.hour_covered && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-950/30 border border-yellow-900/40 text-yellow-400 text-xs">
              <Info size={13} className="shrink-0 mt-0.5" />
              {result.message}
            </div>
          )}

          {result.hour_covered && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(result.probabilities).map(([label, prob]) => (
                  <div key={label} className="card text-center">
                    <p className="text-xs text-pp-muted font-mono">{label}</p>
                    <p className="text-2xl font-display font-bold mt-1"
                       style={{ color: pciColor(label) }}>
                      {(prob * 100).toFixed(0)}%
                    </p>
                  </div>
                ))}
              </div>

              <div className="text-xs text-pp-muted flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-pp-accent" />
                {result.message}
              </div>

              {result.pci_score && (
                <p className="text-xs text-pp-muted">
                  Zone PCI score: <span className="text-pp-text font-mono">{result.pci_score?.toFixed(1)}</span>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-mono text-pp-muted mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

// Inline input style via CSS injected in index.css would be cleaner;
// using a style tag approach here for self-containment:
const styleTag = document.createElement('style')
styleTag.textContent = `
  .input-field {
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 8px;
    color: #e6edf3;
    font-size: 13px;
    padding: 7px 10px;
    outline: none;
    transition: border-color 0.15s;
  }
  .input-field:focus { border-color: rgba(249,115,22,0.5); }
  .input-field option { background: #161b22; }
`
document.head.appendChild(styleTag)
