import { Outlet, matchPath, useHref, useLocation, useNavigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import {
  IconAddressBook, IconBriefcase, IconChartBar, IconChecklist, IconCreditCard, IconFileText,
  IconLayoutDashboard, IconLayoutKanban, IconMessages, IconRefresh, IconSpeakerphone, IconTargetArrow,
} from '@tabler/icons-react'
import { Sidebar, SidebarFooter, SidebarHeader, SidebarItem, SidebarNav, SidebarSection, SidebarToggle, useSidebar } from '@/components/ui/sidebar'
import { db } from '../api/db'
import { agenda } from '../api'
import { useQuery } from '../hooks'
import { dayDiff } from '../format'
import { AddLead } from './LeadModal'
import GlobalSearch from './GlobalSearch'

const icon = (I: typeof IconLayoutDashboard) => <I className="size-[18px]" stroke={1.75} />

const sections: { label: string; items: { to: string; label: string; icon: ReactNode }[] }[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/', label: 'Dashboard', icon: icon(IconLayoutDashboard) },
      { to: '/pipeline', label: 'Pipeline', icon: icon(IconLayoutKanban) },
      { to: '/leads', label: 'Leads', icon: icon(IconTargetArrow) },
      { to: '/clients', label: 'Clients', icon: icon(IconAddressBook) },
      { to: '/agenda', label: 'Agenda', icon: icon(IconChecklist) },
      { to: '/communication', label: 'Communication', icon: icon(IconMessages) },
    ],
  },
  {
    label: 'Practice',
    items: [
      { to: '/documents', label: 'Documents', icon: icon(IconFileText) },
      { to: '/payments', label: 'Payments', icon: icon(IconCreditCard) },
      { to: '/marketing', label: 'Marketing', icon: icon(IconSpeakerphone) },
      { to: '/services', label: 'Services', icon: icon(IconBriefcase) },
      { to: '/reports', label: 'Reports', icon: icon(IconChartBar) },
    ],
  },
]

const WIDTH = 240
const RAIL = 64

/** A sidebar item that is a real link (so open-in-new-tab works) but navigates client-side. */
function NavItem({ to, label, icon, badge }: { to: string; label: string; icon: ReactNode; badge?: ReactNode }) {
  const href = useHref(to)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const active = !!matchPath({ path: to, end: to === '/' }, pathname)
  return (
    <SidebarItem
      href={href}
      icon={icon}
      active={active}
      badge={badge}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        navigate(to)
      }}
    >
      {label}
    </SidebarItem>
  )
}

function Brand() {
  const { collapsed } = useSidebar()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-brand-500 text-white">
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square"><path d="M3.5 16.5V3.5L10 11l6.5-7.5v13" /></svg>
      </span>
      {!collapsed && <span className="truncate text-[14px] font-semibold leading-none">MGC CRM</span>}
    </div>
  )
}

function UserFooter() {
  const { collapsed } = useSidebar()
  return (
    <>
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-300 text-[11px] font-bold text-accent-ink">SM</span>
      {!collapsed && (
        <>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-medium leading-tight">Sarah Mitchell</div>
            <div className="truncate text-[11px] leading-tight text-[var(--muted-foreground)]">Example Family Law LLP</div>
          </div>
          <button
            type="button"
            title="Reset demo data"
            aria-label="Reset demo data"
            onClick={() => confirm('Reset all demo data?') && db.reset()}
            className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-[var(--muted-foreground)] hover:bg-white/10 hover:text-[var(--foreground)]"
          >
            <IconRefresh className="size-4" stroke={1.75} />
          </button>
        </>
      )}
    </>
  )
}

export default function Layout() {
  const [quick, setQuick] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const items = useQuery(() => agenda.list())
  const overdue = items?.filter(a => !a.done && dayDiff(a.dueAt) < 0).length ?? 0
  const side = collapsed ? RAIL : WIDTH
  const slide = 'transition-[left,margin] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none'

  return (
    <div className="min-h-screen">
      <Sidebar
        variant="collapsible"
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        width={WIDTH}
        collapsedWidth={RAIL}
        aria-label="Main navigation"
        className="app-sidebar fixed inset-y-0 left-0 z-50 h-screen"
      >
        <SidebarHeader className={collapsed ? 'mx-2 mt-1' : 'h-14'}>
          <Brand />
          <SidebarToggle className="ml-auto" />
        </SidebarHeader>
        <SidebarNav className="sidebar-nav">
          {sections.map(s => (
            <SidebarSection key={s.label} label={s.label}>
              {s.items.map(n => (
                <NavItem
                  key={n.to}
                  {...n}
                  badge={n.to === '/agenda' && overdue > 0
                    ? <span className="rounded-md bg-accent-300 px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-accent-ink tabular-nums">{overdue}</span>
                    : undefined}
                />
              ))}
            </SidebarSection>
          ))}
        </SidebarNav>
        <SidebarFooter>
          <UserFooter />
        </SidebarFooter>
      </Sidebar>

      <header style={{ left: side }} className={`fixed right-0 top-0 z-40 flex h-14 items-center gap-4 bg-brand-500 px-5 shadow ${slide}`}>
        <GlobalSearch />
        <div className="ml-auto">
          <button onClick={() => setQuick(true)} className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-brand-500 hover:bg-brand-50">
            <span className="text-base leading-none">⊕</span> Quick Intake
          </button>
        </div>
      </header>

      <main style={{ marginLeft: side }} className={`min-h-screen px-8 pb-8 pt-20 ${slide}`}><Outlet /></main>
      {quick && <AddLead onClose={() => setQuick(false)} />}
    </div>
  )
}
