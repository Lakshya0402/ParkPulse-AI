import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30_000,
})

// ── Hotspots ──────────────────────────────────────────────────────────────────
export const getHotspots = (params = {}) =>
  api.get('/api/hotspots/', { params }).then(r => r.data)

export const getHotspot = (clusterId) =>
  api.get(`/api/hotspots/${clusterId}`).then(r => r.data)

export const getHeatmapPoints = () =>
  api.get('/api/hotspots/heatmap/points').then(r => r.data)

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getSummary = () =>
  api.get('/api/analytics/summary').then(r => r.data)

export const getViolationTypes = () =>
  api.get('/api/analytics/violation-types').then(r => r.data)

export const getByPoliceStation = () =>
  api.get('/api/analytics/by-police-station').then(r => r.data)

export const getHourlyDistribution = () =>
  api.get('/api/analytics/hourly-distribution').then(r => r.data)

export const getMonthlyTrend = () =>
  api.get('/api/analytics/monthly-trend').then(r => r.data)

export const getPciDistribution = () =>
  api.get('/api/analytics/pci-distribution').then(r => r.data)

// ── Predict ───────────────────────────────────────────────────────────────────
export const predictRisk = (payload) =>
  api.post('/api/predict/risk', payload).then(r => r.data)

export const getModelInfo = () =>
  api.get('/api/predict/model-info').then(r => r.data)

// ── Coverage ──────────────────────────────────────────────────────────────────
export const getCoverageGaps = () =>
  api.get('/api/coverage/gaps').then(r => r.data)

export const getCoverageSummary = () =>
  api.get('/api/coverage/summary').then(r => r.data)

// ── Offenders ─────────────────────────────────────────────────────────────────
export const getOffenders = (params = {}) =>
  api.get('/api/offenders/', { params }).then(r => r.data)

export const getOffenderStats = () =>
  api.get('/api/offenders/stats').then(r => r.data)

// ── Planner ───────────────────────────────────────────────────────────────────
export const getPatrolPlan = (officers = 20, topN = 10) =>
  api.get('/api/planner/plan', { params: { officers, top_n: topN } }).then(r => r.data)

// ── Health ────────────────────────────────────────────────────────────────────
export const getHealth = () =>
  api.get('/api/health').then(r => r.data)

export default api
