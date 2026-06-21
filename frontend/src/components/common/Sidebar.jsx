import { NavLink } from 'react-router-dom'
import { Map, BarChart2, Search, Shield, AlertCircle, Users, Activity } from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { to: '/',          icon: Map,         label: 'City Map'      },
  { to: '/analytics', icon: BarChart2,   label: 'Analytics'     },
  { to: '/hotspots',  icon: Search,      label: 'Hotspot Explorer' },
  { to: '/predict',   icon: Activity,    label: 'Risk Predict'  },
  { to: '/planner',   icon: Shield,      label: 'Patrol Planner'},
  { to: '/coverage',  icon: AlertCircle, label: 'Coverage Gaps' },
  { to: '/offenders', icon: Users,       label: 'Watchlist'     },
]

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-pp-surface border-r border-pp-border flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-pp-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-pp-accent flex items-center justify-center">
            <Map size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-display font-bold text-pp-text leading-none">ParkPulse</p>
            <p className="text-[10px] font-mono text-pp-muted mt-0.5">AI · Bengaluru BTP</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-pp-accent/10 text-pp-accent font-medium border border-pp-accent/20'
                  : 'text-pp-muted hover:text-pp-text hover:bg-pp-border/50'
              )
            }
          >
            <Icon size={15} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-pp-border">
        <p className="text-[10px] font-mono text-pp-muted leading-relaxed">
          Data: Nov 2023 – Apr 2024<br />
          ~298K BTP violation records
        </p>
      </div>
    </aside>
  )
}
