import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { db } from '../api/db'
import { agenda } from '../api'
import { useQuery } from '../hooks'
import { dayDiff } from '../format'
import { AddLead } from './LeadModal'
import GlobalSearch from './GlobalSearch'

const nav = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/pipeline', label: 'Pipeline', icon: '▤' },
  { to: '/leads', label: 'Leads', icon: '◎' },
  { to: '/clients', label: 'Clients', icon: '☺' },
  { to: '/agenda', label: 'Agenda', icon: '☑' },
  { to: '/communication', label: 'Communication', icon: '✉' },
  { to: '/documents', label: 'Documents', icon: '✎' },
  { to: '/payments', label: 'Payments', icon: '$' },
  { to: '/marketing', label: 'Marketing', icon: '➚' },
  { to: '/services', label: 'Services', icon: '☰' },
  { to: '/reports', label: 'Reports', icon: '◔' },
]

export default function Layout() {
  const [quick, setQuick] = useState(false)
  const items = useQuery(() => agenda.list())
  const overdue = items?.filter(a => !a.done && dayDiff(a.dueAt) < 0).length ?? 0
  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-4 bg-brand-500 px-5 shadow">
        <div className="flex w-44 items-center gap-2 text-lg font-semibold tracking-wide text-white"><span className="text-xl">⚖</span> Unir</div>
        <GlobalSearch />
        <div className="ml-auto">
          <button onClick={() => setQuick(true)} className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-brand-500 hover:bg-brand-50">
            <span className="text-base leading-none">⊕</span> Quick Intake
          </button>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-14 flex w-56 flex-col bg-side text-slate-300">
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pt-4">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/15 text-white' : 'hover:bg-white/10'}`}>
              <span className="w-4 text-center">{n.icon}</span>{n.label}
              {n.to === '/agenda' && overdue > 0 && <span className="ml-auto rounded-full bg-red-500 px-1.5 text-xs text-white">{overdue}</span>}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => confirm('Reset all demo data?') && db.reset()} className="m-3 rounded-lg px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/10">↺ Reset demo data</button>
      </aside>

      <main className="ml-56 min-h-screen px-8 pb-8 pt-20"><Outlet /></main>
      {quick && <AddLead onClose={() => setQuick(false)} />}
    </div>
  )
}
