import { useEffect, useState } from 'react'
import { Outlet, matchPath, useHref, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar, SidebarFooter, SidebarHeader, SidebarItem, SidebarNav, SidebarSection, SidebarToggle, useSidebar } from '@/components/ui/sidebar'
import { tasksApi, firmApi, leadsApi, useQuery } from '../api'
import { Icon, IconSprite } from '../shared/Icon'
import { Toasts } from '../shared/Toasts'
import { Logo } from '../shared/Logo'
import { GlobalSearch } from './GlobalSearch'
import { Seg } from '../shared/ui'
import { endOfToday, greeting } from '../shared/format'
import { NAV, TABS, VIEW, VIEWS } from './nav'
import { UiProvider, useUi } from './UiContext'
import { Layers } from './Layers'
import { Tour } from '../modules/tour/Tour'
import { InfoTip } from '../shared/InfoTip'

const WIDTH = 248
const RAIL = 60

function useViewId() {
  const { pathname } = useLocation()
  // nested pages (e.g. /documents/abc) belong to their module
  return VIEWS.find(v => !!matchPath({ path: v.path, end: v.path === '/' }, pathname))?.id ?? 'dashboard'
}

/** Sidebar link that is a real anchor (open-in-new-tab works) but navigates client-side. */
function NavItem({ to, label, icon, badge, onClick }: { to?: string; label: string; icon: string; badge?: React.ReactNode; onClick?: () => void }) {
  const href = useHref(to ?? '/')
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const active = !!to && !!matchPath({ path: to, end: to === '/' }, pathname)
  return (
    <SidebarItem
      href={to ? href : undefined}
      icon={<Icon name={icon} />}
      active={active}
      badge={badge}
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        if (to) navigate(to); else onClick?.()
      }}
    >
      {label}
    </SidebarItem>
  )
}

function Brand() {
  const { collapsed } = useSidebar()
  return <Logo collapsed={collapsed} />
}

function UserFooter() {
  const { collapsed } = useSidebar()
  const { openModal } = useUi()
  const firm = useQuery(() => firmApi.get())
  return (
    <button type="button" onClick={() => openModal({ type: 'account' })} aria-label={`Account. Signed in as Sarah Mitchell, ${firm?.name ?? ''}`}
      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] p-1 text-left hover:bg-white/5">
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-300 text-[11px] font-bold text-accent-ink">SM</span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium leading-tight">Sarah Mitchell</span>
          <span className="block truncate text-[11px] leading-tight text-[var(--muted-foreground)]">{firm?.name}</span>
        </span>
      )}
    </button>
  )
}

const countBadge = (n: number, cls = '') => n > 0 ? <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold leading-none tabular-nums ${cls || 'bg-accent-300 text-accent-ink'}`}>{n}</span> : undefined

function AppSidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (c: boolean) => void }) {
  const { openModal } = useUi()
  const leads = useQuery(() => leadsApi.list())
  const tasks = useQuery(() => tasksApi.list())
  const firm = useQuery(() => firmApi.get())
  const open = leads?.filter(l => !['delivered', 'lost'].includes(l.stage)).length ?? 0
  const eod = endOfToday()
  const due = tasks?.filter(a => !a.done && a.dueAt <= eod).length ?? 0
  const setupLeft = firm ? (firm.domainStatus === 'verified' ? 0 : 1) + (firm.textStatus === 'registered' ? 0 : 1) : 0
  const badges: Record<string, React.ReactNode> = {
    pipeline: countBadge(open, 'bg-white/10 text-[var(--muted-foreground)] font-medium'),
    tasks: countBadge(due),
    settings: countBadge(setupLeft),
  }
  return (
    <Sidebar variant="collapsible" collapsed={collapsed} onCollapsedChange={setCollapsed} width={WIDTH} collapsedWidth={RAIL}
      aria-label="Main navigation" className="app-sidebar fixed inset-y-0 left-0 z-50 h-screen">
      <SidebarHeader className={collapsed ? 'mx-2 mt-1' : 'h-14'}>
        <Brand />
        <SidebarToggle className="ml-auto" />
      </SidebarHeader>
      <SidebarNav className="sidebar-nav">
        {NAV.map(s => (
          <SidebarSection key={s.label} label={s.label}>
            {s.ids.map(id => <NavItem key={id} to={VIEW[id].path} label={VIEW[id].label} icon={VIEW[id].icon} badge={badges[id]} />)}
            {s.label === 'Firm' && <NavItem label="Help and Resources" icon="help" onClick={() => openModal({ type: 'help' })} />}
          </SidebarSection>
        ))}
      </SidebarNav>
      <SidebarFooter><UserFooter /></SidebarFooter>
    </Sidebar>
  )
}

function Toolbar() {
  const id = useViewId()
  const v = VIEW[id]
  const navigate = useNavigate()
  const { filter, setFilter, openModal } = useUi()
  const seg = {
    messages: <Seg value={filter.inbox} onChange={x => setFilter('inbox', x)} options={[['all', 'All'], ['text', 'Texts'], ['email', 'Emails']]} />,
  }[id]
  return (
    <>
      <nav className="topnav" aria-label="Portal">
        <GlobalSearch />
        <button className="btn btn--icon only-phone-inline" type="button" onClick={() => navigate('/settings')} aria-label="Settings"><Icon name="gear" /></button>
      </nav>
      <header className="toolbar">
        <div className="toolbar__title">
          <div className="titlerow"><h1>{v.label}</h1>{id !== 'dashboard' && <InfoTip text={v.sub} label={`About ${v.label}`} />}</div>
          {id === 'dashboard' && <p className="footnote toolbar__sub">{`${greeting()}, Sarah. Here is what needs your attention today.`}</p>}
        </div>
        <div className="toolbar__actions" id="toolbar-actions">
          {seg}
        </div>
      </header>
    </>
  )
}

function TabBar() {
  const id = useViewId()
  const navigate = useNavigate()
  const { openModal } = useUi()
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map(t => (
        <button key={t} type="button" aria-current={id === t ? 'page' : undefined} onClick={() => navigate(VIEW[t].path)}>
          <Icon name={VIEW[t].icon} /><span>{VIEW[t].label}</span>
        </button>
      ))}
      <button type="button" aria-current={TABS.includes(id) ? undefined : 'page'} onClick={() => openModal({ type: 'more' })}><Icon name="more" /><span>More</span></button>
    </nav>
  )
}

function Shell() {
  const [collapsed, setCollapsed] = useState(false)
  const side = collapsed ? RAIL : WIDTH
  const { pathname } = useLocation()
  const { closeAll } = useUi()
  useEffect(() => { window.scrollTo(0, 0); closeAll() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <IconSprite />
      <AppSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="portal portal-main" style={{ marginLeft: side, ['--side-w' as string]: side + 'px', display: 'flex', flexDirection: 'column', transition: 'margin-left 240ms cubic-bezier(0.23, 1, 0.32, 1)' }}>
        <Toolbar />
        <main className="view"><Outlet /></main>
        <TabBar />
        <Layers />
        <Tour />
        <Toasts />
      </div>
    </>
  )
}

export default function AppShell() {
  return <UiProvider><Shell /></UiProvider>
}
