import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/common/Sidebar'
import CityMapPage from './pages/CityMapPage'
import AnalyticsPage from './pages/AnalyticsPage'
import HotspotExplorerPage from './pages/HotspotExplorerPage'
import PredictPage from './pages/PredictPage'
import PlannerPage from './pages/PlannerPage'
import CoveragePage from './pages/CoveragePage'
import OffendersPage from './pages/OffendersPage'

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-pp-dark">
        <Routes>
          <Route path="/"          element={<CityMapPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/hotspots"  element={<HotspotExplorerPage />} />
          <Route path="/predict"   element={<PredictPage />} />
          <Route path="/planner"   element={<PlannerPage />} />
          <Route path="/coverage"  element={<CoveragePage />} />
          <Route path="/offenders" element={<OffendersPage />} />
        </Routes>
      </main>
    </div>
  )
}
